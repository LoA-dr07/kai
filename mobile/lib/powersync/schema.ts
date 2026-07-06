import { column, Schema, Table } from '@powersync/common';

// Mirrors the server-side SQLAlchemy models (backends/app/models/*.py) BY HAND —
// there is no codegen or automated check keeping the two in sync. When you add,
// remove, or rename a column/table in a SQLAlchemy model (and its Alembic
// migration), update the matching Table definition here too, otherwise native
// clients will silently miss the new field. See docs/architecture.md
// ("PowerSync-Integration") for the broader sync-path context.
// PowerSync stores all `id` columns as TEXT automatically.
// Foreign key columns are also TEXT (PowerSync converts integers to strings).

const households = new Table({
  name: column.text,
  settings: column.text,         // JSON-serialized HouseholdSettings
});

const household_members = new Table({
  household_id: column.text,
  user_id: column.text,
});

const users = new Table({
  name: column.text,
  avatar_color: column.text,
  short_name: column.text,
  preferences: column.text,      // JSON-serialized UserPreferences
});

const recipes = new Table({
  name: column.text,
  description: column.text,
  servings: column.integer,
  prep_time_minutes: column.integer,
  source_url: column.text,
  household_id: column.text,
});

const ingredients = new Table({
  name: column.text,
});

const recipe_ingredients = new Table({
  recipe_id: column.text,
  ingredient_id: column.text,
  amount: column.real,
  unit: column.text,
});

const tags = new Table({
  name: column.text,
  is_predefined: column.integer, // 0 or 1 (PostgreSQL boolean → SQLite integer)
  category: column.text,
});

const recipe_tags = new Table({
  recipe_id: column.text,
  tag_id: column.text,
});

const recipe_ratings = new Table({
  recipe_id: column.text,
  user_id: column.text,
  stars: column.integer,
});

const meal_plans = new Table({
  name: column.text,
  week_start_date: column.text,  // ISO date string
  household_id: column.text,
});

const meal_plan_entries = new Table({
  meal_plan_id: column.text,
  day_of_week: column.integer,
  meal_type: column.text,
  recipe_id: column.text,        // nullable
  custom_meal: column.text,      // nullable
  repeat_weekly: column.integer, // 0 or 1 (PostgreSQL boolean → SQLite integer)
});

const meal_plan_entry_users = new Table({
  entry_id: column.text,
  user_id: column.text,
});

export const AppSchema = new Schema({
  households,
  household_members,
  users,
  recipes,
  ingredients,
  recipe_ingredients,
  tags,
  recipe_tags,
  recipe_ratings,
  meal_plans,
  meal_plan_entries,
  meal_plan_entry_users,
});
