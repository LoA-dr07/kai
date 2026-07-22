"""dedupe pre-existing exact-duplicate meal plan entries within a single plan

Separately from 0009 (which merged entries scattered across duplicate MealPlan
rows for the same week), a small number of meal_plan_entries were already
exact duplicates *within* a single plan (same day_of_week + meal_type +
recipe_id/custom_meal + identical assigned_users) — likely from an unrelated
earlier double-submit. These also cause generate_shopping_list to double-count
ingredients.

This intentionally does NOT collapse entries that share the same slot/recipe
but have DIFFERENT assigned_users — the AI meal-plan suggestion flow (see
app/routers/ai.py's system prompt) deliberately creates separate entries per
person when household members have different constraints but land on the same
recipe, and each needs its own portion-scaled contribution to the shopping
list.

Revision ID: 0010
Revises: 0009
Create Date: 2026-07-22

"""
from alembic import op
import sqlalchemy as sa

revision = '0010'
down_revision = '0009'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()

    dup_entry_groups = bind.execute(sa.text(
        "SELECT array_agg(id ORDER BY id) AS ids FROM meal_plan_entries "
        "GROUP BY meal_plan_id, day_of_week, meal_type, recipe_id, custom_meal "
        "HAVING count(*) > 1"
    )).fetchall()

    for group in dup_entry_groups:
        entry_ids = group.ids

        user_rows = bind.execute(sa.text(
            "SELECT entry_id, user_id FROM meal_plan_entry_users WHERE entry_id = ANY(:ids)"
        ), {"ids": entry_ids}).fetchall()
        users_by_entry = {}
        for row in user_rows:
            users_by_entry.setdefault(row.entry_id, set()).add(row.user_id)

        # Only collapse entries that share the identical assigned-user set —
        # a true accidental duplicate. Entries with differing assigned users
        # are a deliberate per-person split and must stay separate.
        by_users = {}
        for eid in entry_ids:
            key = frozenset(users_by_entry.get(eid, set()))
            by_users.setdefault(key, []).append(eid)

        for same_user_ids in by_users.values():
            if len(same_user_ids) < 2:
                continue
            same_user_ids.sort()
            dupes = same_user_ids[1:]
            bind.execute(sa.text(
                "DELETE FROM meal_plan_entries WHERE id = ANY(:dupes)"
            ), {"dupes": dupes})


def downgrade():
    # Data cleanup is not meaningfully reversible; no schema change to undo.
    pass
