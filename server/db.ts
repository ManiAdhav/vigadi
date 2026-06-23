import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(path.join(DATA_DIR, "vigadi.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS ingredients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    normalized_name TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS dishes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ingredient_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    youtube_url TEXT,
    youtube_video_id TEXT,
    dish_type TEXT,
    spice_level TEXT,
    main_ingredients TEXT,
    pairs_with TEXT,
    description TEXT,
    channel_name TEXT,
    discovered_at TEXT DEFAULT (datetime('now')),
    source TEXT DEFAULT 'gemini_grounding',
    FOREIGN KEY (ingredient_id) REFERENCES ingredients(id),
    UNIQUE(ingredient_id, name)
  );

  CREATE TABLE IF NOT EXISTS user_profiles (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    combo_rules TEXT DEFAULT 'Tamil Nadu rules: 1 Kulambu, 2 Sides',
    taste_profile TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS combos (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    dish_ids TEXT NOT NULL,
    sub_components TEXT NOT NULL,
    category TEXT,
    status TEXT DEFAULT 'suggested',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES user_profiles(id)
  );

  CREATE TABLE IF NOT EXISTS feedback (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    dish_id INTEGER,
    combo_id TEXT,
    thumb TEXT NOT NULL,
    feedback_type TEXT,
    notes TEXT,
    metadata TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_dishes_ingredient ON dishes(ingredient_id);
  CREATE INDEX IF NOT EXISTS idx_feedback_user ON feedback(user_id);
`);

export interface DishRow {
  id: number;
  ingredient_id: number;
  name: string;
  youtube_url: string | null;
  youtube_video_id: string | null;
  dish_type: string | null;
  spice_level: string | null;
  main_ingredients: string | null;
  pairs_with: string | null;
  description: string | null;
  channel_name: string | null;
  discovered_at: string;
  source: string;
  ingredient_name?: string;
}

export interface TasteProfile {
  liked_dish_types: Record<string, number>;
  disliked_dish_types: Record<string, number>;
  liked_prep_styles: Record<string, string[]>;
  disliked_prep_styles: Record<string, string[]>;
  preferred_spice: string | null;
  liked_combos: string[];
  disliked_combos: string[];
  ingredient_preferences: Record<string, { preferred: string[]; avoided: string[] }>;
}

function normalizeIngredient(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function upsertIngredient(name: string): number {
  const normalized = normalizeIngredient(name);
  const display = name.trim().charAt(0).toUpperCase() + name.trim().slice(1);
  db.prepare(
    `INSERT INTO ingredients (name, normalized_name) VALUES (?, ?)
     ON CONFLICT(name) DO UPDATE SET normalized_name = excluded.normalized_name`
  ).run(display, normalized);
  const row = db.prepare(`SELECT id FROM ingredients WHERE normalized_name = ?`).get(normalized) as { id: number };
  return row.id;
}

export function getIngredientByName(name: string): { id: number; name: string } | undefined {
  const normalized = normalizeIngredient(name);
  return db.prepare(`SELECT id, name FROM ingredients WHERE normalized_name = ?`).get(normalized) as
    | { id: number; name: string }
    | undefined;
}

export function insertDish(dish: {
  ingredientId: number;
  name: string;
  youtubeUrl?: string;
  youtubeVideoId?: string;
  dishType?: string;
  spiceLevel?: string;
  mainIngredients?: string[];
  pairsWith?: string[];
  description?: string;
  channelName?: string;
  source?: string;
}): number | null {
  try {
    const result = db
      .prepare(
        `INSERT INTO dishes (
          ingredient_id, name, youtube_url, youtube_video_id, dish_type, spice_level,
          main_ingredients, pairs_with, description, channel_name, source
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        dish.ingredientId,
        dish.name,
        dish.youtubeUrl ?? null,
        dish.youtubeVideoId ?? null,
        dish.dishType ?? null,
        dish.spiceLevel ?? null,
        JSON.stringify(dish.mainIngredients ?? []),
        JSON.stringify(dish.pairsWith ?? ["Rice"]),
        dish.description ?? null,
        dish.channelName ?? null,
        dish.source ?? "gemini_grounding"
      );
    return Number(result.lastInsertRowid);
  } catch {
    return null;
  }
}

export function getDishesByIngredientNames(names: string[]): DishRow[] {
  if (names.length === 0) return [];
  const normalized = names.map(normalizeIngredient);
  const placeholders = normalized.map(() => "?").join(",");
  return db
    .prepare(
      `SELECT d.*, i.name as ingredient_name
       FROM dishes d
       JOIN ingredients i ON d.ingredient_id = i.id
       WHERE i.normalized_name IN (${placeholders})
       ORDER BY i.name, d.name`
    )
    .all(...normalized) as DishRow[];
}

export function getDishesGroupedByIngredient(names: string[]): Record<string, DishRow[]> {
  const dishes = getDishesByIngredientNames(names);
  const grouped: Record<string, DishRow[]> = {};
  for (const dish of dishes) {
    const key = dish.ingredient_name ?? "Unknown";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(dish);
  }
  return grouped;
}

export function getDishById(id: number): DishRow | undefined {
  return db
    .prepare(
      `SELECT d.*, i.name as ingredient_name FROM dishes d
       JOIN ingredients i ON d.ingredient_id = i.id WHERE d.id = ?`
    )
    .get(id) as DishRow | undefined;
}

export function getDishesByIds(ids: number[]): DishRow[] {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => "?").join(",");
  return db
    .prepare(
      `SELECT d.*, i.name as ingredient_name FROM dishes d
       JOIN ingredients i ON d.ingredient_id = i.id WHERE d.id IN (${placeholders})`
    )
    .all(...ids) as DishRow[];
}

export function ensureUserProfile(userId: string, username: string): void {
  db.prepare(
    `INSERT INTO user_profiles (id, username) VALUES (?, ?)
     ON CONFLICT(id) DO UPDATE SET username = excluded.username, updated_at = datetime('now')`
  ).run(userId, username);
}

export function getUserProfile(userId: string) {
  return db.prepare(`SELECT * FROM user_profiles WHERE id = ?`).get(userId) as
    | {
        id: string;
        username: string;
        combo_rules: string;
        taste_profile: string;
      }
    | undefined;
}

export function updateUserComboRules(userId: string, rules: string): void {
  db.prepare(
    `UPDATE user_profiles SET combo_rules = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(rules, userId);
}

const DEFAULT_TASTE: TasteProfile = {
  liked_dish_types: {},
  disliked_dish_types: {},
  liked_prep_styles: {},
  disliked_prep_styles: {},
  preferred_spice: null,
  liked_combos: [],
  disliked_combos: [],
  ingredient_preferences: {},
};

export function getTasteProfile(userId: string): TasteProfile {
  const profile = getUserProfile(userId);
  if (!profile) return { ...DEFAULT_TASTE };
  try {
    const parsed = JSON.parse(profile.taste_profile) as Partial<TasteProfile>;
    return { ...DEFAULT_TASTE, ...parsed };
  } catch {
    return { ...DEFAULT_TASTE };
  }
}

export function saveTasteProfile(userId: string, taste: TasteProfile): void {
  db.prepare(
    `UPDATE user_profiles SET taste_profile = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(JSON.stringify(taste), userId);
}

export function insertCombo(combo: {
  id: string;
  userId: string;
  name: string;
  dishIds: number[];
  subComponents: string[];
  category?: string;
  status?: string;
}): void {
  db.prepare(
    `INSERT INTO combos (id, user_id, name, dish_ids, sub_components, category, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    combo.id,
    combo.userId,
    combo.name,
    JSON.stringify(combo.dishIds),
    JSON.stringify(combo.subComponents),
    combo.category ?? "Lunch",
    combo.status ?? "suggested"
  );
}

export function updateComboStatus(comboId: string, status: string): void {
  db.prepare(`UPDATE combos SET status = ? WHERE id = ?`).run(status, comboId);
}

export function insertFeedback(feedback: {
  id: string;
  userId: string;
  dishId?: number;
  comboId?: string;
  thumb: string;
  feedbackType?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}): void {
  db.prepare(
    `INSERT INTO feedback (id, user_id, dish_id, combo_id, thumb, feedback_type, notes, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    feedback.id,
    feedback.userId,
    feedback.dishId ?? null,
    feedback.comboId ?? null,
    feedback.thumb,
    feedback.feedbackType ?? null,
    feedback.notes ?? null,
    feedback.metadata ? JSON.stringify(feedback.metadata) : null
  );
}

export function getFeedbackForUser(userId: string) {
  return db
    .prepare(`SELECT * FROM feedback WHERE user_id = ? ORDER BY created_at DESC`)
    .all(userId);
}

export function parseDishRow(row: DishRow) {
  return {
    id: row.id,
    ingredientName: row.ingredient_name,
    name: row.name,
    youtubeUrl: row.youtube_url,
    youtubeVideoId: row.youtube_video_id,
    dishType: row.dish_type,
    spiceLevel: row.spice_level,
    mainIngredients: row.main_ingredients ? JSON.parse(row.main_ingredients) : [],
    pairsWith: row.pairs_with ? JSON.parse(row.pairs_with) : ["Rice"],
    description: row.description,
    channelName: row.channel_name,
    discoveredAt: row.discovered_at,
    source: row.source,
  };
}

export default db;
