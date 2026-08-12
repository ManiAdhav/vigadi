-- What actually went into each logged dish.
--
-- "Sambar" is not one dish: it is carrot and beans one day, chow chow the next.
-- The ingredients therefore hang off the log item, not off the dish catalog,
-- and every entry keeps that day's version.
--
-- ingredients is JSONB rather than a child table because it is always read and
-- written whole, with the dish, and never queried a row at a time. Each element
-- is {raw, canonical, matched}: raw is exactly what was typed, canonical is the
-- catalog name when we are sure, and matched is false for ingredients the
-- 110-item catalog does not have yet (tamarind, coconut, sambar powder).
--
-- ingredient_signature is the sorted canonical set, so "the same dish made the
-- same way" is a plain equality check — used today to offer her own last
-- version back, and later to match one cook's sambar against another's.

ALTER TABLE meal_log_items
  ADD COLUMN IF NOT EXISTS ingredients JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ingredient_signature TEXT;

-- Looking up past versions of a dish by name is the one new read path.
CREATE INDEX IF NOT EXISTS meal_log_items_dish_name_idx
  ON meal_log_items (LOWER(dish_name));
