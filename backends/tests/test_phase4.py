"""
Unit-Tests Phase 4: User/Household-Endpunkte und MealPlanEntry-Zuweisung.
"""
import pytest
from datetime import date
from app.models.user import User
from app.models.household import Household, HouseholdMember
from app.models.meal_plan import MealPlan, MealPlanEntry


# ---------------------------------------------------------------------------
# Hilfsfunktionen
# ---------------------------------------------------------------------------

def _seed_household(db):
    """Legt 3 User + 1 Haushalt an und gibt (household, [user1, user2, user3]) zurück."""
    users = [
        User(name="Mama", short_name="MA", avatar_color="#1565C0"),
        User(name="Papa", short_name="PA", avatar_color="#6A1B9A"),
        User(name="Kind", short_name="KI", avatar_color="#E65100"),
    ]
    for u in users:
        db.add(u)
    db.flush()

    household = Household(name="Testhaushalt")
    db.add(household)
    db.flush()

    for u in users:
        db.add(HouseholdMember(household_id=household.id, user_id=u.id))
    db.flush()

    return household, users


def _seed_recipe(db):
    from app.models.recipe import Recipe
    recipe = Recipe(name="Testrezept", servings=2)
    db.add(recipe)
    db.flush()
    return recipe


# ---------------------------------------------------------------------------
# GET /users
# ---------------------------------------------------------------------------

class TestListUsers:
    def test_empty(self, client):
        resp = client.get("/users")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_returns_seeded_users(self, client, db):
        _, users = _seed_household(db)
        resp = client.get("/users")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 3
        names = {u["name"] for u in data}
        assert names == {"Mama", "Papa", "Kind"}

    def test_user_fields(self, client, db):
        u = User(name="Test", short_name="TE", avatar_color="#000000")
        db.add(u)
        db.flush()
        resp = client.get("/users")
        assert resp.status_code == 200
        found = next((x for x in resp.json() if x["name"] == "Test"), None)
        assert found is not None
        assert found["short_name"] == "TE"
        assert found["avatar_color"] == "#000000"


# ---------------------------------------------------------------------------
# GET /household
# ---------------------------------------------------------------------------

class TestGetHousehold:
    def test_404_when_empty(self, client):
        resp = client.get("/household")
        assert resp.status_code == 404

    def test_returns_household_with_members(self, client, db):
        household, users = _seed_household(db)
        resp = client.get("/household")
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "Testhaushalt"
        assert len(data["members"]) == 3
        member_names = {m["name"] for m in data["members"]}
        assert member_names == {"Mama", "Papa", "Kind"}


# ---------------------------------------------------------------------------
# MealPlanEntry – Zuweisung zu Haushaltsmitgliedern
# ---------------------------------------------------------------------------

class TestMealPlanEntryUserAssignment:
    def _create_plan(self, client):
        resp = client.post("/meal-plans", json={"name": "KW Test", "week_start_date": "2026-03-16"})
        assert resp.status_code == 201
        return resp.json()["id"]

    def test_entry_created_without_users(self, client, db):
        _seed_recipe(db)
        plan_id = self._create_plan(client)
        payload = {
            "day_of_week": 0,
            "meal_type": "breakfast",
            "custom_meal": "Brötchen",
        }
        resp = client.post(f"/meal-plans/{plan_id}/entries", json=payload)
        assert resp.status_code == 201
        assert resp.json()["assigned_user_ids"] == []

    def test_entry_created_with_users(self, client, db):
        _, users = _seed_household(db)
        plan_id = self._create_plan(client)
        payload = {
            "day_of_week": 1,
            "meal_type": "lunch",
            "custom_meal": "Pasta",
            "assigned_user_ids": [users[0].id, users[1].id],
        }
        resp = client.post(f"/meal-plans/{plan_id}/entries", json=payload)
        assert resp.status_code == 201
        result = resp.json()
        assert set(result["assigned_user_ids"]) == {users[0].id, users[1].id}

    def test_entry_update_assigns_users(self, client, db):
        _, users = _seed_household(db)
        plan_id = self._create_plan(client)

        # Entry ohne Zuweisung anlegen
        entry_resp = client.post(f"/meal-plans/{plan_id}/entries", json={
            "day_of_week": 2,
            "meal_type": "dinner",
            "custom_meal": "Pizza",
        })
        entry_id = entry_resp.json()["id"]

        # Alle drei User zuweisen
        all_ids = [u.id for u in users]
        patch_resp = client.patch(
            f"/meal-plans/{plan_id}/entries/{entry_id}",
            json={"assigned_user_ids": all_ids},
        )
        assert patch_resp.status_code == 200
        assert set(patch_resp.json()["assigned_user_ids"]) == set(all_ids)

    def test_entry_update_clears_users(self, client, db):
        _, users = _seed_household(db)
        plan_id = self._create_plan(client)

        entry_resp = client.post(f"/meal-plans/{plan_id}/entries", json={
            "day_of_week": 3,
            "meal_type": "breakfast",
            "custom_meal": "Müsli",
            "assigned_user_ids": [users[0].id],
        })
        entry_id = entry_resp.json()["id"]

        patch_resp = client.patch(
            f"/meal-plans/{plan_id}/entries/{entry_id}",
            json={"assigned_user_ids": []},
        )
        assert patch_resp.status_code == 200
        assert patch_resp.json()["assigned_user_ids"] == []

    def test_entry_invalid_user_id(self, client, db):
        plan_id = self._create_plan(client)
        payload = {
            "day_of_week": 4,
            "meal_type": "lunch",
            "custom_meal": "Suppe",
            "assigned_user_ids": [99999],
        }
        resp = client.post(f"/meal-plans/{plan_id}/entries", json=payload)
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# POST /meal-plans – idempotent bzgl. week_start_date (verhindert Duplikat-
# Pläne, die zuvor dazu führten, dass Einkaufslisten-Zutaten doppelt gezählt
# wurden, siehe test_shopping_list.py::TestGenerateShoppingList)
# ---------------------------------------------------------------------------

class TestCreateMealPlanIdempotent:
    def test_duplicate_week_start_date_reuses_existing_plan(self, client, db):
        first = client.post("/meal-plans", json={"name": "KW A", "week_start_date": "2026-07-20"})
        assert first.status_code == 201
        second = client.post("/meal-plans", json={"name": "KW A (dup)", "week_start_date": "2026-07-20"})
        assert second.status_code == 201
        assert second.json()["id"] == first.json()["id"]
        assert db.query(MealPlan).filter(MealPlan.week_start_date == date(2026, 7, 20)).count() == 1

    def test_duplicate_week_start_date_appends_entries_to_existing_plan(self, client, db):
        first = client.post("/meal-plans", json={
            "name": "KW A", "week_start_date": "2026-07-20",
            "entries": [{"day_of_week": 0, "meal_type": "dinner", "custom_meal": "Erste Mahlzeit"}],
        })
        plan_id = first.json()["id"]
        client.post("/meal-plans", json={
            "name": "KW A (dup)", "week_start_date": "2026-07-20",
            "entries": [{"day_of_week": 1, "meal_type": "lunch", "custom_meal": "Zweite Mahlzeit"}],
        })
        entries = client.get(f"/meal-plans/{plan_id}").json()["entries"]
        assert len(entries) == 2
