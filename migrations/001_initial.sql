-- Layer 1: Catalog
CREATE TABLE IF NOT EXISTS ingredients (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  normalized_name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dishes (
  id SERIAL PRIMARY KEY,
  ingredient_id INT NOT NULL REFERENCES ingredients(id),
  name TEXT NOT NULL,
  youtube_url TEXT,
  youtube_video_id TEXT,
  dish_type TEXT,
  spice_level TEXT,
  main_ingredients JSONB DEFAULT '[]',
  pairs_with JSONB DEFAULT '["Rice"]',
  description TEXT,
  channel_name TEXT,
  discovered_at TIMESTAMPTZ DEFAULT NOW(),
  source TEXT DEFAULT 'gemini_grounding',
  UNIQUE (ingredient_id, name)
);

CREATE INDEX IF NOT EXISTS idx_dishes_ingredient ON dishes(ingredient_id);

-- Layer 2: User learning
CREATE TABLE IF NOT EXISTS user_profiles (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  combo_rules TEXT DEFAULT 'Tamil Nadu rules: 1 Kulambu, 2 Sides',
  taste_profile JSONB DEFAULT '{}',
  city_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user_profiles(id),
  dish_id INT REFERENCES dishes(id),
  combo_id TEXT,
  thumb TEXT NOT NULL,
  feedback_type TEXT,
  notes TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_user ON feedback(user_id);

CREATE TABLE IF NOT EXISTS user_preferred_combos (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user_profiles(id),
  global_combo_id INT,
  dish_ids JSONB NOT NULL,
  name TEXT NOT NULL,
  ingredient_signature TEXT NOT NULL,
  selected_at TIMESTAMPTZ DEFAULT NOW()
);

-- Layer 3: Global combo pool
CREATE TABLE IF NOT EXISTS global_combos (
  id SERIAL PRIMARY KEY,
  ingredient_signature TEXT NOT NULL,
  dish_ids JSONB NOT NULL,
  combo_name TEXT NOT NULL,
  sub_components JSONB NOT NULL,
  selection_count INT NOT NULL DEFAULT 1,
  city_code TEXT,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_selected_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_global_combos_unique
  ON global_combos (ingredient_signature, dish_ids, COALESCE(city_code, ''));

CREATE INDEX IF NOT EXISTS idx_global_combos_signature ON global_combos(ingredient_signature);
CREATE INDEX IF NOT EXISTS idx_global_combos_city ON global_combos(city_code);

-- Layer 4: Training events
CREATE TABLE IF NOT EXISTS generation_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user_profiles(id),
  ingredient_signature TEXT NOT NULL,
  ingredients JSONB NOT NULL,
  combo_rules TEXT,
  category TEXT,
  slots_requested INT DEFAULT 2,
  slots_from_global INT DEFAULT 0,
  slots_generated INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS combo_candidates (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES generation_sessions(id),
  combo_name TEXT NOT NULL,
  dish_ids JSONB NOT NULL,
  source TEXT NOT NULL,
  global_combo_id INT REFERENCES global_combos(id),
  score NUMERIC,
  rank INT,
  shown_to_user BOOLEAN DEFAULT TRUE,
  rationale TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS selection_events (
  id TEXT PRIMARY KEY,
  session_id TEXT REFERENCES generation_sessions(id),
  user_id TEXT NOT NULL REFERENCES user_profiles(id),
  selected_combo_id TEXT NOT NULL,
  rejected_combo_id TEXT,
  dish_ids JSONB NOT NULL,
  rejected_dish_ids JSONB,
  global_combo_id INT REFERENCES global_combos(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Legacy combos table
CREATE TABLE IF NOT EXISTS combos (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user_profiles(id),
  name TEXT NOT NULL,
  dish_ids JSONB NOT NULL,
  sub_components JSONB NOT NULL,
  category TEXT,
  status TEXT DEFAULT 'suggested',
  source TEXT DEFAULT 'generated',
  global_combo_id INT REFERENCES global_combos(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
