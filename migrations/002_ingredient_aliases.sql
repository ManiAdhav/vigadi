-- Ingredient alias table (canonical + Tamil + transliteration + misspellings)
CREATE TABLE IF NOT EXISTS ingredient_aliases (
  id SERIAL PRIMARY KEY,
  ingredient_slug TEXT NOT NULL,
  alias TEXT NOT NULL,
  normalized_alias TEXT NOT NULL,
  alias_type TEXT NOT NULL DEFAULT 'alias',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (normalized_alias)
);

CREATE INDEX IF NOT EXISTS idx_ingredient_aliases_slug ON ingredient_aliases(ingredient_slug);
CREATE INDEX IF NOT EXISTS idx_ingredient_aliases_normalized ON ingredient_aliases(normalized_alias);

-- Extend ingredients with stable catalog slug
ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS catalog_slug TEXT;

CREATE INDEX IF NOT EXISTS idx_ingredients_catalog_slug ON ingredients(catalog_slug);
