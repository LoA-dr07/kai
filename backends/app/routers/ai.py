import os
import json
import anthropic
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from app.db.session import get_db
from app.models.user import User
from app.models.recipe import Recipe
from app.models.household import Household, HouseholdMember
from app.schemas.ai import AiMealPlanRequest, AiMealPlanSuggestion, AiMealPlanSuggestionEntry
from app.schemas.household import HouseholdSettings
from app.schemas.user import UserPreferences

router = APIRouter(prefix="/ai", tags=["ai"])

SYSTEM_MESSAGE = """Du bist ein Meal-Planner-Assistent. Generiere einen Wochenplan für einen Familienhaushalt.
Antworte AUSSCHLIESSLICH mit einem JSON-Objekt ohne Markdown-Codeblock, das exakt diesem Schema entspricht:
{
  "week_start_date": "YYYY-MM-DD",
  "entries": [
    {
      "day_of_week": 0,
      "meal_type": "breakfast",
      "recipe_id": 1,
      "recipe_name": "Name des Rezepts",
      "custom_meal": null,
      "assigned_user_ids": [1, 2, 3],
      "reason": "Kurze Begründung"
    }
  ]
}

Regeln:
- Entweder recipe_id (aus der Rezeptliste) ODER custom_meal setzen, nie beides, nie keines.
- recipe_name MUSS dem exakten Namen des Rezepts entsprechen wenn recipe_id gesetzt ist.
- Bevorzuge immer Rezepte aus der Rezeptliste (recipe_id). Setze custom_meal nur wenn kein passendes Rezept vorhanden ist.
- Beachte Allergien und Ernährungseinschränkungen ALLER Haushaltsmitglieder.
- An Nicht-Kochtagen: einfache Mahlzeiten (Reste, Brot, Joghurt). Nutze bevorzugt custom_meal für sehr einfache Mahlzeiten.
- Das JSON muss genau 35 Einträge enthalten (7 Tage × 5 Mahlzeitstypen: breakfast, lunch, snack, dinner, dessert).
- meal_type muss exakt einer dieser Werte sein: breakfast, lunch, snack, dinner, dessert.
- day_of_week: 0=Montag, 1=Dienstag, 2=Mittwoch, 3=Donnerstag, 4=Freitag, 5=Samstag, 6=Sonntag.
"""


def _build_user_message(
    week_start_date: str,
    requesting_user: User,
    all_users: list[User],
    household: Household,
    settings: HouseholdSettings,
    recipes: list[Recipe],
    special_wishes: str,
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
    lines.append("Erstelle jetzt den vollständigen Wochenplan als JSON.")

    return "\n".join(lines)


@router.post("/meal-plan-suggestion", response_model=AiMealPlanSuggestion)
def suggest_meal_plan(
    payload: AiMealPlanRequest,
    db: Session = Depends(get_db),
):
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="KI-Funktion nicht konfiguriert (ANTHROPIC_API_KEY fehlt)",
        )

    # Load requesting user
    requesting_user = db.get(User, payload.requesting_user_id)
    if not requesting_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Load all users
    all_users = db.query(User).order_by(User.id).all()

    # Load household with settings
    household = (
        db.query(Household)
        .options(joinedload(Household.members).joinedload(HouseholdMember.user))
        .first()
    )
    if not household:
        raise HTTPException(status_code=404, detail="No household found")

    settings = HouseholdSettings(**(household.settings or {}))

    # Load recipes (top 80 by average rating if more than 80 exist)
    all_recipes: list[Recipe] = db.query(Recipe).all()
    if len(all_recipes) > 80:
        def avg_rating(r: Recipe) -> float:
            if not r.ratings:
                return 0.0
            return sum(x.stars for x in r.ratings) / len(r.ratings)
        all_recipes = sorted(all_recipes, key=avg_rating, reverse=True)[:80]
    all_recipes.sort(key=lambda r: r.name)

    # Build valid recipe id set for hallucination check
    valid_recipe_ids = {r.id for r in all_recipes}
    all_user_ids = [u.id for u in all_users]

    # Build prompt
    user_message = _build_user_message(
        week_start_date=str(payload.week_start_date),
        requesting_user=requesting_user,
        all_users=all_users,
        household=household,
        settings=settings,
        recipes=all_recipes,
        special_wishes=payload.special_wishes,
    )

    # Call Claude
    try:
        client = anthropic.Anthropic(api_key=api_key)
        message = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=8096,
            system=SYSTEM_MESSAGE,
            messages=[{"role": "user", "content": user_message}],
        )
        raw_text = message.content[0].text
    except anthropic.APIStatusError as e:
        raise HTTPException(status_code=502, detail=f"KI-Anfrage fehlgeschlagen: {e.message}")
    except anthropic.APIConnectionError as e:
        raise HTTPException(status_code=502, detail=f"KI-Verbindungsfehler: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Interner Fehler bei der KI-Anfrage: {e}")

    # Parse and validate response
    try:
        parsed = json.loads(raw_text)
    except json.JSONDecodeError:
        raise HTTPException(status_code=502, detail="KI hat kein valides JSON geliefert")

    try:
        suggestion = AiMealPlanSuggestion.model_validate(parsed)
    except Exception:
        raise HTTPException(status_code=502, detail="KI-Antwort hat unerwartetes Format")

    # Cross-check: fix hallucinated recipe_ids
    sanitized_entries: list[AiMealPlanSuggestionEntry] = []
    for entry in suggestion.entries:
        if entry.recipe_id is not None and entry.recipe_id not in valid_recipe_ids:
            # Fallback: use recipe_name as custom_meal
            entry = AiMealPlanSuggestionEntry(
                day_of_week=entry.day_of_week,
                meal_type=entry.meal_type,
                recipe_id=None,
                recipe_name=None,
                custom_meal=entry.recipe_name or "Mahlzeit",
                assigned_user_ids=entry.assigned_user_ids,
                reason=entry.reason,
            )
        # Ensure only valid user IDs are included
        entry.assigned_user_ids = [uid for uid in entry.assigned_user_ids if uid in all_user_ids]
        sanitized_entries.append(entry)

    return AiMealPlanSuggestion(
        week_start_date=suggestion.week_start_date,
        entries=sanitized_entries,
    )
