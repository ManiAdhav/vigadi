-- Meal templates redesign: dish categories + user template storage

ALTER TABLE dishes ADD COLUMN IF NOT EXISTS dish_category TEXT;

CREATE INDEX IF NOT EXISTS idx_dishes_category ON dishes(dish_category);

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS meal_templates JSONB DEFAULT '[]';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS day_settings JSONB DEFAULT '{"school_weekdays":[1,2,3,4,5],"holiday_override":null}';

-- Backfill dish_category from dish_type where missing
UPDATE dishes SET dish_category = CASE
  WHEN LOWER(dish_type) IN ('gravy','kulambu','kuzhambu','rasam') THEN 'kulambu'
  WHEN LOWER(dish_type) = 'curry' THEN 'curry'
  WHEN LOWER(dish_type) = 'sambar' THEN 'sambar'
  WHEN LOWER(dish_type) IN ('side','fry','poriyal','roast','thoran') THEN 'side_poriyal'
  WHEN LOWER(dish_type) IN ('chutney','pachadi') THEN 'chutney'
  WHEN LOWER(dish_type) IN ('tiffin','idli','dosa','upma') THEN 'tiffin'
  WHEN LOWER(dish_type) IN ('mixed_rice','biryani','pulao') THEN 'mixed_rice'
  WHEN LOWER(dish_type) = 'protein' THEN 'protein'
  ELSE 'side_poriyal'
END
WHERE dish_category IS NULL AND dish_type IS NOT NULL;
