import fs from "fs";
import path from "path";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }
  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const sqlPath = path.join(process.cwd(), "migrations/001_initial.sql");
  const sql = fs.readFileSync(sqlPath, "utf8");
  await client.query(sql);

  const sql2Path = path.join(process.cwd(), "migrations/002_ingredient_aliases.sql");
  const sql2 = fs.readFileSync(sql2Path, "utf8");
  await client.query(sql2);

  await client.end();
  console.log("Migrations 001 and 002 applied.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
