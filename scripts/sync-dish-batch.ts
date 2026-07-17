import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import pg from "pg";
import dotenv from "dotenv";
import { extractYouTubeVideoId } from "../server/jsonUtils";
import { resolveDishCategory } from "../shared/mealTemplates";
import { isAlwaysSecondary } from "../shared/ingredientClassification";
import {
  type IngredientDishBlock,
  resolveIngredientId,
} from "./parse-dish-rtf";

dotenv.config({ path: ".env.local" });
dotenv.config();

const BATCH_DIR = path.resolve(process.cwd(), "../Vigadi_Dishes/Dish_With YT");

function fileToText(filePath: string): string {
  const raw = fs.readFileSync(filePath, "utf8");
  if (raw.trimStart().startsWith("{\\rtf")) {
    return execSync(`textutil -convert txt -stdout ${JSON.stringify(filePath)}`, {
      encoding: "utf8",
      maxBuffer: 50 * 1024 * 1024,
    });
  }
  return raw;
}

function extractJsonArray(text: string): IngredientDishBlock[] {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start < 0 || end < 0) {
    throw new Error("No JSON array found in batch file");
  }
  const payload = text.slice(start, end + 1);
  try {
    return JSON.parse(payload) as IngredientDishBlock[];
  } catch (err) {
    const lastCompleteDish = payload.lastIndexOf("      }");
    if (lastCompleteDish < 0) throw err;
    const repaired = `${payload.slice(0, lastCompleteDish + 7)}\n    ]\n  }\n]`;
    const blocks = JSON.parse(repaired) as IngredientDishBlock[];
    console.warn(
      `  ⚠ Batch file appears truncated — synced ${blocks.length} complete ingredient blocks only`
    );
    return blocks;
  }
}

function loadBatch(batchNumber: number): IngredientDishBlock[] {
  const filePath = path.join(BATCH_DIR, `Batch ${batchNumber}.json`);
  if (!fs.existsSync(filePath)) {
    console.error(`Batch file not found: ${filePath}`);
    process.exit(1);
  }
  const text = fileToText(filePath);
  return mergeBlocksByCatalogId(extractJsonArray(text));
}

/** Collapse blocks that resolve to the same catalog ingredient (e.g. brinjal-long + brinjal-small → brinjal). */
function mergeBlocksByCatalogId(blocks: IngredientDishBlock[]): IngredientDishBlock[] {
  const merged = new Map<string, IngredientDishBlock>();

  for (const block of blocks) {
    const catalogId = resolveIngredientId(block.ingredientId) ?? block.ingredientId;
    const existing = merged.get(catalogId);
    if (!existing) {
      merged.set(catalogId, {
        ingredientId: catalogId,
        ingredientCanonical: block.ingredientCanonical,
        dishes: [...block.dishes],
      });
      continue;
    }

    const seen = new Set(existing.dishes.map((d) => d.name.toLowerCase()));
    for (const dish of block.dishes) {
      const key = dish.name.toLowerCase();
      if (!seen.has(key)) {
        existing.dishes.push(dish);
        seen.add(key);
      }
    }
  }

  return [...merged.values()];
}

async function syncIngredientBlock(
  client: pg.Client,
  block: IngredientDishBlock
): Promise<{ inserted: number; updated: number; removed: number; missing: boolean }> {
  const catalogId = resolveIngredientId(block.ingredientId) ?? block.ingredientId;

  if (isAlwaysSecondary(block.ingredientCanonical) || isAlwaysSecondary(catalogId)) {
    console.warn(
      `  ⏭ Skipping ${block.ingredientCanonical} (${catalogId}) — always-secondary ingredient; dishes must be keyed to a primary ingredient`
    );
    return { inserted: 0, updated: 0, removed: 0, missing: false };
  }

  const ingredient = await client.query<{ id: number; name: string }>(
    `SELECT id, name FROM ingredients WHERE catalog_slug = $1`,
    [catalogId]
  );

  if (!ingredient.rows[0]) {
    console.warn(`  ✗ No DB ingredient for catalog slug: ${catalogId} (${block.ingredientId})`);
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
          JSON.stringify(dish.pairsWith?.length ? dish.pairsWith : ["Rice"]),
          dish.description ?? null,
          dish.channelName ?? null,
          "catalog_seed",
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
         AND LOWER(name) <> ALL($2::text[])
       RETURNING id`,
      [ingredientId, keepNames]
    );

    await client.query("COMMIT");

    console.log(
      `  ✓ ${ingredientName} (${catalogId}): ${block.dishes.length} dishes — ${inserted} new, ${updated} updated, ${removed.rowCount ?? 0} removed`
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
  const batchArg = process.argv[2];
  if (!batchArg || !/^\d+$/.test(batchArg)) {
    console.error("Usage: tsx scripts/sync-dish-batch.ts <batch-number>");
    console.error("Example: npm run sync:dishes -- 1");
    process.exit(1);
  }

  const batchNumber = Number(batchArg);
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required. Set it in repo/.env.local");
    process.exit(1);
  }

  const blocks = loadBatch(batchNumber);
  console.log(`\nSyncing Batch ${batchNumber}: ${blocks.length} ingredients, ${blocks.reduce((n, b) => n + b.dishes.length, 0)} dishes\n`);

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
    const stats = await syncIngredientBlock(client, block);
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

  console.log(`\nBatch ${batchNumber} complete:`);
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
