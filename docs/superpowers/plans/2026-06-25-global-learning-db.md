# Global Learning Database Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate Vigadi from SQLite to Postgres with a global combo pool, event-sourced training data, and optional city preference — so proven combos compound across users and generation effort decreases over time.

**Architecture:** Single Postgres database with four layers (catalog, user learning, global combo pool, training events). Combo build queries global pool first, fills remaining slots via Gemini/rule engine, logs every session. Combo select upserts global pool anonymously and records immutable selection events. City is optional on user profile; dual-write to city + global rows when present.

**Tech Stack:** Node.js 20+, Express, `pg` (node-postgres), Postgres (Neon recommended), Vitest for unit/integration tests, existing Gemini + React PWA stack.

**Spec:** `docs/superpowers/specs/2026-06-25-global-learning-db-design.md`

---

## File Map

| File | Responsibility |
|------|----------------|
| `migrations/001_initial.sql` | Full Postgres schema |
| `server/db/pool.ts` | Connection pool singleton |
| `server/db/migrate.ts` | Apply migrations on startup |
| `server/db/ingredientSignature.ts` | Pure ingredient normalization + signature |
| `server/db/catalog.ts` | ingredients, dishes CRUD |
| `server/db/users.ts` | user_profiles, taste, feedback |
| `server/db/globalCombos.ts` | global_combos upsert + query |
| `server/db/events.ts` | generation_sessions, combo_candidates, selection_events |
| `server/db/index.ts` | Re-exports — same public API as old `db.ts` |
| `server/globalComboService.ts` | Orchestrates global-first combo build |
| `server/comboBuilder.ts` | Modified — accepts pre-filled slots, returns source metadata |
| `server/tasteEngine.ts` | Modified — upserts global pool on select |
| `server.ts` | New profile endpoint, updated build/select responses |
| `scripts/migrate-sqlite-to-postgres.ts` | One-time data export |
| `server/__tests__/ingredientSignature.test.ts` | Pure function tests |
| `server/__tests__/globalCombos.test.ts` | Integration tests (needs DATABASE_URL) |
| `.env.example` | Add DATABASE_URL |
| `DEPLOY.md` | Postgres setup, remove SQLite volume instructions |
| `render.yaml` | Remove disk, add DATABASE_URL |
| `package.json` | Add pg, vitest; remove better-sqlite3 |

**Delete after migration complete:** `server/db.ts` (replaced by `server/db/index.ts`)

---

## Phase 1 — Postgres Foundation

### Task 1: Add dependencies and test runner

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install Postgres driver and Vitest**

```bash
cd repo
npm install pg
npm install -D vitest @types/pg
npm uninstall better-sqlite3 @types/better-sqlite3
```

- [ ] **Step 2: Add scripts to package.json**

Add to `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest",
"migrate": "tsx scripts/run-migrations.ts"
```

- [ ] **Step 3: Verify install**

Run: `npm run lint`
Expected: PASS (no type errors yet)

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add pg and vitest, remove better-sqlite3"
```

---

### Task 2: Ingredient signature (pure function + tests)

**Files:**
- Create: `server/db/ingredientSignature.ts`
- Create: `server/__tests__/ingredientSignature.test.ts`
- Create: `vitest.config.ts`

- [ ] **Step 1: Write vitest config**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["server/__tests__/**/*.test.ts"],
  },
});
```

- [ ] **Step 2: Write the failing test**

Create `server/__tests__/ingredientSignature.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildIngredientSignature, normalizeIngredient } from "../db/ingredientSignature";

describe("normalizeIngredient", () => {
  it("lowercases and trims", () => {
    expect(normalizeIngredient("  Brinjal  ")).toBe("brinjal");
  });
});

describe("buildIngredientSignature", () => {
  it("sorts and joins ingredients", () => {
    expect(buildIngredientSignature(["Potato", "Brinjal"])).toBe("brinjal|potato");
  });

  it("excludes rice", () => {
    expect(buildIngredientSignature(["Rice", "Brinjal", "Potato"])).toBe("brinjal|potato");
  });

  it("deduplicates via normalization", () => {
    expect(buildIngredientSignature(["brinjal", "Brinjal"])).toBe("brinjal");
  });

  it("returns empty string for rice-only input", () => {
    expect(buildIngredientSignature(["Rice"])).toBe("");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- server/__tests__/ingredientSignature.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Implement**

Create `server/db/ingredientSignature.ts`:

```typescript
export function normalizeIngredient(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function buildIngredientSignature(ingredients: string[]): string {
  const normalized = [
    ...new Set(
      ingredients
        .map(normalizeIngredient)
        .filter((i) => i && i !== "rice")
    ),
  ].sort();
  return normalized.join("|");
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- server/__tests__/ingredientSignature.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts server/db/ingredientSignature.ts server/__tests__/ingredientSignature.test.ts
git commit -m "feat: add ingredient signature for global combo matching"
```

---

### Task 3: Postgres schema migration

**Files:**
- Create: `migrations/001_initial.sql`
- Create: `scripts/run-migrations.ts`

- [ ] **Step 1: Write migration SQL**

Create `migrations/001_initial.sql`:

```sql
-- Layer 1: Catalog
CREATE TABLE IF NOT EXISTS ingredients (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  normalized_name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dishes (
  id SERIAL PRIMARY KEY,
  ingredient_id INT NOT NULL REFERENCES ingredients(id),
  name TEXT NOT NULL,
  youtube_url TEXT,
  youtube_video_id TEXT,
  dish_type TEXT,
  spice_level TEXT,
  main_ingredients JSONB DEFAULT '[]',
  pairs_with JSONB DEFAULT '["Rice"]',
  description TEXT,
  channel_name TEXT,
  discovered_at TIMESTAMPTZ DEFAULT NOW(),
  source TEXT DEFAULT 'gemini_grounding',
  UNIQUE (ingredient_id, name)
);

CREATE INDEX IF NOT EXISTS idx_dishes_ingredient ON dishes(ingredient_id);

-- Layer 2: User learning
CREATE TABLE IF NOT EXISTS user_profiles (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  combo_rules TEXT DEFAULT 'Tamil Nadu rules: 1 Kulambu, 2 Sides',
  taste_profile JSONB DEFAULT '{}',
  city_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user_profiles(id),
  dish_id INT REFERENCES dishes(id),
  combo_id TEXT,
  thumb TEXT NOT NULL,
  feedback_type TEXT,
  notes TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_user ON feedback(user_id);

CREATE TABLE IF NOT EXISTS user_preferred_combos (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user_profiles(id),
  global_combo_id INT,
  dish_ids JSONB NOT NULL,
  name TEXT NOT NULL,
  ingredient_signature TEXT NOT NULL,
  selected_at TIMESTAMPTZ DEFAULT NOW()
);

-- Layer 3: Global combo pool
CREATE TABLE IF NOT EXISTS global_combos (
  id SERIAL PRIMARY KEY,
  ingredient_signature TEXT NOT NULL,
  dish_ids JSONB NOT NULL,
  combo_name TEXT NOT NULL,
  sub_components JSONB NOT NULL,
  selection_count INT NOT NULL DEFAULT 1,
  city_code TEXT,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_selected_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_global_combos_unique
  ON global_combos (ingredient_signature, dish_ids, COALESCE(city_code, ''));

CREATE INDEX IF NOT EXISTS idx_global_combos_signature ON global_combos(ingredient_signature);
CREATE INDEX IF NOT EXISTS idx_global_combos_city ON global_combos(city_code);

-- Layer 4: Training events
CREATE TABLE IF NOT EXISTS generation_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user_profiles(id),
  ingredient_signature TEXT NOT NULL,
  ingredients JSONB NOT NULL,
  combo_rules TEXT,
  category TEXT,
  slots_requested INT DEFAULT 2,
  slots_from_global INT DEFAULT 0,
  slots_generated INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS combo_candidates (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES generation_sessions(id),
  combo_name TEXT NOT NULL,
  dish_ids JSONB NOT NULL,
  source TEXT NOT NULL,
  global_combo_id INT REFERENCES global_combos(id),
  score NUMERIC,
  rank INT,
  shown_to_user BOOLEAN DEFAULT TRUE,
  rationale TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS selection_events (
  id TEXT PRIMARY KEY,
  session_id TEXT REFERENCES generation_sessions(id),
  user_id TEXT NOT NULL REFERENCES user_profiles(id),
  selected_combo_id TEXT NOT NULL,
  rejected_combo_id TEXT,
  dish_ids JSONB NOT NULL,
  rejected_dish_ids JSONB,
  global_combo_id INT REFERENCES global_combos(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Legacy combos table (suggested combos per build)
CREATE TABLE IF NOT EXISTS combos (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user_profiles(id),
  name TEXT NOT NULL,
  dish_ids JSONB NOT NULL,
  sub_components JSONB NOT NULL,
  category TEXT,
  status TEXT DEFAULT 'suggested',
  source TEXT DEFAULT 'generated',
  global_combo_id INT REFERENCES global_combos(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

- [ ] **Step 2: Write migration runner**

Create `scripts/run-migrations.ts`:

```typescript
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
  await client.end();
  console.log("Migration 001 applied.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 3: Update .env.example**

Add to `.env.example`:

```
# DATABASE_URL: Postgres connection string (Neon, Supabase, or local)
# Example: postgresql://user:pass@host/db?sslmode=require
DATABASE_URL="postgresql://..."
```

- [ ] **Step 4: Run migration against Neon**

Run: `npm run migrate`
Expected: `Migration 001 applied.`

- [ ] **Step 5: Commit**

```bash
git add migrations/001_initial.sql scripts/run-migrations.ts .env.example
git commit -m "feat: add Postgres schema migration"
```

---

### Task 4: Connection pool

**Files:**
- Create: `server/db/pool.ts`

- [ ] **Step 1: Implement pool singleton**

Create `server/db/pool.ts`:

```typescript
import pg from "pg";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL environment variable is required");
    }
    pool = new pg.Pool({
      connectionString,
      ssl: connectionString.includes("localhost") ? false : { rejectUnauthorized: false },
      max: 10,
    });
  }
  return pool;
}

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<pg.QueryResult<T>> {
  return getPool().query<T>(text, params);
}
```

- [ ] **Step 2: Verify pool connects**

Create temporary check in `scripts/run-migrations.ts` or run:

```bash
node -e "
import('./server/db/pool.ts').then(async ({ query }) => {
  const r = await query('SELECT 1 as ok');
  console.log(r.rows[0]);
  process.exit(0);
});
"
```

Expected: `{ ok: 1 }`

- [ ] **Step 3: Commit**

```bash
git add server/db/pool.ts
git commit -m "feat: add Postgres connection pool"
```

---

## Phase 2 — Port Catalog + User Layer

### Task 5: Port catalog functions to Postgres

**Files:**
- Create: `server/db/catalog.ts`
- Modify: `server/db/index.ts` (create, re-export catalog)

Port these functions from `server/db.ts` to async Postgres equivalents in `server/db/catalog.ts`:

- `upsertIngredient(name)` → returns `Promise<number>`
- `getIngredientByName(name)`
- `insertDish(dish)` → returns `Promise<number | null>`
- `getDishesByIngredientNames(names)` → returns `Promise<DishRow[]>`
- `getDishesGroupedByIngredient(names)`
- `getDishCountForIngredient(name)`
- `hasSufficientCachedDishes(name, min?)`
- `getDishesForIngredient(name)`
- `getDishById(id)`
- `getDishesByIds(ids)`
- `parseDishRow(row)` — keep synchronous, no DB

Keep `MIN_CACHED_DISHES = 5` and `DishRow` interface identical.

Example `upsertIngredient`:

```typescript
import { query } from "./pool";
import { normalizeIngredient } from "./ingredientSignature";

export async function upsertIngredient(name: string): Promise<number> {
  const normalized = normalizeIngredient(name);
  const display = name.trim().charAt(0).toUpperCase() + name.trim().slice(1);
  await query(
    `INSERT INTO ingredients (name, normalized_name) VALUES ($1, $2)
     ON CONFLICT (name) DO UPDATE SET normalized_name = EXCLUDED.normalized_name`,
    [display, normalized]
  );
  const result = await query<{ id: number }>(
    `SELECT id FROM ingredients WHERE normalized_name = $1`,
    [normalized]
  );
  return result.rows[0].id;
}
```

- [ ] **Step 1: Write catalog.ts with all functions**
- [ ] **Step 2: Create server/db/index.ts re-exporting catalog + types**
- [ ] **Step 3: Update server/discovery.ts imports to use async/await**
- [ ] **Step 4: Update server/comboBuilder.ts imports to await catalog calls**
- [ ] **Step 5: Run lint:** `npm run lint` — fix all async propagation errors
- [ ] **Step 6: Commit**

```bash
git commit -m "feat: port catalog layer to Postgres"
```

---

### Task 6: Port user + feedback layer

**Files:**
- Create: `server/db/users.ts`
- Modify: `server/db/index.ts`
- Modify: `server/tasteEngine.ts` — await all db calls

Port from `server/db.ts`:

- `ensureUserProfile`, `getUserProfile`, `updateUserComboRules`
- `getTasteProfile`, `saveTasteProfile`, `DEFAULT_TASTE`, `TasteProfile` interface
- `insertCombo`, `updateComboStatus`
- `insertFeedback`, `getFeedbackForUser`
- **New:** `updateUserCity(userId, cityCode)`

Add to `users.ts`:

```typescript
export async function updateUserCity(userId: string, cityCode: string | null): Promise<void> {
  await query(
    `UPDATE user_profiles SET city_code = $1, updated_at = NOW() WHERE id = $2`,
    [cityCode?.trim().toLowerCase() || null, userId]
  );
}
```

Change `taste_profile` column reads/writes to use JSONB directly (no `JSON.stringify` on insert — pg handles JSONB).

- [ ] **Step 1: Implement users.ts**
- [ ] **Step 2: Make tasteEngine functions async**
- [ ] **Step 3: Update server.ts endpoints to await tasteEngine calls**
- [ ] **Step 4: Run lint + manual smoke test:** `npm run dev`, hit `POST /api/catalog/discover`
- [ ] **Step 5: Commit**

```bash
git commit -m "feat: port user and feedback layer to Postgres"
```

---

### Task 7: SQLite → Postgres data migration script

**Files:**
- Create: `scripts/migrate-sqlite-to-postgres.ts`

Only needed if production `data/vigadi.db` has data worth preserving.

```typescript
import Database from "better-sqlite3"; // temporarily reinstall for script only
import pg from "pg";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: ".env.local" });
dotenv.config();

async function main() {
  const sqlitePath = path.join(process.cwd(), "data/vigadi.db");
  const sqlite = new Database(sqlitePath, { readonly: true });
  const pgClient = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await pgClient.connect();

  const ingredients = sqlite.prepare("SELECT * FROM ingredients").all() as any[];
  for (const row of ingredients) {
    await pgClient.query(
      `INSERT INTO ingredients (id, name, normalized_name, created_at)
       VALUES ($1, $2, $3, $4) ON CONFLICT (name) DO NOTHING`,
      [row.id, row.name, row.normalized_name, row.created_at]
    );
  }

  const dishes = sqlite.prepare("SELECT * FROM dishes").all() as any[];
  for (const row of dishes) {
    await pgClient.query(
      `INSERT INTO dishes (id, ingredient_id, name, youtube_url, youtube_video_id,
        dish_type, spice_level, main_ingredients, pairs_with, description,
        channel_name, discovered_at, source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10,$11,$12,$13)
       ON CONFLICT (ingredient_id, name) DO NOTHING`,
      [
        row.id, row.ingredient_id, row.name, row.youtube_url, row.youtube_video_id,
        row.dish_type, row.spice_level, row.main_ingredients, row.pairs_with,
        row.description, row.channel_name, row.discovered_at, row.source,
      ]
    );
  }

  // Reset sequences
  await pgClient.query(`SELECT setval('ingredients_id_seq', (SELECT MAX(id) FROM ingredients))`);
  await pgClient.query(`SELECT setval('dishes_id_seq', (SELECT MAX(id) FROM dishes))`);

  sqlite.close();
  await pgClient.end();
  console.log(`Migrated ${ingredients.length} ingredients, ${dishes.length} dishes`);
}

main();
```

- [ ] **Step 1: Write script**
- [ ] **Step 2: Run if local SQLite has data:** `tsx scripts/migrate-sqlite-to-postgres.ts`
- [ ] **Step 3: Commit**

```bash
git commit -m "chore: add SQLite to Postgres migration script"
```

---

## Phase 3 — Global Combo Pool

### Task 8: Global combos data access

**Files:**
- Create: `server/db/globalCombos.ts`
- Create: `server/__tests__/globalCombos.test.ts`

- [ ] **Step 1: Write failing integration test**

Create `server/__tests__/globalCombos.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from "vitest";
import { upsertGlobalCombo, getPopularCombos } from "../db/globalCombos";

const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)("globalCombos", () => {
  const signature = "brinjal|potato";
  const dishIds = [1, 2, 3];

  it("upserts and increments selection count", async () => {
    const id1 = await upsertGlobalCombo({
      ingredientSignature: signature,
      dishIds,
      comboName: "Test Plate",
      subComponents: ["A", "B", "Rice"],
      cityCode: null,
    });
    const id2 = await upsertGlobalCombo({
      ingredientSignature: signature,
      dishIds,
      comboName: "Test Plate",
      subComponents: ["A", "B", "Rice"],
      cityCode: null,
    });
    expect(id1).toBe(id2);

    const popular = await getPopularCombos({ ingredientSignature: signature, cityCode: null, limit: 5 });
    expect(popular[0].selectionCount).toBeGreaterThanOrEqual(2);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `DATABASE_URL=... npm test -- server/__tests__/globalCombos.test.ts`

- [ ] **Step 3: Implement globalCombos.ts**

```typescript
import { query } from "./pool";

export interface GlobalComboRow {
  id: number;
  ingredientSignature: string;
  dishIds: number[];
  comboName: string;
  subComponents: string[];
  selectionCount: number;
  cityCode: string | null;
}

function rowToGlobalCombo(row: any): GlobalComboRow {
  return {
    id: row.id,
    ingredientSignature: row.ingredient_signature,
    dishIds: row.dish_ids,
    comboName: row.combo_name,
    subComponents: row.sub_components,
    selectionCount: row.selection_count,
    cityCode: row.city_code,
  };
}

export async function upsertGlobalCombo(params: {
  ingredientSignature: string;
  dishIds: number[];
  comboName: string;
  subComponents: string[];
  cityCode: string | null;
}): Promise<number> {
  const sortedIds = [...params.dishIds].sort((a, b) => a - b);
  const result = await query<{ id: number }>(
    `INSERT INTO global_combos
       (ingredient_signature, dish_ids, combo_name, sub_components, city_code, selection_count)
     VALUES ($1, $2::jsonb, $3, $4::jsonb, $5, 1)
     ON CONFLICT (ingredient_signature, dish_ids, COALESCE(city_code, ''))
     DO UPDATE SET
       selection_count = global_combos.selection_count + 1,
       last_selected_at = NOW()
     RETURNING id`,
    [
      params.ingredientSignature,
      JSON.stringify(sortedIds),
      params.comboName,
      JSON.stringify(params.subComponents),
      params.cityCode,
    ]
  );
  return result.rows[0].id;
}

export async function getPopularCombos(params: {
  ingredientSignature: string;
  cityCode: string | null;
  limit: number;
}): Promise<GlobalComboRow[]> {
  const result = await query(
    `SELECT * FROM global_combos
     WHERE ingredient_signature = $1
       AND (city_code = $2 OR city_code IS NULL)
     ORDER BY
       CASE WHEN city_code = $2 THEN 0 ELSE 1 END,
       selection_count DESC
     LIMIT $3`,
    [params.ingredientSignature, params.cityCode, params.limit]
  );
  return result.rows.map(rowToGlobalCombo);
}

/** Dual-write: city row + global row when city is set */
export async function recordGlobalSelection(params: {
  ingredientSignature: string;
  dishIds: number[];
  comboName: string;
  subComponents: string[];
  cityCode: string | null;
}): Promise<number> {
  const globalId = await upsertGlobalCombo({ ...params, cityCode: null });
  if (params.cityCode) {
    await upsertGlobalCombo({ ...params, cityCode: params.cityCode });
  }
  return globalId;
}
```

- [ ] **Step 4: Run test — expect PASS**
- [ ] **Step 5: Commit**

```bash
git commit -m "feat: add global combo pool data access"
```

---

### Task 9: Training events data access

**Files:**
- Create: `server/db/events.ts`

```typescript
import { query } from "./pool";

export async function insertGenerationSession(session: {
  id: string;
  userId: string;
  ingredientSignature: string;
  ingredients: string[];
  comboRules: string;
  category: string;
  slotsRequested: number;
  slotsFromGlobal: number;
  slotsGenerated: number;
}): Promise<void> {
  await query(
    `INSERT INTO generation_sessions
       (id, user_id, ingredient_signature, ingredients, combo_rules, category,
        slots_requested, slots_from_global, slots_generated)
     VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9)`,
    [
      session.id, session.userId, session.ingredientSignature,
      JSON.stringify(session.ingredients), session.comboRules, session.category,
      session.slotsRequested, session.slotsFromGlobal, session.slotsGenerated,
    ]
  );
}

export async function insertComboCandidate(candidate: {
  id: string;
  sessionId: string;
  comboName: string;
  dishIds: number[];
  source: "global_pool" | "gemini" | "rule_engine";
  globalComboId?: number;
  score?: number;
  rank: number;
  rationale?: string;
}): Promise<void> {
  await query(
    `INSERT INTO combo_candidates
       (id, session_id, combo_name, dish_ids, source, global_combo_id, score, rank, rationale)
     VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9)`,
    [
      candidate.id, candidate.sessionId, candidate.comboName,
      JSON.stringify(candidate.dishIds), candidate.source,
      candidate.globalComboId ?? null, candidate.score ?? null,
      candidate.rank, candidate.rationale ?? null,
    ]
  );
}

export async function insertSelectionEvent(event: {
  id: string;
  sessionId?: string;
  userId: string;
  selectedComboId: string;
  rejectedComboId?: string;
  dishIds: number[];
  rejectedDishIds?: number[];
  globalComboId?: number;
}): Promise<void> {
  await query(
    `INSERT INTO selection_events
       (id, session_id, user_id, selected_combo_id, rejected_combo_id,
        dish_ids, rejected_dish_ids, global_combo_id)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8)`,
    [
      event.id, event.sessionId ?? null, event.userId, event.selectedComboId,
      event.rejectedComboId ?? null, JSON.stringify(event.dishIds),
      event.rejectedDishIds ? JSON.stringify(event.rejectedDishIds) : null,
      event.globalComboId ?? null,
    ]
  );
}

export async function insertUserPreferredCombo(combo: {
  id: string;
  userId: string;
  globalComboId?: number;
  dishIds: number[];
  name: string;
  ingredientSignature: string;
}): Promise<void> {
  await query(
    `INSERT INTO user_preferred_combos
       (id, user_id, global_combo_id, dish_ids, name, ingredient_signature)
     VALUES ($1,$2,$3,$4::jsonb,$5,$6)`,
    [
      combo.id, combo.userId, combo.globalComboId ?? null,
      JSON.stringify(combo.dishIds), combo.name, combo.ingredientSignature,
    ]
  );
}
```

- [ ] **Step 1: Create events.ts**
- [ ] **Step 2: Export from server/db/index.ts**
- [ ] **Step 3: Commit**

```bash
git commit -m "feat: add training event data access"
```

---

### Task 10: Global-first combo build service

**Files:**
- Create: `server/globalComboService.ts`
- Modify: `server/comboBuilder.ts`
- Modify: `server.ts`

- [ ] **Step 1: Extend BuiltCombo interface in comboBuilder.ts**

```typescript
export interface BuiltCombo {
  id: string;
  name: string;
  dishIds: number[];
  subComponents: string[];
  dishes: ReturnType<typeof parseDishRow>[];
  staple: string;
  rationale: string;
  source: "global_pool" | "gemini" | "rule_engine";
  popularCount?: number;
  globalComboId?: number;
}
```

- [ ] **Step 2: Create globalComboService.ts**

```typescript
import { buildIngredientSignature } from "./db/ingredientSignature";
import { getPopularCombos, GlobalComboRow } from "./db/globalCombos";
import { getDishesByIds, getTasteProfile, getUserProfile, parseDishRow } from "./db";
import { buildCombosFromCatalog, BuiltCombo } from "./comboBuilder";
import {
  insertGenerationSession,
  insertComboCandidate,
} from "./db/events";
import { scoreDishForTaste } from "./comboBuilder"; // export this from comboBuilder

const SLOTS_REQUESTED = 2;
const MIN_TASTE_SCORE = -5;

export async function buildCombosGlobalFirst(params: {
  userId: string;
  ingredients: string[];
  rules: string;
  category: string;
}): Promise<{ combos: BuiltCombo[]; sessionId: string }> {
  const signature = buildIngredientSignature(params.ingredients);
  const profile = await getUserProfile(params.userId);
  const cityCode = profile?.city_code ?? null;
  const taste = await getTasteProfile(params.userId);
  const sessionId = `session-${Date.now()}`;

  const globalHits = await getPopularCombos({
    ingredientSignature: signature,
    cityCode,
    limit: SLOTS_REQUESTED,
  });

  const globalCombos: BuiltCombo[] = [];
  const usedDishIds = new Set<number>();

  for (const hit of globalHits) {
    const dishes = await getDishesByIds(hit.dishIds);
    if (dishes.length !== hit.dishIds.length) continue;

    const tasteScore = dishes.reduce(
      (sum, d) => sum + scoreDishForTaste(d, taste, d.ingredient_name ?? ""),
      0
    );
    if (tasteScore < MIN_TASTE_SCORE) continue;

    hit.dishIds.forEach((id) => usedDishIds.add(id));
    globalCombos.push({
      id: `combo-global-${hit.id}`,
      name: hit.comboName,
      dishIds: hit.dishIds,
      subComponents: hit.subComponents,
      dishes: dishes.map(parseDishRow),
      staple: "Rice",
      rationale: `Popular combo — picked ${hit.selectionCount} times`,
      source: "global_pool",
      popularCount: hit.selectionCount,
      globalComboId: hit.id,
    });
  }

  const slotsNeeded = SLOTS_REQUESTED - globalCombos.length;
  let generated: BuiltCombo[] = [];

  if (slotsNeeded > 0) {
    generated = await buildCombosFromCatalog({
      ...params,
      excludeDishIds: [...usedDishIds],
      maxCombos: slotsNeeded,
    });
  }

  const combos = [...globalCombos, ...generated].slice(0, SLOTS_REQUESTED);

  await insertGenerationSession({
    id: sessionId,
    userId: params.userId,
    ingredientSignature: signature,
    ingredients: params.ingredients,
    comboRules: params.rules,
    category: params.category,
    slotsRequested: SLOTS_REQUESTED,
    slotsFromGlobal: globalCombos.length,
    slotsGenerated: generated.length,
  });

  for (let i = 0; i < combos.length; i++) {
    await insertComboCandidate({
      id: `cand-${sessionId}-${i}`,
      sessionId,
      comboName: combos[i].name,
      dishIds: combos[i].dishIds,
      source: combos[i].source,
      globalComboId: combos[i].globalComboId,
      rank: i + 1,
      rationale: combos[i].rationale,
    });
  }

  return { combos, sessionId };
}
```

- [ ] **Step 3: Export scoreDishForTaste from comboBuilder.ts**
- [ ] **Step 4: Add excludeDishIds + maxCombos params to buildCombosFromCatalog**
- [ ] **Step 5: Update server.ts `/api/combos/build` to call buildCombosGlobalFirst**
- [ ] **Step 6: Manual test:** discover dishes → build combos twice → second build should show global_pool source if first was selected
- [ ] **Step 7: Commit**

```bash
git commit -m "feat: global-first combo build with session logging"
```

---

### Task 11: Global pool on combo select

**Files:**
- Modify: `server/tasteEngine.ts`

Add to `recordComboSelection`:

```typescript
import { buildIngredientSignature } from "./db/ingredientSignature";
import { recordGlobalSelection } from "./db/globalCombos";
import { insertSelectionEvent, insertUserPreferredCombo } from "./db/events";
import { getUserProfile } from "./db";

// Inside recordComboSelection, after ensureUserProfile:
const profile = await getUserProfile(params.userId);
const cityCode = profile?.city_code ?? null;
const signature = buildIngredientSignature(
  params.dishIds.map((id) => String(id)) // use ingredient names from dishes instead
);

// Load dish names for signature — use actual ingredients from dish rows:
const dishes = await getDishesByIds(params.dishIds);
const ingredientNames = [...new Set(dishes.map((d) => d.ingredient_name ?? ""))];
const ingredientSignature = buildIngredientSignature(ingredientNames);

const globalComboId = await recordGlobalSelection({
  ingredientSignature,
  dishIds: params.dishIds,
  comboName: params.comboName,
  subComponents: dishes.map((d) => d.name).concat(["Rice"]),
  cityCode,
});

await insertSelectionEvent({
  id: `sel-${Date.now()}`,
  userId: params.userId,
  selectedComboId: params.comboId,
  rejectedComboId: params.rejectedComboId,
  dishIds: params.dishIds,
  rejectedDishIds: params.rejectedDishIds,
  globalComboId,
});

await insertUserPreferredCombo({
  id: `pref-${Date.now()}`,
  userId: params.userId,
  globalComboId,
  dishIds: params.dishIds,
  name: params.comboName,
  ingredientSignature,
});
```

Make `recordComboSelection` fully async; update server.ts caller.

- [ ] **Step 1: Implement changes in tasteEngine.ts**
- [ ] **Step 2: Test flow:** build → select → build again with same ingredients → verify global_pool combo appears
- [ ] **Step 3: Commit**

```bash
git commit -m "feat: upsert global combo pool on user selection"
```

---

## Phase 4 — API + UI + Deploy

### Task 12: Profile city endpoint

**Files:**
- Modify: `server.ts`
- Modify: `src/components/ProfileView.tsx`

- [ ] **Step 1: Add PATCH endpoint in server.ts**

```typescript
app.patch("/api/profile/:userId", async (req, res) => {
  const { username, cityCode, comboRules } = req.body;
  const uid = req.params.userId;
  if (username) await ensureUserProfile(uid, username);
  if (cityCode !== undefined) await updateUserCity(uid, cityCode || null);
  if (comboRules) await updateUserComboRules(uid, comboRules);
  const profile = await getUserProfile(uid);
  res.json({ profile });
});
```

- [ ] **Step 2: Add optional city field to ProfileView.tsx**

Add a text input "City (optional)" that calls `PATCH /api/profile/:userId` on blur.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: optional city preference on user profile"
```

---

### Task 13: UI popular badge on combo cards

**Files:**
- Modify: `src/components/KitchenView.tsx`
- Modify: `src/types.ts`

- [ ] **Step 1: Extend Meal/Combo type with source and popularCount**

```typescript
source?: "global_pool" | "gemini" | "rule_engine";
popularCount?: number;
```

- [ ] **Step 2: Show badge in KitchenView when popularCount > 0**

```tsx
{meal.popularCount && meal.popularCount > 0 && (
  <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
    Popular · {meal.popularCount} picks
  </span>
)}
```

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: show popular combo badge in kitchen view"
```

---

### Task 14: Remove SQLite and in-memory state

**Files:**
- Delete: `server/db.ts` (old monolith — replaced by server/db/)
- Modify: `server.ts` — remove `INITIAL_MEALS` in-memory array
- Modify: `DEPLOY.md`, `render.yaml`, `railway.toml`

- [ ] **Step 1: Delete server/db.ts after all imports point to server/db/index.ts**
- [ ] **Step 2: Remove INITIAL_MEALS usage — all meals come from DB/API responses**
- [ ] **Step 3: Update render.yaml — remove disk block, add DATABASE_URL env var**
- [ ] **Step 4: Update DEPLOY.md — Postgres setup instructions (Neon), remove SQLite volume steps**
- [ ] **Step 5: Run full smoke test**

```bash
npm run lint
npm test
npm run preview
# Manual: discover → build → select → build again
```

- [ ] **Step 6: Commit**

```bash
git commit -m "chore: remove SQLite and in-memory meals, update deploy docs"
```

---

### Task 15: Auto-migrate on server startup

**Files:**
- Modify: `server/db/migrate.ts`
- Modify: `server.ts`

- [ ] **Step 1: Create server/db/migrate.ts that runs 001_initial.sql if not applied**

Use a `schema_migrations` table to track applied migrations.

- [ ] **Step 2: Call migrate() before app.listen in server.ts**

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: auto-run migrations on server startup"
```

---

## Verification Checklist

| Scenario | Expected |
|----------|----------|
| User A selects combo for Brinjal + Potato | `global_combos.selection_count = 1` |
| User B builds same ingredients | Response includes combo with `source: "global_pool"` |
| User B has city = chennai, city combo exists | City combo ranked above global |
| User with no city selects combo | Only global row incremented |
| User with city selects combo | City + global rows incremented |
| Full global pool (2 hits) | `slots_generated = 0`, no Gemini call |
| Empty global pool | Full generation, session logged |
| `npm test` | All tests pass |
| `npm run lint` | No type errors |

---

## Spec Coverage Self-Review

| Spec requirement | Task |
|-----------------|------|
| Postgres from day one | Tasks 1–4 |
| Catalog migration | Task 5 |
| User learning preserved | Task 6 |
| Global combo pool | Task 8 |
| Training events | Task 9 |
| Global-first build flow | Task 10 |
| Select upserts global pool | Task 11 |
| Optional city preference | Task 12 |
| UI popular badge | Task 13 |
| Remove SQLite | Task 14 |
| Anonymous aggregates | Task 8 (no user_id in global_combos) |
| Discovery cache unchanged | Task 5 (hasSufficientCachedDishes) |

No gaps found.
