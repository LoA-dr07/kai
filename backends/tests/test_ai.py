"""Tests for the /ai router: conversations CRUD, and meal-plan/chat suggestion
endpoints with the Anthropic client mocked out (no real API calls)."""
import app.routers.ai as ai_router
from app.models.household import Household, HouseholdMember
from app.models.user import User


def _seed_household(db):
    household = Household(name="Testhaushalt")
    db.add(household)
    db.flush()
    user = User(name="Mama", short_name="MA", avatar_color="#1565C0")
    db.add(user)
    db.flush()
    db.add(HouseholdMember(household_id=household.id, user_id=user.id))
    db.flush()
    return household, user


class _FakeTextBlock:
    def __init__(self, text):
        self.text = text


class _FakeMessage:
    def __init__(self, text):
        self.content = [_FakeTextBlock(text)]


class _FakeMessages:
    def __init__(self, text):
        self._text = text

    def create(self, **kwargs):
        return _FakeMessage(self._text)


class _FakeAnthropicClient:
    def __init__(self, text):
        self.messages = _FakeMessages(text)


def _patch_api_client(monkeypatch, response_text):
    monkeypatch.setattr(ai_router, "_get_api_client", lambda: _FakeAnthropicClient(response_text))


class TestConversationsCrud:
    def test_list_empty_without_household(self, client):
        resp = client.get("/ai/conversations")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_create_list_update_delete(self, client, db):
        _seed_household(db)

        created = client.post("/ai/conversations", json={"title": "Erste Frage"})
        assert created.status_code == 201
        conv_id = created.json()["id"]

        listed = client.get("/ai/conversations")
        assert listed.status_code == 200
        assert any(c["id"] == conv_id for c in listed.json())

        updated = client.patch(f"/ai/conversations/{conv_id}", json={"title": "Neuer Titel"})
        assert updated.status_code == 200
        assert updated.json()["title"] == "Neuer Titel"

        deleted = client.delete(f"/ai/conversations/{conv_id}")
        assert deleted.status_code == 204

    def test_update_conversation_not_found(self, client):
        resp = client.patch("/ai/conversations/9999", json={"title": "X"})
        assert resp.status_code == 404

    def test_messages_not_found(self, client):
        resp = client.get("/ai/conversations/9999/messages")
        assert resp.status_code == 404


class TestMissingApiKey:
    def test_suggest_meal_plan_503_without_key(self, client, db, monkeypatch):
        monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
        _, user = _seed_household(db)
        resp = client.post("/ai/meal-plan-suggestion", json={
            "week_start_date": "2026-03-16",
            "requesting_user_id": user.id,
        })
        assert resp.status_code == 503


class TestSuggestMealPlan:
    def test_returns_sanitized_suggestion(self, client, db, monkeypatch):
        household, user = _seed_household(db)
        from app.models.recipe import Recipe
        recipe = Recipe(name="Pasta", servings=2)
        db.add(recipe)
        db.flush()

        fake_response = (
            '{"week_start_date": "2026-03-16", "entries": ['
            f'{{"day_of_week": 0, "meal_type": "dinner", "recipe_id": {recipe.id}, '
            '"recipe_name": "Pasta", "custom_meal": null, "assigned_user_ids": [999999], "reason": "lecker"}'
            ']}'
        )
        _patch_api_client(monkeypatch, fake_response)

        resp = client.post("/ai/meal-plan-suggestion", json={
            "week_start_date": "2026-03-16",
            "requesting_user_id": user.id,
        })
        assert resp.status_code == 200
        entries = resp.json()["entries"]
        assert len(entries) == 1
        # Unknown user id 999999 must be filtered out (sanitization step)
        assert entries[0]["assigned_user_ids"] == []
        assert entries[0]["recipe_id"] == recipe.id

    def test_unknown_requesting_user_404(self, client, db, monkeypatch):
        _seed_household(db)
        _patch_api_client(monkeypatch, "{}")
        resp = client.post("/ai/meal-plan-suggestion", json={
            "week_start_date": "2026-03-16",
            "requesting_user_id": 9999,
        })
        assert resp.status_code == 404


class TestAiChat:
    def test_chat_happy_path_persists_conversation(self, client, db, monkeypatch):
        _seed_household(db)
        fake_response = '{"reply": "Klar, hier ist ein Vorschlag.", "recipe_suggestions": [], "pending_actions": []}'
        _patch_api_client(monkeypatch, fake_response)

        resp = client.post("/ai/chat", json={
            "messages": [{"role": "user", "content": "Was koche ich heute?"}],
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["reply"] == "Klar, hier ist ein Vorschlag."
        assert data["conversation_id"] is not None

        messages = client.get(f"/ai/conversations/{data['conversation_id']}/messages")
        assert messages.status_code == 200
        assert len(messages.json()) == 2

    def test_chat_last_message_must_be_user(self, client, db, monkeypatch):
        _seed_household(db)
        _patch_api_client(monkeypatch, "{}")
        resp = client.post("/ai/chat", json={
            "messages": [{"role": "assistant", "content": "Hallo"}],
        })
        assert resp.status_code == 400

    def test_chat_with_existing_plan_and_assigned_user(self, client, db, monkeypatch):
        """Regression test: _build_chat_system_message() crashed with
        AttributeError('MealPlanEntry' object has no attribute 'assigned_user_ids')
        when the requested week already has a plan with an assigned user."""
        from datetime import date
        from app.models.meal_plan import MealPlan, MealPlanEntry

        household, user = _seed_household(db)
        plan = MealPlan(name="KW Test", week_start_date=date(2026, 3, 16), household_id=household.id)
        db.add(plan)
        db.flush()
        entry = MealPlanEntry(meal_plan_id=plan.id, day_of_week=0, meal_type="dinner", custom_meal="Pasta")
        db.add(entry)
        db.flush()
        entry.assigned_users = [user]
        db.flush()

        fake_response = '{"reply": "Klar!", "recipe_suggestions": [], "pending_actions": []}'
        _patch_api_client(monkeypatch, fake_response)

        resp = client.post("/ai/chat", json={
            "messages": [{"role": "user", "content": "Was steht diese Woche an?"}],
            "week_start_date": "2026-03-16",
        })
        assert resp.status_code == 200
        assert resp.json()["reply"] == "Klar!"
