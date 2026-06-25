# Vigadi Global Learning Database — Design Spec

**Date:** 2026-06-25  
**Status:** Draft — awaiting review  
**Scope:** Replace SQLite-only storage with Postgres + global combo pool + event-sourced training data

---

## Problem

Vigadi's value depends on two compounding loops:

1. **Combo quality** — assembling meals that feel right for Tamil Nadu-style rules and available ingredients.
2. **Preference learning** — getting faster and more accurate with each user interaction.

The current SQLite schema stores dish catalog and a collapsed per-user `taste_profile` JSON blob. It does **not**:

- Treat every combo generation as permanent training data.
- Share proven combos across users (compounding).
- Reduce Gemini calls by reusing globally popular combos for the same ingredient set.
- Support optional geographic preference when city data is available.

The word "cache" in the existing codebase refers only to **avoiding repeat Gemini calls for dish discovery** (ingredient → YouTube catalog). That optimization stays. What changes is the **learning and combo reuse architecture**.

---

## Goals

| Goal | Success criteria |
|------|------------------|
| Global combo compounding | User B with same ingredients as User A can receive User A's combo as a suggestion without regenerating it |
| Reduced generation cost | Global pool hit = zero Gemini cost for that combo slot |
| Every generation is training data | Full session context, candidate scores, and selection outcomes persisted |
| User-level learning preserved | Private taste profile and feedback remain per-user |
| Optional city preference | Use city when available; fall back to global ranking when not |
| Social proof in UI | Show selection counts on popular combos ("47 families picked this") |

## Non-goals (v1)

- Exposing which specific user picked a combo (anonymous aggregates only)
- ML model training pipeline (schema supports it; implementation is later)
- Mandatory location/city at signup
- Migrating off Postgres once chosen (SQLite removed after migration)

---

## Architecture Overview

Four logical layers in a single Postgres database:

```
┌─────────────────────────────────────────────────────────┐
│  Layer 4: Training Events (immutable)                   │
│  generation_sessions, combo_candidates, selection_events│
├─────────────────────────────────────────────────────────┤
│  Layer 3: Global Combo Pool (cross-user, compounding)   │
│  global_combos (+ optional city_code)                   │
├─────────────────────────────────────────────────────────┤
│  Layer 2: User Learning (private)                       │
│  user_profiles, feedback, user_preferred_combos          │
├─────────────────────────────────────────────────────────┤
│  Layer 1: Catalog (shared, slow-changing)               │
│  ingredients, dishes                                    │
└─────────────────────────────────────────────────────────┘
```

**Database:** Postgres (Neon or Supabase recommended).  
**Discovery cache:** Unchanged behavior — once an ingredient's dishes are in `dishes`, skip Gemini unless `forceRefresh`.

---

## Data Model

### Layer 1 — Catalog

Migrated from current SQLite schema with minimal changes.

#### `ingredients`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | |
| name | TEXT UNIQUE | Display name |
| normalized_name | TEXT UNIQUE | Lowercase, trimmed |
| created_at | TIMESTAMPTZ | Default now() |

#### `dishes`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | |
| ingredient_id | INT FK → ingredients | |
| name | TEXT | |
| youtube_url | TEXT | |
| youtube_video_id | TEXT | |
| dish_type | TEXT | gravy, side, etc. |
| spice_level | TEXT | |
| main_ingredients | JSONB | |
| pairs_with | JSONB | |
| description | TEXT | |
| channel_name | TEXT | |
| discovered_at | TIMESTAMPTZ | |
| source | TEXT | `gemini_grounding`, `offline_template` |
| UNIQUE | (ingredient_id, name) | |

---

### Layer 2 — User Learning

#### `user_profiles`
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | Client-generated or auth ID |
| username | TEXT | |
| combo_rules | TEXT | Default Tamil Nadu rules |
| taste_profile | JSONB | **Derived** summary; not source of truth |
| city_code | TEXT NULL | Optional — e.g. `chennai`, `coimbatore` |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

#### `feedback`
Immutable event log (existing concept, extended).

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| user_id | TEXT FK → user_profiles | |
| dish_id | INT NULL FK → dishes | |
| combo_id | TEXT NULL | References session or global combo |
| thumb | TEXT | `up` / `down` |
| feedback_type | TEXT | `dish_format`, `combo_selection`, etc. |
| notes | TEXT NULL | |
| metadata | JSONB NULL | |
| created_at | TIMESTAMPTZ | |

#### `user_preferred_combos`
User-level saved combos (private history).

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| user_id | TEXT FK | |
| global_combo_id | INT NULL FK → global_combos | Link if originated from pool |
| dish_ids | JSONB | Ordered array of dish IDs |
| name | TEXT | |
| ingredient_signature | TEXT | Normalized ingredient hash |
| selected_at | TIMESTAMPTZ | |

---

### Layer 3 — Global Combo Pool

The compounding engine. Anonymous aggregates only.

#### `global_combos`

| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | |
| ingredient_signature | TEXT | Sorted, normalized, pipe-delimited: `brinjal\|potato` |
| dish_ids | JSONB | Sorted array of dish IDs defining the combo |
| combo_name | TEXT | Human-readable name |
| sub_components | JSONB | Dish names + staple |
| selection_count | INT | Default 1; incremented on each pick |
| city_code | TEXT NULL | Optional — set when picker had city; NULL = global |
| first_seen_at | TIMESTAMPTZ | |
| last_selected_at | TIMESTAMPTZ | |
| UNIQUE | (ingredient_signature, dish_ids, city_code) | city_code NULL treated as distinct global row |

**Upsert on selection:**
```sql
INSERT INTO global_combos (ingredient_signature, dish_ids, combo_name, sub_components, city_code, selection_count)
VALUES ($1, $2, $3, $4, $5, 1)
ON CONFLICT (ingredient_signature, dish_ids, city_code)
DO UPDATE SET
  selection_count = global_combos.selection_count + 1,
  last_selected_at = NOW();
```

When user has no city: write/read rows where `city_code IS NULL` (global bucket).  
When user has city: write to both city-specific row **and** increment global row (dual-write for compounding at both levels).

---

### Layer 4 — Training Events

#### `generation_sessions`

One row per `/api/combos/build` call.

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| user_id | TEXT FK | |
| ingredient_signature | TEXT | |
| ingredients | JSONB | Raw ingredient list |
| combo_rules | TEXT | |
| category | TEXT | Lunch, Dinner, etc. |
| slots_requested | INT | Usually 2 |
| slots_from_global | INT | How many filled from pool |
| slots_generated | INT | How many from Gemini/rules |
| created_at | TIMESTAMPTZ | |

#### `combo_candidates`

All options considered or returned, not just winners.

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| session_id | TEXT FK → generation_sessions | |
| combo_name | TEXT | |
| dish_ids | JSONB | |
| source | TEXT | `global_pool`, `gemini`, `rule_engine` |
| global_combo_id | INT NULL | If from pool |
| score | NUMERIC NULL | Taste-adjusted score |
| rank | INT | Position in final list |
| shown_to_user | BOOLEAN | |
| rationale | TEXT NULL | Gemini explanation if any |
| created_at | TIMESTAMPTZ | |

#### `selection_events`

One row per `/api/combos/select` call.

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| session_id | TEXT NULL FK | Link to build session if known |
| user_id | TEXT FK | |
| selected_combo_id | TEXT | Candidate or global ID |
| rejected_combo_id | TEXT NULL | |
| dish_ids | JSONB | Selected dishes |
| rejected_dish_ids | JSONB NULL | |
| global_combo_id | INT NULL FK | If selection promoted global pool |
| created_at | TIMESTAMPTZ | |

---

## Ingredient Signature

Normalized key for matching ingredient sets across users.

```typescript
function buildIngredientSignature(ingredients: string[]): string {
  return ingredients
    .map(i => i.trim().toLowerCase().replace(/\s+/g, " "))
    .filter(i => i && i !== "rice")
    .sort()
    .join("|");
}
```

Rice is excluded — it is always the staple, not a discriminating ingredient.

---

## Combo Build Flow

```
POST /api/combos/build
  │
  ├─ 1. Normalize ingredients → signature
  ├─ 2. Load user taste profile + optional city_code
  │
  ├─ 3. Query global_combos:
  │     WHERE ingredient_signature = $sig
  │     AND (city_code = $city OR city_code IS NULL)
  │     ORDER BY
  │       CASE WHEN city_code = $city THEN 0 ELSE 1 END,  -- city match first
  │       selection_count DESC
  │     LIMIT 2
  │
  ├─ 4. Score global hits against user taste profile
  │     (boost liked prep styles, penalize avoided)
  │
  ├─ 5. slots_needed = 2 - valid_global_hits
  │     If slots_needed > 0 → Gemini or rule engine fills gaps
  │
  ├─ 6. Insert generation_session + combo_candidates (all results)
  │
  └─ 7. Return:
        - global hits tagged source: "global_pool", popularCount: N
        - generated combos tagged source: "gemini" | "rule_engine"
```

---

## Combo Select Flow

```
POST /api/combos/select
  │
  ├─ 1. Insert selection_event (immutable)
  ├─ 2. Insert/update user_preferred_combos
  ├─ 3. Upsert global_combos (increment selection_count)
  │     - If user.city_code set → upsert city row + global row
  │     - Else → upsert global row only
  ├─ 4. Insert feedback events (existing tasteEngine logic)
  ├─ 5. Recompute taste_profile from feedback (derived view)
  └─ 6. Return updated taste profile
```

---

## City Preference (Optional)

| User has city? | Read behavior | Write behavior |
|----------------|---------------|----------------|
| No | Global pool only (`city_code IS NULL`) | Write global row only |
| Yes | Prefer city matches, fall back to global | Dual-write: city row + global row |

City is stored on `user_profiles.city_code` as a free-text normalized slug (e.g. `chennai`). No geolocation API in v1 — user provides it optionally in profile settings.

UI shows:
- **"Popular · 47 picks"** — global count
- **"Popular in Chennai · 12 picks"** — when city row exists and user has matching city

---

## Privacy Model

**Anonymous aggregates only (Option A).**

- Global pool stores combo composition + counts, never user identity.
- User B sees "47 families picked this", not "User A picked this".
- Per-user history stays in `user_preferred_combos` and `feedback`, queryable only by that user.

---

## Migration Plan

### Phase 1 — Postgres setup
- Add `@neondatabase/serverless` or `pg` + connection pool
- Create schema via migration file (`migrations/001_initial.sql`)
- Add `DATABASE_URL` to `.env.example`

### Phase 2 — Dual-write / read switch
- Implement Postgres data access layer (`server/db/postgres.ts`)
- Keep SQLite read for catalog during transition OR one-time export script
- Migrate existing `data/vigadi.db` rows to Postgres

### Phase 3 — Global pool + events
- Add `global_combos`, `generation_sessions`, `combo_candidates`, `selection_events`
- Update `buildCombosFromCatalog` to query global pool first
- Update `recordComboSelection` to upsert global pool

### Phase 4 — Remove SQLite
- Delete `better-sqlite3` dependency
- Remove `data/vigadi.db` volume requirement from DEPLOY.md
- Update Render/Railway config for `DATABASE_URL` only

---

## API Changes

### Existing endpoints (behavior changes)

| Endpoint | Change |
|----------|--------|
| `POST /api/combos/build` | Returns mix of global + generated; adds `source` and `popularCount` fields |
| `POST /api/combos/select` | Upserts global pool; logs selection_event |
| `GET /api/taste/:userId` | Unchanged |
| `POST /api/catalog/discover` | Same logic; writes to Postgres instead of SQLite |

### New endpoints

| Endpoint | Purpose |
|----------|---------|
| `PATCH /api/profile/:userId` | Set optional `city_code` |
| `GET /api/combos/popular?ingredients=...` | Debug/admin: top global combos for ingredient set |

---

## UI Changes

- Combo cards from global pool show badge: **"Popular · N picks"**
- If city match: **"Popular in {city} · N picks"**
- No change to discover flow UX

---

## Testing Strategy

| Test | Assert |
|------|--------|
| User A selects combo for [brinjal, potato] | `global_combos` row exists, count = 1 |
| User B builds combo for [brinjal, potato] | Response includes User A's combo with `source: global_pool` |
| User B has different taste (dislikes a dish in global combo) | Global combo scored lower; may not appear if below threshold |
| User with city selects combo | Both city and global rows incremented |
| User without city selects combo | Only global row incremented |
| Build with full global pool (2 hits) | Zero Gemini calls; `slots_generated = 0` in session |
| Build with empty global pool | Full Gemini/rule generation; session logged |

---

## Open Questions (resolved)

| Question | Decision |
|----------|----------|
| Cache vs DB for discovery | Keep discovery cache in DB (Postgres); add global combo pool separately |
| Shared learning scope | All users contribute anonymously to global pool |
| City preference | Optional; use when available, global fallback otherwise |
| Privacy | Anonymous aggregates only; no user attribution in global stats |

---

## Recommended Stack

| Component | Choice |
|-----------|--------|
| Database | Postgres via Neon (serverless, free tier) |
| Driver | `pg` with connection pool, or `@neondatabase/serverless` |
| Migrations | Plain SQL files in `migrations/` |
| Hosting | Existing Render/Railway + `DATABASE_URL` env var |

---

## What This Buys Vigadi

1. **Compounding** — proven combos reused across users; effort decreases over time.
2. **Lower Gemini cost** — global hits cost nothing to serve.
3. **Training data from day one** — every build and select is a permanent, queryable event.
4. **Social proof** — most-selected combos highlighted in UI.
5. **City-aware suggestions** — ready when location data exists; invisible when it doesn't.
