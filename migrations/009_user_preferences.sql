-- User preference profile: what the combo-build fallback reads when no food
-- plate or template exists for the requested meal slot.

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}';
