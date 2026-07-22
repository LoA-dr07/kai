"""dedupe duplicate meal plans per week and enforce one plan per week

A client-side race (ensurePlanForWeek checking a possibly-stale cached plan
list before creating a new one) allowed multiple MealPlan rows to be created
for the same week_start_date, causing generate_shopping_list to sum
ingredients from more than one plan for the same week and double-count them.

This migration merges any existing duplicate plans per week_start_date (entries
re-parented onto the lowest-id plan, assigned_users unioned, now-identical
entries de-duplicated) and then adds a unique constraint on week_start_date so
it can't recur.

Revision ID: 0009
Revises: 0008
Create Date: 2026-07-22

"""
from alembic import op
import sqlalchemy as sa

revision = '0009'
down_revision = '0008'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()

    dup_weeks = bind.execute(sa.text(
        "SELECT week_start_date, array_agg(id ORDER BY id) AS ids "
        "FROM meal_plans GROUP BY week_start_date HAVING count(*) > 1"
    )).fetchall()

    for week in dup_weeks:
        ids = week.ids
        canonical, others = ids[0], ids[1:]

        # Re-parent entries from the duplicate plans onto the canonical plan.
        bind.execute(sa.text(
            "UPDATE meal_plan_entries SET meal_plan_id = :canonical "
            "WHERE meal_plan_id = ANY(:others)"
        ), {"canonical": canonical, "others": others})

        # Find entries that are now exact duplicates within the canonical plan
        # (Postgres GROUP BY treats NULLs as equal, so recipe_id/custom_meal
        # NULLs group correctly without extra IS NOT DISTINCT FROM handling).
        dup_entries = bind.execute(sa.text(
            "SELECT array_agg(id ORDER BY id) AS ids FROM meal_plan_entries "
            "WHERE meal_plan_id = :canonical "
            "GROUP BY day_of_week, meal_type, recipe_id, custom_meal "
            "HAVING count(*) > 1"
        ), {"canonical": canonical}).fetchall()

        for group in dup_entries:
            entry_ids = group.ids
            survivor, dupes = entry_ids[0], entry_ids[1:]

            # Union assigned users onto the survivor before deleting the
            # duplicates. ON CONFLICT DO NOTHING avoids violating the
            # (entry_id, user_id) composite PK if the same user was assigned
            # on both the survivor and a duplicate entry.
            bind.execute(sa.text(
                "INSERT INTO meal_plan_entry_users (entry_id, user_id) "
                "SELECT :survivor, user_id FROM meal_plan_entry_users "
                "WHERE entry_id = ANY(:dupes) "
                "ON CONFLICT (entry_id, user_id) DO NOTHING"
            ), {"survivor": survivor, "dupes": dupes})

            # meal_plan_entry_users.entry_id is ON DELETE CASCADE, so its
            # junction rows for the deleted entries disappear automatically.
            bind.execute(sa.text(
                "DELETE FROM meal_plan_entries WHERE id = ANY(:dupes)"
            ), {"dupes": dupes})

        # The duplicate plans are now empty; remove them.
        bind.execute(sa.text(
            "DELETE FROM meal_plans WHERE id = ANY(:others)"
        ), {"others": others})

    op.create_unique_constraint("uq_meal_plans_week_start_date", "meal_plans", ["week_start_date"])


def downgrade():
    op.drop_constraint("uq_meal_plans_week_start_date", "meal_plans", type_="unique")
    # Data cleanup (merging duplicate plans) is not meaningfully reversible.
