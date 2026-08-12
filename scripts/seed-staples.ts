import pg from "pg";
import dotenv from "dotenv";
import { STAPLE_DISHES, CATALOG_NAME_ALIASES } from "../shared/staples";

dotenv.config({ path: ".env.local" });
dotenv.config();

/**
 * Adds the plain staple dishes the ingredient-by-ingredient catalog never
 * generated (Sadam, Idli, Dosa, boiled egg, omelette…) and attaches alternate
 * names to dishes that already exist but were unfindable under the name people
 * actually type ("Egg Podimas" → "Muttai Podimas").
 *
 * Safe to re-run: staples are inserted ON CONFLICT DO NOTHING, aliases are a
 * straight overwrite of the name_aliases column.
 */
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required. Set it in repo/.env.local");
    process.exit(1);
  }

  const client = new pg.Client({
    connectionString: url,
    ssl: url.includes("localhost") ? false : { rejectUnauthorized: false },
  });
  await client.connect();

  await client.query("BEGIN");
  try {
    let inserted = 0;
    let alreadyThere = 0;
    const missingIngredients: string[] = [];

    for (const dish of STAPLE_DISHES) {
      const ingredient = await client.query<{ id: number }>(
        `SELECT id FROM ingredients WHERE catalog_slug = $1`,
        [dish.ingredientSlug]
      );
      const ingredientId = ingredient.rows[0]?.id;
      if (!ingredientId) {
        missingIngredients.push(`${dish.name} → ${dish.ingredientSlug}`);
        continue;
      }

      const result = await client.query<{ id: number }>(
        `INSERT INTO dishes (
           ingredient_id, name, dish_group, dish_category, consistency,
           base_tags, accompaniments, english_alias, name_aliases,
           spice_level, main_ingredients, description, source
         ) VALUES (
           $1, $2, $3, $4, $5,
           $6::jsonb, $7::jsonb, $8, $9::jsonb,
           $10, $11::jsonb, $12, 'staple_seed'
         )
         ON CONFLICT (ingredient_id, name) DO NOTHING
         RETURNING id`,
        [
          ingredientId,
          dish.name,
          dish.dishGroup,
          dish.dishCategory,
          dish.consistency,
          JSON.stringify(dish.baseTags),
          JSON.stringify(dish.accompaniments),
          dish.englishAlias,
          JSON.stringify(dish.nameAliases),
          dish.spiceLevel,
          JSON.stringify(dish.mainIngredients),
          dish.description,
        ]
      );

      if (result.rows[0]) {
        inserted++;
      } else {
        // Already seeded on an earlier run — keep its aliases current anyway.
        alreadyThere++;
        await client.query(
          `UPDATE dishes SET name_aliases = $1::jsonb
           WHERE ingredient_id = $2 AND name = $3`,
          [JSON.stringify(dish.nameAliases), ingredientId, dish.name]
        );
      }
    }

    let aliased = 0;
    const unmatchedAliases: string[] = [];
    for (const [name, aliases] of Object.entries(CATALOG_NAME_ALIASES)) {
      const result = await client.query(
        `UPDATE dishes SET name_aliases = $1::jsonb WHERE name = $2`,
        [JSON.stringify(aliases), name]
      );
      if (result.rowCount && result.rowCount > 0) {
        aliased += result.rowCount;
      } else {
        unmatchedAliases.push(name);
      }
    }

    await client.query("COMMIT");

    console.log(`Staples inserted:      ${inserted}`);
    console.log(`Staples already there: ${alreadyThere}`);
    console.log(`Existing dishes aliased: ${aliased}`);
    if (missingIngredients.length > 0) {
      console.warn(`\nSkipped — no such ingredient:\n  ${missingIngredients.join("\n  ")}`);
    }
    if (unmatchedAliases.length > 0) {
      console.warn(`\nAlias target not found in DB:\n  ${unmatchedAliases.join("\n  ")}`);
    }
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
