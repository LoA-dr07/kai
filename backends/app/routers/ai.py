import os
import json
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from app.db.session import get_db
from app.models.user import User
from app.models.recipe import Recipe, RecipeRating
from app.models.household import Household, HouseholdMember
from app.models.meal_plan import MealPlan, MealPlanEntry
from app.models.shopping_list import ShoppingList, ShoppingListItem
from app.models.conversation import Conversation, ConversationMessage
from app.schemas.ai import (
    AiMealPlanRequest,
    AiMealPlanSuggestion,
    AiMealPlanSuggestionEntry,
    AiChatRequest,
    AiChatResponse,
    RecipeSuggestion,
    PendingAction,
)
from app.schemas.conversation import ConversationOut, ConversationCreate, ConversationUpdate, ConversationMessageOut
from app.schemas.household import HouseholdSettings
from app.schemas.user import UserPreferences
from app.enums import MealType
import anthropic

router = APIRouter(prefix="/ai", tags=["ai"])


# ---------------------------------------------------------------------------
# Meal plan suggestion (unchanged from original)
# ---------------------------------------------------------------------------

def _build_system_message(meal_types: list[MealType]) -> str:
    meal_type_str = ", ".join(meal_types)
    total_entries = len(meal_types) * 7
    return f"""Du bist ein Kai-Assistent. Generiere einen Wochenplan für einen Familienhaushalt.
Antworte AUSSCHLIESSLICH mit einem JSON-Objekt ohne Markdown-Codeblock, das exakt diesem Schema entspricht:
{{
  "week_start_date": "YYYY-MM-DD",
  "entries": [
    {{
      "day_of_week": 0,
      "meal_type": "breakfast",
      "recipe_id": 1,
      "recipe_name": "Name des Rezepts",
      "custom_meal": null,
      "assigned_user_ids": [1, 2, 3],
      "reason": "Kurze Begründung"
    }}
  ]
}}

Regeln:
- Entweder recipe_id (aus der Rezeptliste) ODER custom_meal setzen, nie beides, nie keines.
- recipe_name MUSS dem exakten Namen des Rezepts entsprechen wenn recipe_id gesetzt ist.
- Bevorzuge immer Rezepte aus der Rezeptliste (recipe_id). Setze custom_meal nur wenn kein passendes Rezept vorhanden ist.
- Beachte Allergien und Ernährungseinschränkungen ALLER Haushaltsmitglieder.
- An Nicht-Kochtagen: einfache Mahlzeiten (Reste, Brot, Joghurt). Nutze bevorzugt custom_meal für sehr einfache Mahlzeiten.
- Die zu planenden Mahlzeitstypen sind: {meal_type_str}.
- meal_type muss exakt einer dieser Werte sein: {meal_type_str}.
- day_of_week: 0=Montag, 1=Dienstag, 2=Mittwoch, 3=Donnerstag, 4=Freitag, 5=Samstag, 6=Sonntag.
- Das JSON muss mindestens {total_entries} Einträge enthalten (7 Tage × {len(meal_types)} Mahlzeitstypen: {meal_type_str}).
- NIE-Rezepte dürfen NIEMALS für den jeweiligen Nutzer eingeplant werden (weder als recipe_id noch als custom_meal mit ähnlichem Namen).
- Falls Haushaltsmitglieder für denselben Tag+Mahlzeitstyp-Slot unterschiedliche Einschränkungen haben (z.B. wegen NIE-Bewertungen), erzeuge MEHRERE Einträge für denselben Slot mit unterschiedlichen assigned_user_ids. Versuche zuerst, ein gemeinsames Gericht zu finden.
"""


def _build_user_message(
    week_start_date: str,
    requesting_user: User,
    all_users: list[User],
    household: Household,
    settings: HouseholdSettings,
    recipes: list[Recipe],
    special_wishes: str,
    meal_types: list[MealType],
    nie_ratings: dict[int, list[str]],
) -> str:
    lines = []
    lines.append(f"WOCHENBEGINN: {week_start_date}")
    lines.append(f"ANFRAGENDER NUTZER: {requesting_user.name} ({requesting_user.short_name})")
    lines.append(f"BESONDERE WÜNSCHE: {special_wishes.strip() or 'keine'}")
    lines.append("")
    lines.append(f"HAUSHALT: {household.name}")
    lines.append("HAUSHALT-EINSTELLUNGEN:")
    lines.append(f"  Kochtage: {', '.join(settings.cooking_days) or 'keine Angabe'}")
    lines.append(f"  Warme Hauptmahlzeit: {settings.hot_meal_time}")
    lines.append(f"  Nur-Kalt-Tage: {', '.join(settings.cold_meal_days) or 'keine'}")
    lines.append(f"  Reste verwenden: {settings.leftovers_frequency}")
    lines.append(f"  Gemeinsam essen (1-5): {settings.shared_meals_importance}")
    if settings.weekly_budget is not None:
        lines.append(f"  Wochenbudget: {settings.weekly_budget:.0f} EUR")
    lines.append(f"  Bevorzugte Küchen: {', '.join(settings.preferred_cuisines) or 'keine Präferenz'}")
    lines.append(f"  Kochkenntnisse: {settings.cooking_skill_level}")
    if settings.notes:
        lines.append(f"HAUSHALT-NOTIZEN: {settings.notes}")
    lines.append("")
    lines.append(f"HAUSHALTSMITGLIEDER ({len(all_users)}):")
    for user in all_users:
        prefs = UserPreferences(**(user.preferences or {}))
        lines.append(f"  [{user.id}] {user.name} ({user.short_name}):")
        if prefs.dietary_restrictions:
            lines.append(f"    Ernährung: {', '.join(prefs.dietary_restrictions)}")
        else:
            lines.append("    Ernährung: keine Einschränkungen")
        if prefs.allergies:
            lines.append(f"    Allergien: {', '.join(prefs.allergies)}")
        if prefs.disliked_ingredients:
            lines.append(f"    Nicht gemocht: {', '.join(prefs.disliked_ingredients)}")
        if prefs.liked_cuisines:
            lines.append(f"    Bevorzugte Küchen: {', '.join(prefs.liked_cuisines)}")
        lines.append(f"    Schärfe: {prefs.spice_tolerance}, Portion: {prefs.portion_size}")
    lines.append("")
    lines.append("NIE-REZEPTE PRO NUTZER (dürfen für diese Person NICHT eingeplant werden):")
    for user in all_users:
        never_list = nie_ratings.get(user.id, [])
        if never_list:
            lines.append(f"  [{user.id}] {user.name}: {', '.join(never_list)}")
        else:
            lines.append(f"  [{user.id}] {user.name}: –")
    lines.append("")
    lines.append(f"VERFÜGBARE REZEPTE ({len(recipes)}):")
    for recipe in recipes:
        tag_names = ", ".join(t.name for t in recipe.tags) if recipe.tags else ""
        avg_rating = (
            round(sum(r.stars for r in recipe.ratings) / len(recipe.ratings), 1)
            if recipe.ratings else "–"
        )
        prep = f"{recipe.prep_time_minutes}min" if recipe.prep_time_minutes else "?"
        parts = [f"[{recipe.id}] {recipe.name}", prep, f"⭐{avg_rating}", f"{recipe.servings} Portionen"]
        if tag_names:
            parts.append(f"Tags: {tag_names}")
        lines.append("  " + " | ".join(parts))
    lines.append("")
    meal_types_str = ", ".join(meal_types)
    lines.append(f"Erstelle jetzt den Wochenplan für Mahlzeitstypen: {meal_types_str} als JSON.")
    return "\n".join(lines)


def _build_chat_system_message(
    all_users: list[User],
    household: Household,
    recipes: list[Recipe],
    nie_ratings: dict[int, list[str]],
    settings: HouseholdSettings,
    current_meal_plan: MealPlan | None = None,
    shopping_list: ShoppingList | None = None,
    week_start_date: str | None = None,
) -> str:
    from datetime import date, timedelta

    DAY_NAMES = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"]
    MEAL_LABELS = {"breakfast": "Frühstück", "lunch": "Mittagessen", "snack": "Snack", "dinner": "Abendessen", "dessert": "Dessert"}

    # Compute calendar context so the AI knows exact dates for "diese/nächste Woche"
    today = date.today()
    this_monday = today - timedelta(days=today.weekday())
    next_monday = this_monday + timedelta(days=7)
    week_after_monday = this_monday + timedelta(days=14)

    lines = []
    lines.append(f"Du bist ein Kai-Assistent für den Haushalt '{household.name}'.")
    lines.append("Beantworte Fragen zu Rezepten, Ernährung, Wochenplan und Einkaufsliste auf Deutsch.")
    lines.append(f"HEUTE: {today.isoformat()} ({DAY_NAMES[today.weekday()]})")
    lines.append(f"DIESE WOCHE: {this_monday.isoformat()} – {(this_monday + timedelta(days=6)).isoformat()}  (week_start_date={this_monday.isoformat()})")
    lines.append(f"NÄCHSTE WOCHE: {next_monday.isoformat()} – {(next_monday + timedelta(days=6)).isoformat()}  (week_start_date={next_monday.isoformat()})")
    lines.append(f"ÜBERNÄCHSTE WOCHE: {week_after_monday.isoformat()} – {(week_after_monday + timedelta(days=6)).isoformat()}  (week_start_date={week_after_monday.isoformat()})")
    lines.append("Verwende immer den angegebenen week_start_date-Wert (Montag der Woche) in pending_actions.")
    lines.append("")

    # Full household settings
    lines.append("HAUSHALT-EINSTELLUNGEN:")
    lines.append(f"  Kochtage: {', '.join(settings.cooking_days) or 'keine Angabe'}")
    lines.append(f"  Warme Hauptmahlzeit: {settings.hot_meal_time}")
    lines.append(f"  Nur-Kalt-Tage: {', '.join(settings.cold_meal_days) or 'keine'}")
    lines.append(f"  Reste verwenden: {settings.leftovers_frequency}")
    lines.append(f"  Gemeinsam essen (1-5): {settings.shared_meals_importance}")
    if settings.weekly_budget is not None:
        lines.append(f"  Wochenbudget: {settings.weekly_budget:.0f} EUR")
    lines.append(f"  Bevorzugte Küchen: {', '.join(settings.preferred_cuisines) or 'keine Präferenz'}")
    lines.append(f"  Kochkenntnisse: {settings.cooking_skill_level}")
    if settings.notes:
        lines.append(f"  Notizen: {settings.notes}")

    lines.append("")
    lines.append("HAUSHALTSMITGLIEDER:")
    for user in all_users:
        prefs = UserPreferences(**(user.preferences or {}))
        restrictions = ", ".join(prefs.dietary_restrictions) if prefs.dietary_restrictions else "keine"
        allergies = ", ".join(prefs.allergies) if prefs.allergies else "keine"
        disliked = ", ".join(prefs.disliked_ingredients) if prefs.disliked_ingredients else "–"
        liked_cuisines = ", ".join(prefs.liked_cuisines) if prefs.liked_cuisines else "–"
        never = ", ".join(nie_ratings.get(user.id, [])) or "–"
        lines.append(f"  [{user.id}] {user.name} ({user.short_name}):")
        lines.append(f"    Ernährung={restrictions}, Allergien={allergies}")
        lines.append(f"    Nicht gemocht={disliked}, Küchen={liked_cuisines}")
        lines.append(f"    Schärfe={prefs.spice_tolerance}, Portion={prefs.portion_size}")
        lines.append(f"    Nie-Rezepte={never}")

    lines.append("")
    lines.append(f"VERFÜGBARE REZEPTE ({len(recipes)}):")
    for recipe in recipes:
        tag_names = ", ".join(t.name for t in recipe.tags) if recipe.tags else ""
        avg_rating = (
            round(sum(r.stars for r in recipe.ratings) / len(recipe.ratings), 1)
            if recipe.ratings else "–"
        )
        ing_count = len(recipe.ingredients)
        prep = f"{recipe.prep_time_minutes}min" if recipe.prep_time_minutes else "?"
        parts = [f"[{recipe.id}] {recipe.name}", f"{prep}", f"⭐{avg_rating}", f"{recipe.servings} Portionen", f"{ing_count} Zutaten"]
        if tag_names:
            parts.append(f"Tags: {tag_names}")
        lines.append("  " + " | ".join(parts))

    # Current meal plan context
    if current_meal_plan:
        lines.append("")
        lines.append(f"AKTUELLER WOCHENPLAN ({current_meal_plan.week_start_date}):")
        entry_by_slot: dict[tuple[int, str], list[MealPlanEntry]] = {}
        for e in current_meal_plan.entries:
            entry_by_slot.setdefault((e.day_of_week, e.meal_type), []).append(e)
        for (day, mt), entries in sorted(entry_by_slot.items()):
            day_name = DAY_NAMES[day] if day < 7 else str(day)
            meal_label = MEAL_LABELS.get(mt, mt)
            user_ids = ", ".join(
                next((u.name for u in all_users if u.id == uid), str(uid))
                for e in entries for uid in e.assigned_user_ids
            )
            meals = "; ".join(e.recipe.name if e.recipe else (e.custom_meal or "?") for e in entries)
            lines.append(f"  {day_name} {meal_label}: {meals}" + (f" ({user_ids})" if user_ids else ""))

    # Shopping list context
    if shopping_list and shopping_list.items:
        lines.append("")
        unchecked = [i for i in shopping_list.items if not i.is_checked]
        checked = [i for i in shopping_list.items if i.is_checked]
        lines.append(f"AKTIVE EINKAUFSLISTE ({len(unchecked)} offen, {len(checked)} erledigt):")
        for item in unchecked[:30]:
            qty = f"{item.amount} {item.unit}" if item.amount else ""
            lines.append(f"  [{item.id}] {item.name}" + (f" – {qty}" if qty else ""))
        if len(unchecked) > 30:
            lines.append(f"  ... und {len(unchecked) - 30} weitere")

    lines.append("")
    lines.append(
        "Antworte IMMER mit einem JSON-Objekt (ohne Markdown-Codeblock):\n"
        '{"reply": "Deine Antwort auf Deutsch", "recipe_suggestions": [...], "pending_actions": [...]}\n'
        "\n"
        "recipe_suggestions: Liste von Rezeptvorschlägen:\n"
        '  {"recipe_id": 5, "recipe_name": "Pasta", "reason": "...", "is_new_recipe": false}\n'
        "  recipe_id nur setzen wenn das Rezept exakt in der Rezeptliste existiert (ansonsten null).\n"
        "  is_new_recipe=true wenn das Rezept nicht in der Liste ist.\n"
        "\n"
        "pending_actions: Aktionen die du ausführen möchtest (Nutzer muss bestätigen):\n"
        '  {"type": "add_meal_plan_entry", "description": "Pasta am Montag zum Abendessen eintragen", "data": {"week_start_date": "2026-04-21", "day_of_week": 0, "meal_type": "dinner", "recipe_id": 5, "recipe_name": "Pasta", "custom_meal": null, "assigned_user_ids": [1,2,3]}}\n'
        '  {"type": "delete_meal_plan_entry", "description": "Montag Abendessen löschen", "data": {"entry_id": 42}}\n'
        '  {"type": "generate_shopping_list", "description": "Einkaufsliste für diese Woche erstellen", "data": {"date_from": "2026-04-21", "date_to": "2026-04-27"}}\n'
        '  {"type": "add_shopping_item", "description": "Milch zur Einkaufsliste hinzufügen", "data": {"name": "Milch", "amount": 1, "unit": "L"}}\n'
        "\n"
        "Wenn keine Vorschläge oder Aktionen, setze die Listen auf [].\n"
        "IMMER im JSON-Format antworten, auch für normale Konversation."
    )
    return "\n".join(lines)


def _load_shared_context(db: Session) -> tuple[list[User], Household, list[Recipe], dict[int, list[str]]]:
    all_users = db.query(User).order_by(User.id).all()
    household = (
        db.query(Household)
        .options(joinedload(Household.members).joinedload(HouseholdMember.user))
        .first()
    )
    if not household:
        raise HTTPException(status_code=404, detail="No household found")
    all_recipes: list[Recipe] = db.query(Recipe).all()
    if len(all_recipes) > 80:
        def avg_rating(r: Recipe) -> float:
            if not r.ratings:
                return 0.0
            return sum(x.stars for x in r.ratings) / len(r.ratings)
        all_recipes = sorted(all_recipes, key=avg_rating, reverse=True)[:80]
    all_recipes.sort(key=lambda r: r.name)
    valid_recipe_ids = {r.id for r in all_recipes}
    nie_ratings_db = (
        db.query(RecipeRating)
        .filter(RecipeRating.stars == 0, RecipeRating.recipe_id.in_(valid_recipe_ids))
        .all()
    )
    recipe_name_map = {r.id: r.name for r in all_recipes}
    nie_ratings: dict[int, list[str]] = {}
    for nr in nie_ratings_db:
        nie_ratings.setdefault(nr.user_id, []).append(recipe_name_map[nr.recipe_id])
    return all_users, household, all_recipes, nie_ratings


def _get_api_client() -> anthropic.Anthropic:
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="KI-Funktion nicht konfiguriert (ANTHROPIC_API_KEY fehlt)")
    return anthropic.Anthropic(api_key=api_key)


def _auto_title(message: str) -> str:
    words = message.strip().split()
    title = " ".join(words[:6])
    if len(words) > 6:
        title += " …"
    return title or "Neue Konversation"


# ---------------------------------------------------------------------------
# Meal plan suggestion
# ---------------------------------------------------------------------------

@router.post("/meal-plan-suggestion", response_model=AiMealPlanSuggestion)
def suggest_meal_plan(payload: AiMealPlanRequest, db: Session = Depends(get_db)):
    client = _get_api_client()
    requesting_user = db.get(User, payload.requesting_user_id)
    if not requesting_user:
        raise HTTPException(status_code=404, detail="User not found")
    all_users, household, all_recipes, nie_ratings = _load_shared_context(db)
    settings = HouseholdSettings(**(household.settings or {}))
    valid_recipe_ids = {r.id for r in all_recipes}
    all_user_ids = [u.id for u in all_users]
    system_message = _build_system_message(payload.meal_types)
    user_message = _build_user_message(
        week_start_date=str(payload.week_start_date),
        requesting_user=requesting_user,
        all_users=all_users,
        household=household,
        settings=settings,
        recipes=all_recipes,
        special_wishes=payload.special_wishes,
        meal_types=payload.meal_types,
        nie_ratings=nie_ratings,
    )
    try:
        message = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=8096,
            system=system_message,
            messages=[{"role": "user", "content": user_message}],
        )
        raw_text = message.content[0].text
    except anthropic.APIStatusError as e:
        raise HTTPException(status_code=502, detail=f"KI-Anfrage fehlgeschlagen: {e.message}")
    except anthropic.APIConnectionError as e:
        raise HTTPException(status_code=502, detail=f"KI-Verbindungsfehler: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Interner Fehler bei der KI-Anfrage: {e}")
    try:
        parsed = json.loads(raw_text)
    except json.JSONDecodeError:
        raise HTTPException(status_code=502, detail="KI hat kein valides JSON geliefert")
    try:
        suggestion = AiMealPlanSuggestion.model_validate(parsed)
    except Exception:
        raise HTTPException(status_code=502, detail="KI-Antwort hat unerwartetes Format")
    allowed_meal_types = set(payload.meal_types)
    sanitized_entries: list[AiMealPlanSuggestionEntry] = []
    for entry in suggestion.entries:
        if entry.meal_type not in allowed_meal_types:
            continue
        if entry.recipe_id is not None and entry.recipe_id not in valid_recipe_ids:
            entry = AiMealPlanSuggestionEntry(
                day_of_week=entry.day_of_week,
                meal_type=entry.meal_type,
                recipe_id=None,
                recipe_name=None,
                custom_meal=entry.recipe_name or "Mahlzeit",
                assigned_user_ids=entry.assigned_user_ids,
                reason=entry.reason,
            )
        entry.assigned_user_ids = [uid for uid in entry.assigned_user_ids if uid in all_user_ids]
        sanitized_entries.append(entry)
    return AiMealPlanSuggestion(week_start_date=suggestion.week_start_date, entries=sanitized_entries)


# ---------------------------------------------------------------------------
# Conversations
# ---------------------------------------------------------------------------

@router.get("/conversations", response_model=list[ConversationOut])
def list_conversations(db: Session = Depends(get_db)):
    household = db.query(Household).first()
    if not household:
        return []
    convs = (
        db.query(Conversation)
        .filter(Conversation.household_id == household.id)
        .order_by(Conversation.updated_at.desc())
        .limit(10)
        .all()
    )
    result = []
    for c in convs:
        result.append(ConversationOut(
            id=c.id,
            title=c.title,
            created_at=c.created_at,
            updated_at=c.updated_at,
            message_count=len(c.messages),
        ))
    return result


@router.post("/conversations", response_model=ConversationOut, status_code=status.HTTP_201_CREATED)
def create_conversation(payload: ConversationCreate, db: Session = Depends(get_db)):
    household = db.query(Household).first()
    now = datetime.utcnow()
    conv = Conversation(
        household_id=household.id if household else None,
        title=payload.title,
        created_at=now,
        updated_at=now,
    )
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return ConversationOut(id=conv.id, title=conv.title, created_at=conv.created_at, updated_at=conv.updated_at, message_count=0)


@router.patch("/conversations/{conv_id}", response_model=ConversationOut)
def update_conversation(conv_id: int, payload: ConversationUpdate, db: Session = Depends(get_db)):
    conv = db.get(Conversation, conv_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    conv.title = payload.title
    db.commit()
    db.refresh(conv)
    return ConversationOut(id=conv.id, title=conv.title, created_at=conv.created_at, updated_at=conv.updated_at, message_count=len(conv.messages))


@router.delete("/conversations/{conv_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_conversation(conv_id: int, db: Session = Depends(get_db)):
    conv = db.get(Conversation, conv_id)
    if conv:
        db.delete(conv)
        db.commit()


@router.get("/conversations/{conv_id}/messages", response_model=list[ConversationMessageOut])
def get_conversation_messages(conv_id: int, db: Session = Depends(get_db)):
    conv = db.get(Conversation, conv_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return [ConversationMessageOut.model_validate(m) for m in conv.messages]


# ---------------------------------------------------------------------------
# Chat
# ---------------------------------------------------------------------------

@router.post("/chat", response_model=AiChatResponse)
def ai_chat(payload: AiChatRequest, db: Session = Depends(get_db)):
    client = _get_api_client()
    all_users, household, all_recipes, nie_ratings = _load_shared_context(db)
    valid_recipe_ids = {r.id for r in all_recipes}
    settings = HouseholdSettings(**(household.settings or {}))

    # Load current week's meal plan for context
    current_meal_plan: MealPlan | None = None
    if payload.week_start_date:
        current_meal_plan = (
            db.query(MealPlan)
            .filter(
                MealPlan.household_id == household.id,
                MealPlan.week_start_date == payload.week_start_date,
            )
            .first()
        )

    # Load active shopping list for context
    shopping_list: ShoppingList | None = (
        db.query(ShoppingList)
        .filter(ShoppingList.household_id == household.id)
        .order_by(ShoppingList.created_at.desc())
        .first()
    )

    # Load or create conversation
    conv: Conversation | None = None
    if payload.conversation_id:
        conv = db.get(Conversation, payload.conversation_id)

    system_message = _build_chat_system_message(
        all_users=all_users,
        household=household,
        recipes=all_recipes,
        nie_ratings=nie_ratings,
        settings=settings,
        current_meal_plan=current_meal_plan,
        shopping_list=shopping_list,
        week_start_date=payload.week_start_date,
    )

    # Build message history
    if conv and conv.messages:
        # Use persisted history
        history = [{"role": m.role, "content": m.content} for m in conv.messages]
    else:
        # Use provided messages (stateless fallback)
        history = [{"role": msg.role, "content": msg.content} for msg in payload.messages[:-1]]

    # Last user message
    last_user_msg = payload.messages[-1] if payload.messages else None
    if not last_user_msg or last_user_msg.role != "user":
        raise HTTPException(status_code=400, detail="Last message must be from user")

    anthropic_messages = history + [{"role": "user", "content": last_user_msg.content}]

    try:
        message = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=8192,
            system=system_message,
            messages=anthropic_messages,
        )
        raw_text = message.content[0].text
    except anthropic.APIStatusError as e:
        raise HTTPException(status_code=502, detail=f"KI-Anfrage fehlgeschlagen: {e.message}")
    except anthropic.APIConnectionError as e:
        raise HTTPException(status_code=502, detail=f"KI-Verbindungsfehler: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Interner Fehler bei der KI-Anfrage: {e}")

    # Parse structured response.
    # The AI sometimes emits prose before the JSON object, so try to locate
    # the JSON by searching for the last {"reply": marker when direct parse fails.
    parsed: dict | None = None
    try:
        parsed = json.loads(raw_text)
    except json.JSONDecodeError:
        for marker in ('{"reply":', '{ "reply":'):
            idx = raw_text.rfind(marker)
            if idx != -1:
                try:
                    parsed = json.loads(raw_text[idx:])
                    break
                except json.JSONDecodeError:
                    pass

    if parsed is not None:
        reply = str(parsed.get("reply", raw_text))
        raw_suggestions = parsed.get("recipe_suggestions", [])
        raw_actions = parsed.get("pending_actions", [])
    else:
        reply = raw_text
        raw_suggestions = []
        raw_actions = []

    # Validate and sanitize recipe suggestions
    recipe_suggestions: list[RecipeSuggestion] = []
    for s in raw_suggestions:
        if not isinstance(s, dict):
            continue
        recipe_id = s.get("recipe_id")
        recipe_name = s.get("recipe_name", "")
        if not recipe_name:
            continue
        is_new = bool(s.get("is_new_recipe", False))
        if recipe_id is not None and recipe_id not in valid_recipe_ids:
            recipe_id = None
            is_new = True
        recipe_suggestions.append(RecipeSuggestion(
            recipe_id=recipe_id,
            recipe_name=recipe_name,
            reason=str(s.get("reason", "")),
            is_new_recipe=is_new,
        ))

    # Validate pending actions
    pending_actions: list[PendingAction] = []
    valid_action_types = {"add_meal_plan_entry", "delete_meal_plan_entry", "generate_shopping_list", "add_shopping_item", "create_recipe"}
    for a in raw_actions:
        if not isinstance(a, dict):
            continue
        action_type = a.get("type", "")
        if action_type not in valid_action_types:
            continue
        description = str(a.get("description", ""))
        data = a.get("data", {})
        if not isinstance(data, dict):
            continue
        pending_actions.append(PendingAction(type=action_type, description=description, data=data))

    # Persist conversation
    now = datetime.utcnow()
    if conv is None and payload.conversation_id is None:
        # Auto-create conversation on first message
        conv = Conversation(
            household_id=household.id,
            title=_auto_title(last_user_msg.content),
            created_at=now,
            updated_at=now,
        )
        db.add(conv)
        db.flush()
    elif conv is None and payload.conversation_id is not None:
        # conversation_id given but not found
        conv = None

    if conv:
        # Save messages
        db.add(ConversationMessage(conversation_id=conv.id, role="user", content=last_user_msg.content, created_at=now))
        db.add(ConversationMessage(conversation_id=conv.id, role="assistant", content=reply, created_at=now))
        conv.updated_at = now
        db.commit()
        db.refresh(conv)

    return AiChatResponse(
        reply=reply,
        recipe_suggestions=recipe_suggestions,
        pending_actions=pending_actions,
        conversation_id=conv.id if conv else None,
    )
