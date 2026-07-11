import fs from "fs";
import path from "path";
import pg from "pg";
import dotenv from "dotenv";
import { extractYouTubeVideoId } from "../server/jsonUtils";
import { resolveDishCategory } from "../shared/mealTemplates";
import {
  type DishSeed,
  type IngredientDishBlock,
  resolveIngredientId,
} from "./parse-dish-rtf";

dotenv.config({ path: ".env.local" });
dotenv.config();

const DEFAULT_INGREDIENT_SLUG = "rice";
const DEFAULT_SOURCE = "mixed_rice_catalog";
const DEFAULT_JSON = path.join(
  process.cwd(),
  "data/staging/dishes-with-yt-mixed-rices-tamil-nadu.json"
);

type RawDish = Partial<DishSeed> & {
  youtube_url?: string;
  dish_type?: string;
  spice_level?: string;
  main_ingredients?: string[];
  pairs_with?: string[];
  channel_name?: string;
};

function normalizeDish(raw: RawDish): DishSeed {
  const dishType = (raw.dishType ?? raw.dish_type ?? "mixed_rice").trim();
  return {
    name: raw.name?.trim() ?? "",
    youtubeUrl: raw.youtubeUrl ?? raw.youtube_url ?? "",
    dishType,
    spiceLevel: raw.spiceLevel ?? raw.spice_level ?? "medium",
    mainIngredients: raw.mainIngredients ?? raw.main_ingredients ?? [],
    pairsWith: raw.pairsWith ?? raw.pairs_with ?? [],
    description: raw.description ?? "",
    channelName: raw.channelName ?? raw.channel_name,
  };
}

function parsePayload(text: string): IngredientDishBlock[] {
  const payload = JSON.parse(text) as unknown;

  if (Array.isArray(payload)) {
    if (payload.length === 0) return [];

    const first = payload[0] as Record<string, unknown>;
    if ("ingredientId" in first && "dishes" in first) {
      return (payload as IngredientDishBlock[]).map((block) => ({
        ingredientId: block.ingredientId,
        ingredientCanonical: block.ingredientCanonical,
        dishes: block.dishes.map((dish) => normalizeDish(dish)),
      }));
    }

    return [
      {
        ingredientId: DEFAULT_INGREDIENT_SLUG,
        ingredientCanonical: "Rice",
        dishes: (payload as RawDish[]).map((dish) => normalizeDish(dish)),
      },
    ];
  }

  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    if (Array.isArray(record.dishes)) {
      return [
        {
          ingredientId:
            typeof record.ingredientId === "string"
              ? record.ingredientId
              : DEFAULT_INGREDIENT_SLUG,
          ingredientCanonical:
            typeof record.ingredientCanonical === "string"
              ? record.ingredientCanonical
              : "Rice",
          dishes: (record.dishes as RawDish[]).map((dish) => normalizeDish(dish)),
        },
      ];
    }
  }

  throw new Error(
    "Unsupported JSON shape. Expected IngredientDishBlock[], DishSeed[], or { dishes: [...] }."
  );
}

function loadBlocks(filePath: string): IngredientDishBlock[] {
  if (!fs.existsSync(filePath)) {
    console.error(`Mixed rice file not found: ${filePath}`);
    console.error(
      "Copy your local file to data/staging/dishes-with-yt-mixed-rices-tamil-nadu.json or pass a path."
    );
    process.exit(1);
  }

  const text = fs.readFileSync(filePath, "utf8");
  const blocks = parsePayload(text);

  for (const block of blocks) {
    block.dishes = block.dishes.filter((dish) => dish.name);
    for (const dish of block.dishes) {
      if (!dish.dishType) dish.dishType = "mixed_rice";
    }
  }

  return blocks.filter((block) => block.dishes.length > 0);
}

async function syncBlock(
  client: pg.Client,
  block: IngredientDishBlock
): Promise<{ inserted: number; updated: number; removed: number; missing: boolean }> {
  const catalogId = resolveIngredientId(block.ingredientId) ?? block.ingredientId;
  const ingredient = await client.query<{ id: number; name: string }>(
    `SELECT id, name FROM ingredients WHERE catalog_slug = $1`,
    [catalogId]
  );

  if (!ingredient.rows[0]) {
    console.warn(`  ✗ No DB ingredient for catalog slug: ${catalogId}`);
    return { inserted: 0, updated: 0, removed: 0, missing: true };
  }

  const ingredientId = ingredient.rows[0].id;
  const ingredientName = ingredient.rows[0].name;
  let inserted = 0;
  let updated = 0;

  await client.query("BEGIN");

  try {
    for (const dish of block.dishes) {
      const videoId = extractYouTubeVideoId(dish.youtubeUrl ?? "");
      const dishCategory = resolveDishCategory(dish.dishType, dish.name);
      const pairsWith = dish.pairsWith?.length ? dish.pairsWith : [];

      const result = await client.query<{ id: number; xmax: string }>(
        `INSERT INTO dishes (
          ingredient_id, name, youtube_url, youtube_video_id, dish_type, dish_category, spice_level,
          main_ingredients, pairs_with, description, channel_name, source
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10, $11, $12)
        ON CONFLICT (ingredient_id, name) DO UPDATE SET
          youtube_url = EXCLUDED.youtube_url,
          youtube_video_id = EXCLUDED.youtube_video_id,
          dish_type = EXCLUDED.dish_type,
          dish_category = EXCLUDED.dish_category,
          spice_level = EXCLUDED.spice_level,
          main_ingredients = EXCLUDED.main_ingredients,
          pairs_with = EXCLUDED.pairs_with,
          description = EXCLUDED.description,
          channel_name = EXCLUDED.channel_name,
          source = EXCLUDED.source
        RETURNING id, xmax`,
        [
          ingredientId,
          dish.name,
          dish.youtubeUrl ?? null,
          videoId,
          dish.dishType,
          dishCategory,
          dish.spiceLevel,
          JSON.stringify(dish.mainIngredients ?? []),
          JSON.stringify(pairsWith),
          dish.description ?? null,
          dish.channelName ?? null,
          DEFAULT_SOURCE,
        ]
      );

      const row = result.rows[0];
      if (row && row.xmax === "0") inserted++;
      else if (row) updated++;
    }

    const keepNames = block.dishes.map((d) => d.name.toLowerCase());
    const removed = await client.query<{ id: number }>(
      `DELETE FROM dishes
       WHERE ingredient_id = $1
         AND source = $2
         AND LOWER(name) <> ALL($3::text[])
       RETURNING id`,
      [ingredientId, DEFAULT_SOURCE, keepNames]
    );

    await client.query("COMMIT");

    console.log(
      `  ✓ ${ingredientName} (${catalogId}): ${block.dishes.length} mixed rice dishes — ${inserted} new, ${updated} updated, ${removed.rowCount ?? 0} removed`
    );

    return {
      inserted,
      updated,
      removed: removed.rowCount ?? 0,
      missing: false,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}

async function main() {
  const filePath = path.resolve(process.argv[2] ?? DEFAULT_JSON);
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required. Set it in .env.local or the environment.");
    process.exit(1);
  }

  const blocks = loadBlocks(filePath);
  const dishCount = blocks.reduce((total, block) => total + block.dishes.length, 0);
  console.log(`\nSyncing mixed rice catalog from ${filePath}`);
  console.log(`${blocks.length} ingredient blocks, ${dishCount} dishes\n`);

  const client = new pg.Client({
    connectionString: url,
    ssl: url.includes("localhost") ? false : { rejectUnauthorized: false },
  });
  await client.connect();

  let totalInserted = 0;
  let totalUpdated = 0;
  let totalRemoved = 0;
  let missingIngredients = 0;

  for (const block of blocks) {
    const stats = await syncBlock(client, block);
    totalInserted += stats.inserted;
    totalUpdated += stats.updated;
    totalRemoved += stats.removed;
    if (stats.missing) missingIngredients += block.dishes.length;
  }

  const totals = await client.query<{ ingredients: string; dishes: string }>(
    `SELECT
       (SELECT COUNT(*)::text FROM ingredients) AS ingredients,
       (SELECT COUNT(*)::text FROM dishes) AS dishes`
  );

  await client.end();

  console.log("\nMixed rice sync complete:");
  console.log(`  ${totalInserted} inserted, ${totalUpdated} updated, ${totalRemoved} removed`);
  if (missingIngredients) {
    console.log(`  ${missingIngredients} dishes skipped — ingredient not in DB`);
  }
  console.log(
    `  DB totals: ${totals.rows[0]?.ingredients ?? "?"} ingredients, ${totals.rows[0]?.dishes ?? "?"} dishes`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
