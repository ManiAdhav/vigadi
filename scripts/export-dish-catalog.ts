import fs from "fs";
import path from "path";
import pg from "pg";
import dotenv from "dotenv";
import {
  formatCategoryLabel,
  formatDishTypeLabel,
  resolveDishType,
  resolveMealGroup,
} from "../shared/mealTemplates";

dotenv.config({ path: ".env.local" });
dotenv.config();

interface CatalogDishBlock {
  ingredientId?: string;
  ingredientCanonical?: string;
  dishes: Array<{
    name: string;
    dishType?: string;
    spiceLevel?: string;
    mainIngredients?: string[];
    pairsWith?: string[];
    description?: string;
    youtubeUrl?: string | null;
    channelName?: string | null;
  }>;
}

export interface ExportedDishRow {
  id: number | null;
  dish_name: string;
  ingredient_id: number | null;
  ingredient_name: string;
  ingredient_catalog_slug: string | null;
  dish_type_raw: string | null;
  dish_type_canonical: string;
  dish_type_label: string;
  dish_category_db: string | null;
  dish_group: string;
  dish_group_label: string;
  spice_level: string | null;
  main_ingredients: string;
  pairs_with: string;
  description: string | null;
  youtube_url: string | null;
  youtube_video_id: string | null;
  channel_name: string | null;
  source: string | null;
  discovered_at: string | null;
}

export interface ExportedIngredientRow {
  id: number | null;
  name: string;
  normalized_name: string | null;
  catalog_slug: string | null;
  created_at: string | null;
  dish_count: number;
}

function enrichDish(row: {
  id?: number | null;
  name: string;
  ingredient_id?: number | null;
  ingredient_name?: string | null;
  ingredient_catalog_slug?: string | null;
  dish_type?: string | null;
  dish_category?: string | null;
  spice_level?: string | null;
  main_ingredients?: string[] | null;
  pairs_with?: string[] | null;
  description?: string | null;
  youtube_url?: string | null;
  youtube_video_id?: string | null;
  channel_name?: string | null;
  source?: string | null;
  discovered_at?: string | null;
}): ExportedDishRow {
  const canonical = resolveDishType(row.dish_type, row.name);
  const group = resolveMealGroup(row.dish_type, row.name);
  return {
    id: row.id ?? null,
    dish_name: row.name,
    ingredient_id: row.ingredient_id ?? null,
    ingredient_name: row.ingredient_name ?? "",
    ingredient_catalog_slug: row.ingredient_catalog_slug ?? null,
    dish_type_raw: row.dish_type ?? null,
    dish_type_canonical: canonical,
    dish_type_label: formatDishTypeLabel(canonical),
    dish_category_db: row.dish_category ?? null,
    dish_group: row.dish_category ?? group,
    dish_group_label: formatCategoryLabel((row.dish_category as never) ?? group),
    spice_level: row.spice_level ?? null,
    main_ingredients: (row.main_ingredients ?? []).join("; "),
    pairs_with: (row.pairs_with ?? []).join("; "),
    description: row.description ?? null,
    youtube_url: row.youtube_url ?? null,
    youtube_video_id: row.youtube_video_id ?? null,
    channel_name: row.channel_name ?? null,
    source: row.source ?? null,
    discovered_at: row.discovered_at ?? null,
  };
}

function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

async function loadFromDatabase(): Promise<{
  dishes: ExportedDishRow[];
  ingredients: ExportedIngredientRow[];
}> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");

  const client = new pg.Client({
    connectionString: url,
    ssl: url.includes("localhost") ? false : { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    const dishResult = await client.query<{
      id: number;
      ingredient_id: number;
      ingredient_name: string;
      catalog_slug: string | null;
      name: string;
      dish_type: string | null;
      dish_category: string | null;
      spice_level: string | null;
      main_ingredients: unknown;
      pairs_with: unknown;
      description: string | null;
      youtube_url: string | null;
      youtube_video_id: string | null;
      channel_name: string | null;
      source: string | null;
      discovered_at: string | null;
    }>(
      `SELECT
         d.id,
         d.ingredient_id,
         i.name AS ingredient_name,
         i.catalog_slug,
         d.name,
         d.dish_type,
         d.dish_category,
         d.spice_level,
         d.main_ingredients,
         d.pairs_with,
         d.description,
         d.youtube_url,
         d.youtube_video_id,
         d.channel_name,
         d.source,
         d.discovered_at
       FROM dishes d
       JOIN ingredients i ON i.id = d.ingredient_id
       ORDER BY i.name, d.name`
    );

    const ingredientResult = await client.query<{
      id: number;
      name: string;
      normalized_name: string;
      catalog_slug: string | null;
      created_at: string | null;
      dish_count: string;
    }>(
      `SELECT
         i.id,
         i.name,
         i.normalized_name,
         i.catalog_slug,
         i.created_at,
         COUNT(d.id)::text AS dish_count
       FROM ingredients i
       LEFT JOIN dishes d ON d.ingredient_id = i.id
       GROUP BY i.id
       ORDER BY i.name`
    );

    return {
      dishes: dishResult.rows.map((row) =>
        enrichDish({
          id: row.id,
          name: row.name,
          ingredient_id: row.ingredient_id,
          ingredient_name: row.ingredient_name,
          ingredient_catalog_slug: row.catalog_slug,
          dish_type: row.dish_type,
          dish_category: row.dish_category,
          spice_level: row.spice_level,
          main_ingredients: parseJsonArray(row.main_ingredients),
          pairs_with: parseJsonArray(row.pairs_with),
          description: row.description,
          youtube_url: row.youtube_url,
          youtube_video_id: row.youtube_video_id,
          channel_name: row.channel_name,
          source: row.source,
          discovered_at: row.discovered_at,
        })
      ),
      ingredients: ingredientResult.rows.map((row) => ({
        id: row.id,
        name: row.name,
        normalized_name: row.normalized_name,
        catalog_slug: row.catalog_slug,
        created_at: row.created_at,
        dish_count: Number(row.dish_count),
      })),
    };
  } finally {
    await client.end();
  }
}

function loadFromCatalogJson(catalogPath: string): {
  dishes: ExportedDishRow[];
  ingredients: ExportedIngredientRow[];
} {
  const blocks = JSON.parse(fs.readFileSync(catalogPath, "utf8")) as CatalogDishBlock[];
  const ingredientCounts = new Map<string, number>();
  const dishes: ExportedDishRow[] = [];

  for (const block of blocks) {
    const ingredientName = block.ingredientCanonical ?? block.ingredientId ?? "Unknown";
    const slug = block.ingredientId ?? null;
    ingredientCounts.set(ingredientName, (ingredientCounts.get(ingredientName) ?? 0) + block.dishes.length);

    for (const dish of block.dishes) {
      dishes.push(
        enrichDish({
          name: dish.name,
          ingredient_name: ingredientName,
          ingredient_catalog_slug: slug,
          dish_type: dish.dishType ?? null,
          dish_category: null,
          spice_level: dish.spiceLevel ?? null,
          main_ingredients: dish.mainIngredients ?? [],
          pairs_with: dish.pairsWith ?? [],
          description: dish.description ?? null,
          youtube_url: dish.youtubeUrl ?? null,
          channel_name: dish.channelName ?? null,
          source: "catalog_json",
        })
      );
    }
  }

  dishes.sort((a, b) =>
    a.ingredient_name.localeCompare(b.ingredient_name) || a.dish_name.localeCompare(b.dish_name)
  );

  const ingredients: ExportedIngredientRow[] = [...ingredientCounts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, dish_count], index) => ({
      id: index + 1,
      name,
      normalized_name: name.toLowerCase(),
      catalog_slug: blocks.find((b) => (b.ingredientCanonical ?? b.ingredientId) === name)?.ingredientId ?? null,
      created_at: null,
      dish_count,
    }));

  return { dishes, ingredients };
}

function csvEscape(value: string | number | null | undefined): string {
  const text = value == null ? "" : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function rowsToCsv<T extends object>(rows: T[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => csvEscape(row[h] as string | number | null)).join(",")),
  ];
  return lines.join("\n");
}

async function main() {
  const outDir = path.resolve(process.argv[2] ?? "exports");
  fs.mkdirSync(outDir, { recursive: true });

  let source = "database";
  let data: { dishes: ExportedDishRow[]; ingredients: ExportedIngredientRow[] };

  try {
    data = await loadFromDatabase();
  } catch (err) {
    const catalogPath = path.resolve("data/dishes-catalog.json");
    console.warn(`Database export failed (${(err as Error).message}). Using ${catalogPath}`);
    source = "catalog_json";
    data = loadFromCatalogJson(catalogPath);
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const prefix = path.join(outDir, `vigadi-catalog-${stamp}`);

  const payload = {
    exported_at: new Date().toISOString(),
    source,
    dish_count: data.dishes.length,
    ingredient_count: data.ingredients.length,
    dishes: data.dishes,
    ingredients: data.ingredients,
  };

  const jsonPath = `${prefix}.json`;
  const dishesCsvPath = `${prefix}-dishes.csv`;
  const ingredientsCsvPath = `${prefix}-ingredients.csv`;

  fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2));
  fs.writeFileSync(dishesCsvPath, rowsToCsv(data.dishes));
  fs.writeFileSync(ingredientsCsvPath, rowsToCsv(data.ingredients));

  console.log(`\nExport complete (${source}):`);
  console.log(`  ${data.dishes.length} dishes, ${data.ingredients.length} ingredients`);
  console.log(`\nFiles written to ${outDir}/`);
  console.log(`  JSON (all tables):     vigadi-catalog-${stamp}.json`);
  console.log(`  CSV dishes (Excel):    vigadi-catalog-${stamp}-dishes.csv`);
  console.log(`  CSV ingredients:       vigadi-catalog-${stamp}-ingredients.csv`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
