-- Excel-aligned dish catalog schema + cutover wipe

ALTER TABLE dishes ADD COLUMN IF NOT EXISTS dish_group TEXT;
ALTER TABLE dishes ADD COLUMN IF NOT EXISTS consistency TEXT;
ALTER TABLE dishes ADD COLUMN IF NOT EXISTS base_tags JSONB DEFAULT '[]';
ALTER TABLE dishes ADD COLUMN IF NOT EXISTS accompaniments JSONB DEFAULT '[]';
ALTER TABLE dishes ADD COLUMN IF NOT EXISTS english_alias TEXT;

CREATE INDEX IF NOT EXISTS idx_dishes_dish_group ON dishes(dish_group);
CREATE INDEX IF NOT EXISTS idx_dishes_consistency ON dishes(consistency);

-- Wipe dish-linked data (FK-safe order)
DELETE FROM selection_events;
DELETE FROM combo_candidates;
DELETE FROM generation_sessions;
DELETE FROM feedback;
DELETE FROM combos;
DELETE FROM user_preferred_combos;
DELETE FROM global_combos;

UPDATE user_profiles SET meal_templates = '[]'::jsonb, food_plates = '[]'::jsonb;

DELETE FROM dishes;
