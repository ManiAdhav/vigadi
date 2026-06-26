import { query, isDatabaseConfigured } from "./pool";
import { normalizeIngredient } from "./ingredientSignature";
import { resolveToCanonical } from "./ingredientResolver";
import {
  memoryUpsertIngredient,
  memoryInsertDish,
  memoryGetDishesByIngredientNames,
  memoryGetDishesForIngredient,
  memoryGetDishCountForIngredient,
  memoryGetDishesByIds,
  memoryGetIngredientByName,
  memoryGetDishById,
} from "./memoryStore";

export interface DishRow {
  id: number;
  ingredient_id: number;
  name: string;
  youtube_url: string | null;
  youtube_video_id: string | null;
  dish_type: string | null;
  spice_level: string | null;
  main_ingredients: string | unknown[] | null;
  pairs_with: string | unknown[] | null;
  description: string | null;
  channel_name: string | null;
  discovered_at: string;
  source: string;
  ingredient_name?: string;
}

export const MIN_CACHED_DISHES = 5;

function parseJsonArray(value: string | unknown[] | null | undefined): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return [];
    }
  }
  return [];
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
    mainIngredients: parseJsonArray(row.main_ingredients) as string[],
    pairsWith: (parseJsonArray(row.pairs_with).length ? parseJsonArray(row.pairs_with) : ["Rice"]) as string[],
    description: row.description,
    channelName: row.channel_name,
    discoveredAt: row.discovered_at,
    source: row.source,
  };
}

export async function upsertIngredient(name: string): Promise<number> {
  const canonical = resolveToCanonical(name);
  if (!isDatabaseConfigured()) return memoryUpsertIngredient(canonical);
  const normalized = normalizeIngredient(canonical);
  const display = canonical;
  const result = await query<{ id: number }>(
    `INSERT INTO ingredients (name, normalized_name) VALUES ($1, $2)
     ON CONFLICT (normalized_name) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [display, normalized]
  );
  return result.rows[0].id;
}

export async function getIngredientByName(name: string): Promise<{ id: number; name: string } | undefined> {
  const canonical = resolveToCanonical(name);
  if (!isDatabaseConfigured()) return memoryGetIngredientByName(canonical);
  const normalized = normalizeIngredient(canonical);
  const result = await query<{ id: number; name: string }>(
    `SELECT id, name FROM ingredients WHERE normalized_name = $1`,
    [normalized]
  );
  return result.rows[0];
}

export async function insertDish(dish: {
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
}): Promise<number | null> {
  if (!isDatabaseConfigured()) return memoryInsertDish(dish);
  try {
    const result = await query<{ id: number }>(
      `INSERT INTO dishes (
        ingredient_id, name, youtube_url, youtube_video_id, dish_type, spice_level,
        main_ingredients, pairs_with, description, channel_name, source
      ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10, $11)
      ON CONFLICT (ingredient_id, name) DO NOTHING
      RETURNING id`,
      [
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
        dish.source ?? "gemini_grounding",
      ]
    );
    return result.rows[0]?.id ?? null;
  } catch {
    return null;
  }
}

export async function getDishesByIngredientNames(names: string[]): Promise<DishRow[]> {
  const canonicalNames = names.map(resolveToCanonical);
  if (!isDatabaseConfigured()) return memoryGetDishesByIngredientNames(canonicalNames);
  if (canonicalNames.length === 0) return [];
  const normalized = canonicalNames.map(normalizeIngredient);
  const placeholders = normalized.map((_, i) => `$${i + 1}`).join(",");
  const result = await query<DishRow>(
    `SELECT d.*, i.name as ingredient_name
     FROM dishes d
     JOIN ingredients i ON d.ingredient_id = i.id
     WHERE i.normalized_name IN (${placeholders})
     ORDER BY i.name, d.name`,
    normalized
  );
  return result.rows;
}

export async function getDishesGroupedByIngredient(names: string[]): Promise<Record<string, DishRow[]>> {
  const dishes = await getDishesByIngredientNames(names);
  const grouped: Record<string, DishRow[]> = {};
  for (const dish of dishes) {
    const key = dish.ingredient_name ?? "Unknown";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(dish);
  }
  return grouped;
}

export async function getDishCountForIngredient(ingredientName: string): Promise<number> {
  const canonical = resolveToCanonical(ingredientName);
  if (!isDatabaseConfigured()) return memoryGetDishCountForIngredient(canonical);
  const normalized = normalizeIngredient(canonical);
  const result = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM dishes d
     JOIN ingredients i ON d.ingredient_id = i.id
     WHERE i.normalized_name = $1`,
    [normalized]
  );
  return Number(result.rows[0]?.count ?? 0);
}

export async function hasSufficientCachedDishes(
  ingredientName: string,
  min = MIN_CACHED_DISHES
): Promise<boolean> {
  const count = await getDishCountForIngredient(ingredientName);
  return count >= min;
}

export async function getDishesForIngredient(ingredientName: string): Promise<DishRow[]> {
  const canonical = resolveToCanonical(ingredientName);
  if (!isDatabaseConfigured()) return memoryGetDishesForIngredient(canonical);
  const normalized = normalizeIngredient(canonical);
  const result = await query<DishRow>(
    `SELECT d.*, i.name as ingredient_name
     FROM dishes d
     JOIN ingredients i ON d.ingredient_id = i.id
     WHERE i.normalized_name = $1
     ORDER BY d.name`,
    [normalized]
  );
  return result.rows;
}

export async function getDishById(id: number): Promise<DishRow | undefined> {
  if (!isDatabaseConfigured()) return memoryGetDishById(id);
  const result = await query<DishRow>(
    `SELECT d.*, i.name as ingredient_name FROM dishes d
     JOIN ingredients i ON d.ingredient_id = i.id WHERE d.id = $1`,
    [id]
  );
  return result.rows[0];
}

export async function getDishesByIds(ids: number[]): Promise<DishRow[]> {
  if (!isDatabaseConfigured()) return memoryGetDishesByIds(ids);
  if (ids.length === 0) return [];
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(",");
  const result = await query<DishRow>(
    `SELECT d.*, i.name as ingredient_name FROM dishes d
     JOIN ingredients i ON d.ingredient_id = i.id WHERE d.id IN (${placeholders})`,
    ids
  );
  return result.rows;
}
