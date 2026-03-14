"""
Unit tests for Phase 4: Household, Users, and MealPlanEntry user assignment.
"""
import pytest
from app.models.household import Household
from app.models.user import User
from app.models.meal_plan import MealPlan, MealPlanEntry, MealType


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _seed(db):
    """Insert one household with three users, return (household, [u1, u2, u3])."""
    hh = Household(name="Test-Haushalt")
    db.add(hh)
    db.flush()
    users = [
        User(name="Anna", abbreviation="An", avatar_color="#FF6B6B", household_id=hh.id),
        User(name="Ben", abbreviation="Be", avatar_color="#4ECDC4", household_id=hh.id),
        User(name="Clara", abbreviation="Cl", avatar_color="#45B7D1", household_id=hh.id),
    ]
    db.add_all(users)
    db.commit()
    db.refresh(hh)
    return hh, users


# ---------------------------------------------------------------------------
# GET /users
# ---------------------------------------------------------------------------

class TestListUsers:
    def test_empty(self, client):
        resp = client.get("/users")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_returns_seeded_users(self, client, db):
        _seed(db)
        resp = client.get("/users")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 3
        names = {u["name"] for u in data}
        assert names == {"Anna", "Ben", "Clara"}

    def test_user_fields(self, client, db):
        _seed(db)
        resp = client.get("/users")
        user = resp.json()[0]
        assert "id" in user
        assert "name" in user
        assert "abbreviation" in user
        assert "avatar_color" in user
        assert "household_id" in user


# ---------------------------------------------------------------------------
# GET /household
# ---------------------------------------------------------------------------

class TestGetHousehold:
    def test_404_when_empty(self, client):
        resp = client.get("/household")
        assert resp.status_code == 404

    def test_returns_household_with_members(self, client, db):
        _seed(db)
        resp = client.get("/household")
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "Test-Haushalt"
        assert len(data["members"]) == 3

    def test_household_member_fields(self, client, db):
        _seed(db)
        resp = client.get("/household")
        member = resp.json()["members"][0]
        assert "id" in member
        assert "name" in member
        assert "abbreviation" in member
        assert "avatar_color" in member


# ---------------------------------------------------------------------------
# MealPlanEntry user assignment
# ---------------------------------------------------------------------------

class TestMealPlanEntryUserAssignment:
    def _create_plan(self, client):
        resp = client.post("/meal-plans", json={
            "name": "KW1",
            "week_start_date": "2026-03-09",
            "entries": [],
        })
        assert resp.status_code == 201
        return resp.json()["id"]

    def test_add_entry_with_users(self, client, db):
        _seed(db)
        users = client.get("/users").json()
        user_ids = [u["id"] for u in users[:2]]

        plan_id = self._create_plan(client)
        resp = client.post(f"/meal-plans/{plan_id}/entries", json={
            "day_of_week": 0,
            "meal_type": "dinner",
            "custom_meal": "Pizza",
            "user_ids": user_ids,
        })
        assert resp.status_code == 201
        data = resp.json()
        assert len(data["assigned_users"]) == 2
        returned_ids = {u["id"] for u in data["assigned_users"]}
        assert returned_ids == set(user_ids)

    def test_add_entry_no_users(self, client, db):
        _seed(db)
        plan_id = self._create_plan(client)
        resp = client.post(f"/meal-plans/{plan_id}/entries", json={
            "day_of_week": 1,
            "meal_type": "lunch",
            "custom_meal": "Salat",
        })
        assert resp.status_code == 201
        assert resp.json()["assigned_users"] == []

    def test_update_entry_users(self, client, db):
        _seed(db)
        users = client.get("/users").json()
        plan_id = self._create_plan(client)

        # create entry with no users
        entry_resp = client.post(f"/meal-plans/{plan_id}/entries", json={
            "day_of_week": 2,
            "meal_type": "breakfast",
            "custom_meal": "Müsli",
            "user_ids": [],
        })
        entry_id = entry_resp.json()["id"]

        # assign all 3 users
        all_ids = [u["id"] for u in users]
        update_resp = client.patch(f"/meal-plans/{plan_id}/entries/{entry_id}", json={
            "user_ids": all_ids,
        })
        assert update_resp.status_code == 200
        assert len(update_resp.json()["assigned_users"]) == 3

    def test_add_entry_invalid_user_id(self, client, db):
        _seed(db)
        plan_id = self._create_plan(client)
        resp = client.post(f"/meal-plans/{plan_id}/entries", json={
            "day_of_week": 3,
            "meal_type": "dinner",
            "custom_meal": "Test",
            "user_ids": [9999],
        })
        assert resp.status_code == 404

    def test_create_plan_with_entry_and_users(self, client, db):
        _seed(db)
        users = client.get("/users").json()
        resp = client.post("/meal-plans", json={
            "name": "KW2",
            "week_start_date": "2026-03-16",
            "entries": [
                {
                    "day_of_week": 0,
                    "meal_type": "dinner",
                    "custom_meal": "Pasta",
                    "user_ids": [users[0]["id"]],
                }
            ],
        })
        assert resp.status_code == 201
        entry = resp.json()["entries"][0]
        assert len(entry["assigned_users"]) == 1
        assert entry["assigned_users"][0]["name"] == "Anna"
