-- Food plates: personal meal plans with weekday scheduling

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS food_plates JSONB DEFAULT '[]';
