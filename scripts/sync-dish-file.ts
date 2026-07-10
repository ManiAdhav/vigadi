import fs from "fs";
import path from "path";
import pg from "pg";
import dotenv from "dotenv";
import { extractYouTubeVideoId } from "../server/jsonUtils";
import { resolveDishCategory } from "../shared/mealTemplates";
import {
  type IngredientDishBlock,
  resolveIngredientId,
} from "./parse-dish-rtf";

dotenv.config({ path: ".env.local" });
dotenv.config();

type PruneMode = "none" | "category" | "ingredient";

interface SyncOptions {
  prune: PruneMode;
  pruneCategory?: string;
}

function loadFile(filePath: string): IngredientDishBlock[] {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    console.error(`File not found: ${resolved}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(resolved, "utf8")) as IngredientDishBlock[];
}

async function syncIngredientBlock(
  client: pg.Client,
  block: IngredientDishBlock,
  options: SyncOptions
): Promise<{ inserted: number; updated: number; removed: number; staleRemoved: number; missing: boolean }> {
  const catalogId = resolveIngredientId(block.ingredientId) ?? block.ingredientId;
  const ingredient = await client.query<{ id: number; name: string }>(
    `SELECT id, name FROM ingredients WHERE catalog_slug = $1`,
    [catalogId]
  );

  if (!ingredient.rows[0]) {
    console.warn(`  ✗ No DB ingredient for catalog slug: ${catalogId} (${block.ingredientId})`);
    return { inserted: 0, updated: 0, removed: 0, staleRemoved: 0, missing: true };
  }

  const ingredientId = ingredient.rows[0].id;
  const ingredientName = ingredient.rows[0].name;
  let inserted = 0;
  let updated = 0;

  await client.query("BEGIN");

  try {
    for (const dish of block.dishes) {
      const videoId =
        dish.youtubeVideoId ?? extractYouTubeVideoId(dish.youtubeUrl ?? "");
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
    let removed = 0;

    if (options.prune === "ingredient") {
      const result = await client.query<{ id: number }>(
        `DELETE FROM dishes
         WHERE ingredient_id = $1
           AND LOWER(name) <> ALL($2::text[])
         RETURNING id`,
        [ingredientId, keepNames]
      );
      removed = result.rowCount ?? 0;
    } else if (options.prune === "category" && options.pruneCategory) {
      const result = await client.query<{ id: number }>(
        `DELETE FROM dishes
         WHERE ingredient_id = $1
           AND dish_category = $2
           AND LOWER(name) <> ALL($3::text[])
         RETURNING id`,
        [ingredientId, options.pruneCategory, keepNames]
      );
      removed = result.rowCount ?? 0;
    }

    // Remove legacy short-name rice variety dishes superseded by canonical names
    const staleRemoved = await client.query<{ id: number; name: string }>(
      `DELETE FROM dishes
       WHERE ingredient_id = $1
         AND name IN ('Lemon Rice', 'Puliyodarai', 'Thayir Sadam', 'Thengai Sadam', 'Thakkali Sadam')
         AND LOWER(name) <> ALL($2::text[])
       RETURNING id, name`,
      [ingredientId, keepNames]
    );

    await client.query("COMMIT");

    console.log(
      `  ✓ ${ingredientName} (${catalogId}): ${block.dishes.length} dishes — ${inserted} new, ${updated} updated, ${removed} pruned, ${staleRemoved.rowCount ?? 0} stale removed`
    );

    return {
      inserted,
      updated,
      removed,
      staleRemoved: staleRemoved.rowCount ?? 0,
      missing: false,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}

async function main() {
  const fileArg = process.argv[2];
  const pruneArg = process.argv[3] ?? "category";

  if (!fileArg) {
    console.error("Usage: tsx scripts/sync-dish-file.ts <json-file> [prune-mode]");
    console.error("  prune-mode: none | category (default) | ingredient");
    console.error("Example: npm run sync:dishes:file -- ../staging/dishes-with-yt-mixed-rices-tamil-nadu.json");
    process.exit(1);
  }

  const prune = (["none", "category", "ingredient"].includes(pruneArg)
    ? pruneArg
    : "category") as PruneMode;

  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required. Set it in repo/.env.local");
    process.exit(1);
  }

  const blocks = loadFile(fileArg);
  const dishCount = blocks.reduce((n, b) => n + b.dishes.length, 0);
  console.log(`\nSyncing ${path.resolve(fileArg)}: ${blocks.length} blocks, ${dishCount} dishes (prune=${prune})\n`);

  const client = new pg.Client({
    connectionString: url,
    ssl: url.includes("localhost") ? false : { rejectUnauthorized: false },
  });
  await client.connect();

  let totalInserted = 0;
  let totalUpdated = 0;
  let totalRemoved = 0;
  let totalStale = 0;
  let missingIngredients = 0;

  for (const block of blocks) {
    const stats = await syncIngredientBlock(client, block, {
      prune,
      pruneCategory: "mixed_rice",
    });
    totalInserted += stats.inserted;
    totalUpdated += stats.updated;
    totalRemoved += stats.removed;
    totalStale += stats.staleRemoved;
    if (stats.missing) missingIngredients += block.dishes.length;
  }

  const totals = await client.query<{ ingredients: string; dishes: string }>(
    `SELECT
       (SELECT COUNT(*)::text FROM ingredients) AS ingredients,
       (SELECT COUNT(*)::text FROM dishes) AS dishes`
  );

  await client.end();

  console.log(`\nSync complete:`);
  console.log(`  ${totalInserted} inserted, ${totalUpdated} updated, ${totalRemoved} pruned, ${totalStale} stale removed`);
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
