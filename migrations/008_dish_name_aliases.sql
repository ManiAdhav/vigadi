-- Alternate spellings and English names for a dish, so "Egg Podimas" finds
-- "Muttai Podimas" and "Chappathi" finds "Chapati".
--
-- Deliberately NOT english_alias: that column holds a category label
-- ("Curry", "Breakfast", "Stir Fry") which the slot matcher reads, so
-- overwriting it would break dish_type matching.

-- No index: the search matches aliases with ILIKE, which a GIN jsonb index
-- cannot serve, and the table is under a thousand rows.

ALTER TABLE dishes ADD COLUMN IF NOT EXISTS name_aliases JSONB DEFAULT '[]';
