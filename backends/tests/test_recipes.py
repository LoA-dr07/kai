"""Tests for the /recipes router: ingredients, tags, CRUD, import/export."""
from app.models.recipe import Ingredient, Recipe, RecipeIngredient, Tag


def _create_recipe(client, name="Spaghetti Bolognese", ingredient_id=None, tag_ids=None):
    payload = {
        "name": name,
        "servings": 4,
        "ingredients": (
            [{"ingredient_id": ingredient_id, "amount": 500, "unit": "g"}]
            if ingredient_id
            else []
        ),
        "tag_ids": tag_ids or [],
    }
    resp = client.post("/recipes", json=payload)
    assert resp.status_code == 201
    return resp.json()


class TestIngredients:
    def test_create_ingredient(self, client):
        resp = client.post("/recipes/ingredients", json={"name": "Hackfleisch"})
        assert resp.status_code == 201
        assert resp.json()["name"] == "Hackfleisch"

    def test_create_duplicate_ingredient_conflicts(self, client):
        client.post("/recipes/ingredients", json={"name": "Mehl"})
        resp = client.post("/recipes/ingredients", json={"name": "Mehl"})
        assert resp.status_code == 409

    def test_update_ingredient_not_found(self, client):
        resp = client.patch("/recipes/ingredients/9999", json={"name": "X"})
        assert resp.status_code == 404
        assert "9999" in resp.json()["detail"]


class TestTags:
    def test_create_tag_idempotent_case_insensitive(self, client):
        first = client.post("/recipes/tags", json={"name": "Vegan"})
        assert first.status_code == 201
        second = client.post("/recipes/tags", json={"name": "vegan"})
        assert second.status_code == 201
        assert first.json()["id"] == second.json()["id"]

    def test_list_tags(self, client, db):
        db.add(Tag(name="Schnell", is_predefined=True))
        db.flush()
        resp = client.get("/recipes/tags")
        assert resp.status_code == 200
        assert any(t["name"] == "Schnell" for t in resp.json())


class TestRecipeCrud:
    def test_create_and_get_recipe(self, client, db):
        ingredient = Ingredient(name="Nudeln")
        db.add(ingredient)
        db.flush()
        tag = Tag(name="Pasta")
        db.add(tag)
        db.flush()

        created = _create_recipe(client, ingredient_id=ingredient.id, tag_ids=[tag.id])
        assert created["name"] == "Spaghetti Bolognese"
        assert len(created["ingredients"]) == 1
        assert created["ingredients"][0]["ingredient"]["name"] == "Nudeln"
        assert created["tags"][0]["name"] == "Pasta"

        resp = client.get(f"/recipes/{created['id']}")
        assert resp.status_code == 200
        assert resp.json()["name"] == "Spaghetti Bolognese"

    def test_get_recipe_not_found(self, client):
        resp = client.get("/recipes/9999")
        assert resp.status_code == 404
        assert "9999" in resp.json()["detail"]

    def test_update_recipe_replaces_ingredients_and_tags(self, client, db):
        ing1 = Ingredient(name="Reis")
        ing2 = Ingredient(name="Curry")
        db.add_all([ing1, ing2])
        db.flush()
        created = _create_recipe(client, name="Curry-Reis", ingredient_id=ing1.id)

        resp = client.patch(f"/recipes/{created['id']}", json={
            "name": "Curry-Reis (neu)",
            "ingredients": [{"ingredient_id": ing2.id, "amount": 200, "unit": "g"}],
            "tag_ids": [],
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "Curry-Reis (neu)"
        assert len(data["ingredients"]) == 1
        assert data["ingredients"][0]["ingredient"]["name"] == "Curry"

    def test_delete_recipe(self, client, db):
        created = _create_recipe(client, name="Zu löschen")
        resp = client.delete(f"/recipes/{created['id']}")
        assert resp.status_code == 204
        resp = client.get(f"/recipes/{created['id']}")
        assert resp.status_code == 404


class TestImportExport:
    def test_export_import_round_trip(self, client, db):
        ing = Ingredient(name="Zwiebel")
        db.add(ing)
        db.flush()
        _create_recipe(client, name="Zwiebelsuppe", ingredient_id=ing.id)

        export_resp = client.get("/recipes/export")
        assert export_resp.status_code == 200
        exported = export_resp.json()
        assert any(r["name"] == "Zwiebelsuppe" for r in exported)

        # Re-importing the same export should skip the existing recipe by name...
        skip_resp = client.post("/recipes/import", json=exported)
        assert skip_resp.status_code == 200
        assert skip_resp.json()["skipped"] == len(exported)

        # ...but a renamed copy with a brand-new ingredient should be created,
        # auto-creating the missing ingredient (A2 refactor).
        exported[0]["name"] = "Zwiebelsuppe (Kopie)"
        exported[0]["ingredients"] = [{"ingredient_name": "Frühlingszwiebel", "amount": 1, "unit": "Bund"}]
        create_resp = client.post("/recipes/import", json=exported)
        assert create_resp.status_code == 200
        result = create_resp.json()
        assert result["created"] == 1
        new_recipe = db.get(Recipe, result["created_ids"][0])
        assert new_recipe.ingredients[0].ingredient.name == "Frühlingszwiebel"
