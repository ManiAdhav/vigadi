-- Meal logs: what was actually eaten, per user, per day, per meal.
--
-- logged_on is a DATE, not a timestamp: "which day was this meal" is a calendar
-- fact the user picks, so backdating to yesterday must not shift across the
-- IST/UTC boundary. The client sends its own local YYYY-MM-DD.
--
-- user_id has no foreign key because guests log before they ever sign up, so
-- their `user-<timestamp>` id has no users row to point at.

CREATE TABLE IF NOT EXISTS meal_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  logged_on DATE NOT NULL,
  meal_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, logged_on, meal_type)
);

CREATE INDEX IF NOT EXISTS meal_logs_user_date_idx ON meal_logs(user_id, logged_on DESC);

-- One row per dish on the plate. dish_id NULL means she typed a name the
-- catalog does not have, and we keep exactly what she typed.
-- Macros and image are nullable: a hand-typed dish has none, a photo scan fills
-- them, and the daily rings only sum what is actually there.
CREATE TABLE IF NOT EXISTS meal_log_items (
  id BIGSERIAL PRIMARY KEY,
  meal_log_id TEXT NOT NULL REFERENCES meal_logs(id) ON DELETE CASCADE,
  dish_name TEXT NOT NULL,
  dish_id INTEGER,
  position INTEGER NOT NULL DEFAULT 0,
  calories INTEGER,
  carbs INTEGER,
  protein INTEGER,
  fat INTEGER,
  image_url TEXT,
  review TEXT
);

CREATE INDEX IF NOT EXISTS meal_log_items_log_idx ON meal_log_items(meal_log_id);
