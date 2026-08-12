import { query, isDatabaseConfigured } from "./pool";
import { normalizeIngredient } from "./ingredientSignature";
import { resolveToCanonical, resolveIngredient } from "./ingredientResolver";
import {
  dishMatchesCategoryFilter,
  effectiveMealGroup,
  normalizeCatalogLabel,
} from "../../shared/mealTemplates";
import {
  expandCatalogIngredients,
  filterDishesByCategory,
} from "../../shared/catalogIngredients";
import {
  memoryUpsertIngredient,
  memoryInsertDish,
  memoryGetDishesByIngredientNames,
  memoryGetDishesForIngredient,
  memoryGetDishCountForIngredient,
  memoryGetDishesByIds,
  memoryGetIngredientByName,
  memoryGetDishById,
  memorySearchDishes,
} from "./memoryStore";

export interface DishRow {
  id: number;
  ingredient_id: number;
  name: string;
  dish_group: string | null;
  dish_category: string | null;
  consistency: string | null;
  base_tags: string | unknown[] | null;
  accompaniments: string | unknown[] | null;
  english_alias: string | null;
  /** Alternate spellings / English names. See migration 008. */
  name_aliases?: string | unknown[] | null;
  youtube_url: string | null;
  youtube_video_id: string | null;
  /** @deprecated */
  dish_type: string | null;
  spice_level: string | null;
  main_ingredients: string | unknown[] | null;
  /** @deprecated */
  pairs_with: string | unknown[] | null;
  description: string | null;
  channel_name: string | null;
  discovered_at: string;
  source: string;
  ingredient_name?: string;
}

export const MIN_CACHED_DISHES = 5;

const BASE_TAG_STAPLE_LABELS: Record<string, string> = {
  rice: "Rice",
  chapati: "Chapati",
  poori: "Poori",
  idli: "Idli",
  dosa: "Dosa",
  parotta: "Parotta",
  idiyappam: "Idiyappam",
  appam: "Appam",
  standalone: "Standalone",
};

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

function baseTagsToStaples(tags: string[]): string[] {
  return tags.map((tag) => BASE_TAG_STAPLE_LABELS[normalizeCatalogLabel(tag)] ?? tag);
}

export function parseDishRow(row: DishRow) {
  const baseTags = parseJsonArray(row.base_tags) as string[];
  const legacyPairs = parseJsonArray(row.pairs_with) as string[];
  const pairsWith = baseTags.length > 0 ? baseTagsToStaples(baseTags) : legacyPairs.length ? legacyPairs : ["Rice"];

  return {
    id: row.id,
    ingredientName: row.ingredient_name,
    name: row.name,
    dishGroup: row.dish_group,
    dishCategory: row.dish_category,
    consistency: row.consistency,
    baseTags,
    accompaniments: parseJsonArray(row.accompaniments) as string[],
    englishAlias: row.english_alias,
    nameAliases: parseJsonArray(row.name_aliases) as string[],
    youtubeUrl: row.youtube_url,
    youtubeVideoId: row.youtube_video_id,
    dishType: row.dish_category ?? row.dish_type,
    spiceLevel: row.spice_level,
    mainIngredients: parseJsonArray(row.main_ingredients) as string[],
    pairsWith,
    description: row.description,
    channelName: row.channel_name,
    discoveredAt: row.discovered_at,
    source: row.source,
  };
}

export async function upsertIngredient(name: string): Promise<number> {
  const canonical = resolveToCanonical(name);
  const catalogSlug = resolveIngredient(name)?.id ?? null;
  if (!isDatabaseConfigured()) return memoryUpsertIngredient(canonical);
  const normalized = normalizeIngredient(canonical);
  const display = canonical;
  const result = await query<{ id: number }>(
    `INSERT INTO ingredients (name, normalized_name, catalog_slug) VALUES ($1, $2, $3)
     ON CONFLICT (normalized_name) DO UPDATE SET name = EXCLUDED.name, catalog_slug = EXCLUDED.catalog_slug
     RETURNING id`,
    [display, normalized, catalogSlug]
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
  dishGroup?: string;
  dishCategory?: string;
  consistency?: string;
  baseTags?: string[];
  accompaniments?: string[];
  englishAlias?: string;
  nameAliases?: string[];
  youtubeUrl?: string;
  youtubeVideoId?: string;
  spiceLevel?: string;
  mainIngredients?: string[];
  description?: string;
  channelName?: string;
  source?: string;
}): Promise<number | null> {
  if (!isDatabaseConfigured()) return memoryInsertDish(dish);
  try {
    const result = await query<{ id: number }>(
      `INSERT INTO dishes (
        ingredient_id, name, dish_group, dish_category, consistency,
        base_tags, accompaniments, english_alias, name_aliases, youtube_url, youtube_video_id,
        spice_level, main_ingredients, description, channel_name, source
      ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9::jsonb, $10, $11, $12, $13::jsonb, $14, $15, $16)
      ON CONFLICT (ingredient_id, name) DO NOTHING
      RETURNING id`,
      [
        dish.ingredientId,
        dish.name,
        dish.dishGroup ?? null,
        dish.dishCategory ?? null,
        dish.consistency ?? null,
        JSON.stringify(dish.baseTags ?? []),
        JSON.stringify(dish.accompaniments ?? []),
        dish.englishAlias ?? null,
        JSON.stringify(dish.nameAliases ?? []),
        dish.youtubeUrl ?? null,
        dish.youtubeVideoId ?? null,
        dish.spiceLevel ?? null,
        JSON.stringify(dish.mainIngredients ?? []),
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

export async function getCatalogDishesForBuild(params: {
  ingredients: string[];
  includesRice?: boolean;
  template?: import("../../shared/mealTemplates").MealTemplate;
  mealSlot?: import("../../shared/mealTemplates").MealSlot;
  dishCategory?: import("../../shared/mealTemplates").DishCategory;
}): Promise<DishRow[]> {
  const queryIngredients = expandCatalogIngredients(params.ingredients, {
    includesRice: params.includesRice,
    template: params.template,
    mealSlot: params.mealSlot,
  });
  const dishes = await getDishesByIngredientNames(queryIngredients);
  return filterDishesByCategory(dishes, params.dishCategory);
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

export async function searchDishes(
  queryText: string,
  limit = 10,
  category?: string
): Promise<DishRow[]> {
  const q = queryText.trim();
  if (!q) return [];
  const fetchLimit = category ? limit * 4 : limit;
  let rows: DishRow[];
  if (!isDatabaseConfigured()) {
    rows = memorySearchDishes(q, fetchLimit);
  } else {
    const pattern = `%${q}%`;
    const prefix = `${q}%`;
    // An alias has to rank alongside the real name, not below it — otherwise
    // typing "Rice" buries plain Sadam under 21 variety rices.
    const result = await query<DishRow>(
      `SELECT d.*, i.name as ingredient_name
       FROM dishes d
       JOIN ingredients i ON d.ingredient_id = i.id
       WHERE d.name ILIKE $1 OR i.name ILIKE $1
          OR d.dish_group ILIKE $1 OR d.dish_category ILIKE $1
          OR d.english_alias ILIKE $1
          OR EXISTS (
            SELECT 1 FROM jsonb_array_elements_text(COALESCE(d.name_aliases, '[]'::jsonb)) a
            WHERE a ILIKE $1
          )
       ORDER BY
         CASE
           WHEN lower(d.name) = $4 THEN 0
           WHEN EXISTS (
             SELECT 1 FROM jsonb_array_elements_text(COALESCE(d.name_aliases, '[]'::jsonb)) a
             WHERE lower(a) = $4
           ) THEN 0
           WHEN d.name ILIKE $2 THEN 1
           WHEN EXISTS (
             SELECT 1 FROM jsonb_array_elements_text(COALESCE(d.name_aliases, '[]'::jsonb)) a
             WHERE a ILIKE $2
           ) THEN 1
           WHEN d.name ILIKE $1 THEN 2
           WHEN EXISTS (
             SELECT 1 FROM jsonb_array_elements_text(COALESCE(d.name_aliases, '[]'::jsonb)) a
             WHERE a ILIKE $1
           ) THEN 3
           WHEN i.name ILIKE $2 THEN 4
           ELSE 5
         END,
         d.name
       LIMIT $3`,
      [pattern, prefix, fetchLimit, q.toLowerCase()]
    );
    rows = result.rows;
  }
  if (category) {
    rows = rows.filter((d) => dishMatchesCategoryFilter(d, category));
  }
  return rows.slice(0, limit);
}

export { effectiveMealGroup };
