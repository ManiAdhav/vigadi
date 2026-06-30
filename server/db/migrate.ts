import fs from "fs";
import path from "path";
import { query } from "./pool";

export async function runMigrations(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  const applied = await query<{ id: string }>(`SELECT id FROM schema_migrations`);
  const appliedIds = new Set(applied.rows.map((r) => r.id));

  if (!appliedIds.has("001_initial")) {
    const sqlPath = path.join(process.cwd(), "migrations/001_initial.sql");
    const sql = fs.readFileSync(sqlPath, "utf8");
    await query(sql);
    await query(`INSERT INTO schema_migrations (id) VALUES ($1)`, ["001_initial"]);
    console.log("Migration 001 applied.");
  }

  if (!appliedIds.has("002_ingredient_aliases")) {
    const sqlPath = path.join(process.cwd(), "migrations/002_ingredient_aliases.sql");
    const sql = fs.readFileSync(sqlPath, "utf8");
    await query(sql);
    await query(`INSERT INTO schema_migrations (id) VALUES ($1)`, ["002_ingredient_aliases"]);
    console.log("Migration 002 applied.");
  }
}
