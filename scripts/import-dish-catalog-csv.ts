import fs from "fs";
import path from "path";
import pg from "pg";
import dotenv from "dotenv";
import { parseCsvDishRow, type CsvDishRow } from "../shared/dishCatalogCsv";

dotenv.config({ path: ".env.local" });
dotenv.config();

function parseCsv(content: string): CsvDishRow[] {
  const lines = content.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = lines[0].split(",");
  const rows: CsvDishRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const values: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let j = 0; j < line.length; j++) {
      const ch = line[j];
      if (ch === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (ch === "," && !inQuotes) {
        values.push(current);
        current = "";
        continue;
      }
      current += ch;
    }
    values.push(current);

    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header.trim()] = values[idx] ?? "";
    });
    rows.push(row as unknown as CsvDishRow);
  }

  return rows;
}

function resolveCsvPath(): string {
  const argPath = process.argv[2];
  if (argPath) return path.resolve(argPath);

  const repoDefault = path.join(process.cwd(), "data/vigadi-dishes-final.csv");
  if (fs.existsSync(repoDefault)) return repoDefault;

  const userDefault = "/Users/mani/Claude/FIles/Vigadi/vigadi-dishes-final.csv";
  if (fs.existsSync(userDefault)) return userDefault;

  console.error("CSV not found. Pass a path or place data/vigadi-dishes-final.csv in the repo.");
  process.exit(1);
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required. Set it in repo/.env.local");
    process.exit(1);
  }

  const csvPath = resolveCsvPath();
  const rawRows = parseCsv(fs.readFileSync(csvPath, "utf8"));
  const dishes = rawRows.map(parseCsvDishRow);

  const client = new pg.Client({
    connectionString: url,
    ssl: url.includes("localhost") ? false : { rejectUnauthorized: false },
  });
  await client.connect();

  const ingredientIds = new Set(
    (
      await client.query<{ id: number }>(`SELECT id FROM ingredients`)
    ).rows.map((r) => r.id)
  );

  const missingIngredientIds = [...new Set(dishes.map((d) => d.ingredientId))].filter(
    (id) => !ingredientIds.has(id)
  );
  if (missingIngredientIds.length > 0) {
    console.error(
      `Import aborted: ${missingIngredientIds.length} ingredient_id(s) missing from ingredients table:`,
      missingIngredientIds.slice(0, 20).join(", "),
      missingIngredientIds.length > 20 ? "…" : ""
    );
    await client.end();
    process.exit(1);
  }

  await client.query("BEGIN");
  try {
    let inserted = 0;
    for (const dish of dishes) {
      await client.query(
        `INSERT INTO dishes (
          id, ingredient_id, name, dish_group, dish_category, consistency,
          base_tags, accompaniments, english_alias, spice_level, main_ingredients,
          description, youtube_url, youtube_video_id, channel_name, source, discovered_at,
          dish_type, pairs_with
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7::jsonb, $8::jsonb, $9, $10, $11::jsonb,
          $12, $13, $14, $15, $16, COALESCE($17, NOW()),
          NULL, NULL
        )`,
        [
          dish.id,
          dish.ingredientId,
          dish.name,
          dish.dishGroup,
          dish.dishCategory,
          dish.consistency,
          JSON.stringify(dish.baseTags),
          JSON.stringify(dish.accompaniments),
          dish.englishAlias,
          dish.spiceLevel,
          JSON.stringify(dish.mainIngredients),
          dish.description,
          dish.youtubeUrl,
          dish.youtubeVideoId,
          dish.channelName,
          dish.source,
          dish.discoveredAt,
        ]
      );
      inserted++;
    }

    const maxId = Math.max(...dishes.map((d) => d.id));
    await client.query(`SELECT setval(pg_get_serial_sequence('dishes', 'id'), $1, true)`, [maxId]);
    await client.query("COMMIT");

    const totals = await client.query<{ dishes: string }>(
      `SELECT COUNT(*)::text AS dishes FROM dishes`
    );
    console.log(`Imported ${inserted} dishes from ${csvPath}`);
    console.log(`DB total: ${totals.rows[0]?.dishes ?? "?"} dishes`);
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
