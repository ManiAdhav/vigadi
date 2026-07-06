import dotenv from "dotenv";
import { runMigrations } from "../server/db/migrate";

dotenv.config({ path: ".env.local" });
dotenv.config();

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }
  await runMigrations();
  console.log("All migrations applied.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
