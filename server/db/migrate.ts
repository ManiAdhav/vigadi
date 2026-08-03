import fs from "fs";
import path from "path";
import { query } from "./pool";

/**
 * Migration ids are filenames without the .sql extension, applied in filename
 * order. Reading the directory means a new migration file is picked up on its
 * own — nothing here needs editing when one is added.
 */
function migrationIds(dir: string): string[] {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => f.replace(/\.sql$/, ""))
    .sort();
}

export async function runMigrations(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  const applied = await query<{ id: string }>(`SELECT id FROM schema_migrations`);
  const appliedIds = new Set(applied.rows.map((r) => r.id));

  const dir = path.join(process.cwd(), "migrations");
  for (const id of migrationIds(dir)) {
    if (appliedIds.has(id)) continue;
    const sql = fs.readFileSync(path.join(dir, `${id}.sql`), "utf8");
    await query(sql);
    await query(`INSERT INTO schema_migrations (id) VALUES ($1)`, [id]);
    console.log(`Migration ${id} applied.`);
  }
}
