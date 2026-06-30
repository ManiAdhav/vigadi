import fs from "fs";
import path from "path";
import pg from "pg";
import dotenv from "dotenv";
import { extractYouTubeVideoId } from "../server/jsonUtils";
import type { IngredientDishBlock } from "./parse-dish-rtf";
import { resolveIngredientId } from "./parse-dish-rtf";

dotenv.config({ path: ".env.local" });
dotenv.config();

function loadBlocks(): IngredientDishBlock[] {
  const dishesPath = path.join(process.cwd(), "data/dishes.json");
  if (!fs.existsSync(dishesPath)) {
    console.error("data/dishes.json not found. Run: npm run parse:dishes");
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(dishesPath, "utf8")) as IngredientDishBlock[];
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required. Set it in repo/.env.local");
    process.exit(1);
  }

  const blocks = loadBlocks();
  const client = new pg.Client({
    connectionString: url,
    ssl: url.includes("localhost") ? false : { rejectUnauthorized: false },
  });
  await client.connect();

  let inserted = 0;
  let skipped = 0;
  let missingIngredient = 0;

  for (const block of blocks) {
    const catalogId = resolveIngredientId(block.ingredientId) ?? block.ingredientId;
    const ingredient = await client.query<{ id: number; name: string }>(
      `SELECT id, name FROM ingredients WHERE catalog_slug = $1`,
      [catalogId]
    );

    if (!ingredient.rows[0]) {
      console.warn(`No DB ingredient for catalog slug: ${catalogId}`);
      missingIngredient += block.dishes.length;
      continue;
    }

    const ingredientId = ingredient.rows[0].id;

    for (const dish of block.dishes) {
      const videoId = extractYouTubeVideoId(dish.youtubeUrl);
      const result = await client.query<{ id: number }>(
        `INSERT INTO dishes (
          ingredient_id, name, youtube_url, youtube_video_id, dish_type, spice_level,
          main_ingredients, pairs_with, description, channel_name, source
        ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10, $11)
        ON CONFLICT (ingredient_id, name) DO NOTHING
        RETURNING id`,
        [
          ingredientId,
          dish.name,
          dish.youtubeUrl,
          videoId,
          dish.dishType,
          dish.spiceLevel,
          JSON.stringify(dish.mainIngredients ?? []),
          JSON.stringify(dish.pairsWith?.length ? dish.pairsWith : ["Rice"]),
          dish.description ?? null,
          dish.channelName ?? null,
          "catalog_seed",
        ]
      );

      if (result.rows[0]) inserted++;
      else skipped++;
    }
  }

  const totals = await client.query<{ ingredients: string; dishes: string }>(
    `SELECT
       (SELECT COUNT(*)::text FROM ingredients) AS ingredients,
       (SELECT COUNT(*)::text FROM dishes) AS dishes`
  );

  await client.end();

  console.log(`Inserted ${inserted} new dishes (${skipped} duplicates skipped).`);
  if (missingIngredient) {
    console.log(`Skipped ${missingIngredient} dishes — ingredient not found in DB.`);
  }
  console.log(
    `DB totals: ${totals.rows[0]?.ingredients ?? "?"} ingredients, ${totals.rows[0]?.dishes ?? "?"} dishes`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
