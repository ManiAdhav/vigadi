import fs from "fs";
import path from "path";
import pg from "pg";
import dotenv from "dotenv";
import { normalizeAlias, type IngredientEntry } from "../shared/ingredientCatalog";

dotenv.config({ path: ".env.local" });
dotenv.config();

function loadCatalog(): IngredientEntry[] {
  const catalogPath = path.join(process.cwd(), "shared/ingredients.json");
  return JSON.parse(fs.readFileSync(catalogPath, "utf8")) as IngredientEntry[];
}

function aliasRows(entry: IngredientEntry): Array<{ alias: string; type: string }> {
  const rows: Array<{ alias: string; type: string }> = [
    { alias: entry.canonical, type: "canonical" },
  ];
  if (entry.transliteration?.trim()) {
    rows.push({ alias: entry.transliteration, type: "transliteration" });
  }
  if (entry.tamil?.trim()) {
    rows.push({ alias: entry.tamil, type: "tamil" });
  }
  for (const alias of entry.aliases) {
    if (alias.trim()) rows.push({ alias, type: "alias" });
  }
  return rows;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required. Set it in .env.local or the environment.");
    process.exit(1);
  }

  const catalog = loadCatalog();
  const client = new pg.Client({
    connectionString: url,
    ssl: url.includes("localhost") ? false : { rejectUnauthorized: false },
  });
  await client.connect();

  const migrationPath = path.join(process.cwd(), "migrations/002_ingredient_aliases.sql");
  await client.query(fs.readFileSync(migrationPath, "utf8"));

  let ingredientCount = 0;
  let aliasCount = 0;

  for (const entry of catalog) {
    const normalized = normalizeAlias(entry.canonical);
    const result = await client.query<{ id: number }>(
      `INSERT INTO ingredients (name, normalized_name, catalog_slug)
       VALUES ($1, $2, $3)
       ON CONFLICT (normalized_name) DO UPDATE
         SET name = EXCLUDED.name, catalog_slug = EXCLUDED.catalog_slug
       RETURNING id`,
      [entry.canonical, normalized, entry.id]
    );
    if (result.rowCount) ingredientCount++;

    for (const row of aliasRows(entry)) {
      const normalizedAlias = normalizeAlias(row.alias);
      if (!normalizedAlias) continue;
      await client.query(
        `INSERT INTO ingredient_aliases (ingredient_slug, alias, normalized_alias, alias_type)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (normalized_alias) DO UPDATE
           SET ingredient_slug = EXCLUDED.ingredient_slug,
               alias = EXCLUDED.alias,
               alias_type = EXCLUDED.alias_type`,
        [entry.id, row.alias, normalizedAlias, row.type]
      );
      aliasCount++;
    }
  }

  await client.end();
  console.log(`Seeded ${ingredientCount} ingredients and ${aliasCount} aliases from ${catalog.length} catalog entries.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
