"""Tests for the /shopping-list router: generation from meal plans, item CRUD."""
from datetime import date
from app.models.household import Household
from app.models.recipe import Ingredient, Recipe, RecipeIngredient
from app.models.meal_plan import MealPlan, MealPlanEntry
from app.models.shopping_list import ShoppingList, ShoppingListItem
from app.models.user import User


def _seed_household(db) -> Household:
    household = Household(name="Testhaushalt")
    db.add(household)
    db.flush()
    return household


def _seed_household_with_users(db):
    household = _seed_household(db)
    users = [
        User(name="Mama", short_name="MA", avatar_color="#1565C0"),
        User(name="Papa", short_name="PA", avatar_color="#6A1B9A"),
        User(name="Kind", short_name="KI", avatar_color="#E65100"),
    ]
    for u in users:
        db.add(u)
    db.flush()
    return household, users


class TestGetActiveShoppingList:
    def test_404_without_household(self, client):
        resp = client.get("/shopping-list")
        assert resp.status_code == 404

    def test_null_when_no_list_yet(self, client, db):
        _seed_household(db)
        resp = client.get("/shopping-list")
        assert resp.status_code == 200
        assert resp.json() is None


class TestGenerateShoppingList:
    def test_generate_aggregates_recipe_ingredients(self, client, db):
        household = _seed_household(db)
        ingredient = Ingredient(name="Hackfleisch")
        db.add(ingredient)
        db.flush()
        recipe = Recipe(name="Bolognese", servings=4)
        db.add(recipe)
        db.flush()
        db.add(RecipeIngredient(recipe_id=recipe.id, ingredient_id=ingredient.id, amount=500, unit="g"))
        db.flush()

        plan = MealPlan(name="KW Test", week_start_date=date(2026, 3, 16), household_id=household.id)
        db.add(plan)
        db.flush()
        db.add(MealPlanEntry(meal_plan_id=plan.id, day_of_week=0, meal_type="dinner", recipe_id=recipe.id))
        db.flush()

        resp = client.post("/shopping-list/generate", json={
            "date_from": "2026-03-16", "date_to": "2026-03-22", "merge": False,
        })
        assert resp.status_code == 200
        items = resp.json()["items"]
        assert len(items) == 1
        assert items[0]["name"] == "Hackfleisch"
        assert items[0]["amount"] == 500

    def test_generate_includes_custom_meal_as_item(self, client, db):
        household = _seed_household(db)
        plan = MealPlan(name="KW Test", week_start_date=date(2026, 3, 16), household_id=household.id)
        db.add(plan)
        db.flush()
        db.add(MealPlanEntry(meal_plan_id=plan.id, day_of_week=1, meal_type="lunch", custom_meal="Reste"))
        db.flush()

        resp = client.post("/shopping-list/generate", json={
            "date_from": "2026-03-16", "date_to": "2026-03-22", "merge": False,
        })
        assert resp.status_code == 200
        names = [i["name"] for i in resp.json()["items"]]
        assert "Reste" in names

    def test_generate_replace_vs_merge(self, client, db):
        household = _seed_household(db)
        db.flush()

        first = client.post("/shopping-list/generate", json={
            "date_from": "2026-03-16", "date_to": "2026-03-22", "merge": False,
        })
        assert first.status_code == 200
        client.post("/shopping-list/items", json={"name": "Milch", "amount": 1, "unit": "L"})

        # merge=False (replace) should delete the old list and its manual item
        second = client.post("/shopping-list/generate", json={
            "date_from": "2026-03-16", "date_to": "2026-03-22", "merge": False,
        })
        assert all(i["name"] != "Milch" for i in second.json()["items"])

        client.post("/shopping-list/items", json={"name": "Milch", "amount": 1, "unit": "L"})
        # merge=True should keep the previously added manual item
        third = client.post("/shopping-list/generate", json={
            "date_from": "2026-03-16", "date_to": "2026-03-22", "merge": True,
        })
        assert any(i["name"] == "Milch" for i in third.json()["items"])

    def test_generate_not_doubled_after_duplicate_ensure_calls(self, client, db):
        """Regression test: ensurePlanForWeek()-style duplicate plan creation for
        the same week must no longer cause ingredients to be summed twice."""
        household = _seed_household(db)
        ingredient = Ingredient(name="Hackfleisch")
        db.add(ingredient)
        db.flush()
        recipe = Recipe(name="Bolognese", servings=4)
        db.add(recipe)
        db.flush()
        db.add(RecipeIngredient(recipe_id=recipe.id, ingredient_id=ingredient.id, amount=500, unit="g"))
        db.flush()

        first = client.post("/meal-plans", json={"name": "KW A", "week_start_date": "2026-03-16"})
        assert first.status_code == 201
        dup = client.post("/meal-plans", json={"name": "KW A (dup)", "week_start_date": "2026-03-16"})
        # Idempotent create: reuses the same plan instead of creating a duplicate.
        assert dup.json()["id"] == first.json()["id"]
        plan_id = first.json()["id"]

        client.post(f"/meal-plans/{plan_id}/entries", json={
            "day_of_week": 0, "meal_type": "dinner", "recipe_id": recipe.id,
        })

        resp = client.post("/shopping-list/generate", json={
            "date_from": "2026-03-16", "date_to": "2026-03-22", "merge": False,
        })
        items = resp.json()["items"]
        assert len(items) == 1
        assert items[0]["amount"] == 500

    def test_generate_scales_amount_by_assigned_user_count(self, client, db):
        household, users = _seed_household_with_users(db)
        ingredient = Ingredient(name="Reis")
        db.add(ingredient)
        db.flush()
        recipe = Recipe(name="Curry", servings=2)
        db.add(recipe)
        db.flush()
        db.add(RecipeIngredient(recipe_id=recipe.id, ingredient_id=ingredient.id, amount=500, unit="g"))
        db.flush()

        plan = MealPlan(name="KW Test", week_start_date=date(2026, 3, 16), household_id=household.id)
        db.add(plan)
        db.flush()
        entry = MealPlanEntry(meal_plan_id=plan.id, day_of_week=0, meal_type="dinner", recipe_id=recipe.id)
        entry.assigned_users = users  # 3 people, recipe serves 2 -> scale by 1.5
        db.add(entry)
        db.flush()

        resp = client.post("/shopping-list/generate", json={
            "date_from": "2026-03-16", "date_to": "2026-03-22", "merge": False,
        })
        items = resp.json()["items"]
        assert len(items) == 1
        assert items[0]["amount"] == 750

    def test_generate_without_assigned_users_uses_full_recipe_amount(self, client, db):
        household = _seed_household(db)
        ingredient = Ingredient(name="Nudeln")
        db.add(ingredient)
        db.flush()
        recipe = Recipe(name="Auflauf", servings=2)
        db.add(recipe)
        db.flush()
        db.add(RecipeIngredient(recipe_id=recipe.id, ingredient_id=ingredient.id, amount=500, unit="g"))
        db.flush()

        plan = MealPlan(name="KW Test", week_start_date=date(2026, 3, 16), household_id=household.id)
        db.add(plan)
        db.flush()
        db.add(MealPlanEntry(meal_plan_id=plan.id, day_of_week=0, meal_type="dinner", recipe_id=recipe.id))
        db.flush()

        resp = client.post("/shopping-list/generate", json={
            "date_from": "2026-03-16", "date_to": "2026-03-22", "merge": False,
        })
        items = resp.json()["items"]
        assert items[0]["amount"] == 500


class TestShoppingListItems:
    def test_add_item_creates_list_if_missing(self, client, db):
        _seed_household(db)
        resp = client.post("/shopping-list/items", json={"name": "Butter", "amount": 250, "unit": "g"})
        assert resp.status_code == 201
        assert resp.json()["name"] == "Butter"
        assert resp.json()["is_manual"] is True

    def test_update_item(self, client, db):
        _seed_household(db)
        created = client.post("/shopping-list/items", json={"name": "Eier"}).json()
        resp = client.patch(f"/shopping-list/items/{created['id']}", json={"is_checked": True})
        assert resp.status_code == 200
        assert resp.json()["is_checked"] is True

    def test_update_item_not_found(self, client):
        resp = client.patch("/shopping-list/items/9999", json={"is_checked": True})
        assert resp.status_code == 404
        assert "9999" in resp.json()["detail"]

    def test_delete_item(self, client, db):
        _seed_household(db)
        created = client.post("/shopping-list/items", json={"name": "Salz"}).json()
        resp = client.delete(f"/shopping-list/items/{created['id']}")
        assert resp.status_code == 204

    def test_clear_done_items(self, client, db):
        _seed_household(db)
        a = client.post("/shopping-list/items", json={"name": "Zucker"}).json()
        b = client.post("/shopping-list/items", json={"name": "Pfeffer"}).json()
        client.patch(f"/shopping-list/items/{a['id']}", json={"is_checked": True})

        resp = client.delete("/shopping-list/done")
        assert resp.status_code == 204
        remaining = client.get("/shopping-list").json()["items"]
        names = [i["name"] for i in remaining]
        assert "Zucker" not in names
        assert "Pfeffer" in names

    def test_delete_shopping_list(self, client, db):
        _seed_household(db)
        client.post("/shopping-list/items", json={"name": "Öl"})
        resp = client.delete("/shopping-list")
        assert resp.status_code == 204
        assert client.get("/shopping-list").json() is None
