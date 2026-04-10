import os
import json
import anthropic
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from app.db.session import get_db
from app.models.user import User
from app.models.recipe import Recipe, RecipeRating
from app.models.household import Household, HouseholdMember
from app.schemas.ai import (
    AiMealPlanRequest,
    AiMealPlanSuggestion,
    AiMealPlanSuggestionEntry,
    AiChatRequest,
    AiChatResponse,
    RecipeSuggestion,
)
from app.schemas.household import HouseholdSettings
from app.schemas.user import UserPreferences
from app.enums import MealType

router = APIRouter(prefix="/ai", tags=["ai"])


def _build_system_message(meal_types: list[MealType]) -> str:
    meal_type_str = ", ".join(meal_types)
    total_entries = len(meal_types) * 7
    return f"""Du bist ein Meal-Planner-Assistent. Generiere einen Wochenplan für einen Familienhaushalt.
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
            if recipe.ratings
            else "–"
        )
        prep = f"{recipe.prep_time_minutes}min" if recipe.prep_time_minutes else "?"
        parts = [f"[{recipe.id}] {recipe.name}", prep, f"⭐{avg_rating}"]
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
) -> str:
    lines = []
    lines.append(f"Du bist ein Meal-Planner-Assistent für den Haushalt '{household.name}'.")
    lines.append("Beantworte Fragen zu Rezepten, Ernährung und Mahlzeitenplanung auf Deutsch.")
    lines.append("")
    lines.append("HAUSHALTSMITGLIEDER:")
    for user in all_users:
        prefs = UserPreferences(**(user.preferences or {}))
        restrictions = ", ".join(prefs.dietary_restrictions) if prefs.dietary_restrictions else "keine"
        allergies = ", ".join(prefs.allergies) if prefs.allergies else "keine"
        never = ", ".join(nie_ratings.get(user.id, [])) or "–"
        lines.append(
            f"  [{user.id}] {user.name}: Ernährung={restrictions}, Allergien={allergies}, Nie={never}"
        )
    lines.append("")
    lines.append(f"VERFÜGBARE REZEPTE ({len(recipes)}):")
    for recipe in recipes:
        tag_names = ", ".join(t.name for t in recipe.tags) if recipe.tags else ""
        parts = [f"[{recipe.id}] {recipe.name}"]
        if tag_names:
            parts.append(f"Tags: {tag_names}")
        lines.append("  " + " | ".join(parts))
    lines.append("")
    lines.append(
        "Wenn du Rezepte vorschlägst, antworte IMMER mit einem JSON-Objekt (ohne Markdown-Codeblock):\n"
        '{"reply": "Deine Antwort auf Deutsch", "recipe_suggestions": [\n'
        '  {"recipe_id": 5, "recipe_name": "Pasta", "reason": "Kurze Begründung", "is_new_recipe": false}\n'
        "]}\n"
        "recipe_id nur setzen wenn das Rezept exakt in der obigen Rezeptliste existiert (ansonsten null).\n"
        "is_new_recipe=true wenn das Rezept NICHT in der Liste ist.\n"
        "Wenn keine Rezeptvorschläge gemacht werden, setze recipe_suggestions=[].\n"
        "Antworte IMMER mit diesem JSON-Format, auch für normale Konversation ohne Vorschläge."
    )
    return "\n".join(lines)


def _load_shared_context(db: Session) -> tuple[list[User], Household, list[Recipe], dict[int, list[str]]]:
    """Load users, household, recipes and nie-ratings. Raises HTTPException if not found."""
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
        raise HTTPException(
            status_code=503,
            detail="KI-Funktion nicht konfiguriert (ANTHROPIC_API_KEY fehlt)",
        )
    return anthropic.Anthropic(api_key=api_key)


@router.post("/meal-plan-suggestion", response_model=AiMealPlanSuggestion)
def suggest_meal_plan(
    payload: AiMealPlanRequest,
    db: Session = Depends(get_db),
):
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

    # Filter to only requested meal types
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

    return AiMealPlanSuggestion(
        week_start_date=suggestion.week_start_date,
        entries=sanitized_entries,
    )


@router.post("/chat", response_model=AiChatResponse)
def ai_chat(
    payload: AiChatRequest,
    db: Session = Depends(get_db),
):
    client = _get_api_client()

    all_users, household, all_recipes, nie_ratings = _load_shared_context(db)
    valid_recipe_ids = {r.id for r in all_recipes}

    system_message = _build_chat_system_message(
        all_users=all_users,
        household=household,
        recipes=all_recipes,
        nie_ratings=nie_ratings,
    )

    anthropic_messages = [
        {"role": msg.role, "content": msg.content}
        for msg in payload.messages
    ]

    try:
        message = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=4096,
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

    # Parse structured response; fall back to plain text if not valid JSON
    try:
        parsed = json.loads(raw_text)
        reply = str(parsed.get("reply", raw_text))
        raw_suggestions = parsed.get("recipe_suggestions", [])
    except (json.JSONDecodeError, AttributeError):
        reply = raw_text
        raw_suggestions = []

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
        # Fix hallucinated recipe_ids
        if recipe_id is not None and recipe_id not in valid_recipe_ids:
            recipe_id = None
            is_new = True
        recipe_suggestions.append(
            RecipeSuggestion(
                recipe_id=recipe_id,
                recipe_name=recipe_name,
                reason=str(s.get("reason", "")),
                is_new_recipe=is_new,
            )
        )

    return AiChatResponse(reply=reply, recipe_suggestions=recipe_suggestions)
