# Dish Catalog Schema Redesign

**Date:** 2026-07-19  
**Status:** Approved for planning  
**Source file:** `/Users/mani/Claude/FIles/Vigadi/vigadi-dishes-final.csv` (730 dishes, 108 ingredients referenced)

## Goal

Replace the confusing dish catalog shape with the Excel/CSV structure exactly. No invented columns, no remapping of Excel values, no assumptions about food meaning beyond what the file contains.

Excel is the source of truth for dish rows. The app (meal templates, combo builder, UI) must read the new fields so menu suggestions use the cleaner taxonomy.

## Decisions (locked)

| Topic | Choice |
|-------|--------|
| Catalog source of truth | CSV replaces all `dishes` rows |
| Dish IDs | Preserve CSV `id` values |
| Ingredients | Keep existing `ingredients` table; only re-link dishes by `ingredient_id` |
| Old columns | Keep `dish_type` and `pairs_with` as deprecated (NULL after reload) |
| Dependent data | Wipe dish-linked data (combos, feedback, sessions, templates/plates JSON, etc.) |
| List fields | Store as JSONB arrays (split CSV `;` values, trim whitespace) |
| Column names | Match CSV: `dish_group`, `dish_category`, etc. |
| Excel structure | Do not change Excel values or collapse groups (e.g. Curry, Snack stay as-is) |
| App code | Update to use new fields for menus/templates/combos |
| Cutover style | Single migration + import script |

## Current vs target shape

### Current `dishes` (problematic)

- `dish_type` + `dish_category` used inconsistently across migrations and app code
- `pairs_with` as pairing signal
- Meal logic often re-derived dish role from names/`dish_type`

### Target `dishes` (from Excel)

| Column | Type | Source |
|--------|------|--------|
| `id` | INT PK | CSV `id` |
| `ingredient_id` | INT FK → `ingredients(id)` | CSV `ingredient_id` |
| `name` | TEXT | CSV `dish_name` |
| `dish_group` | TEXT | CSV `dish_group` (Side, Gravy, Curry, Tiffin, Chutney, Snack, Rice) |
| `dish_category` | TEXT | CSV `dish_category` (Poriyal, Kuzhambu, Kootu, …) |
| `consistency` | TEXT | CSV `consistency` (dry, semi_liquid, liquid, crisp) |
| `base_tags` | JSONB | CSV `base_tags` → `["rice","chapati",…]` |
| `accompaniments` | JSONB | CSV `accompaniments` → array; default `[]` |
| `english_alias` | TEXT NULL | CSV `english_alias` |
| `spice_level` | TEXT | CSV `spice_level` |
| `main_ingredients` | JSONB | CSV `main_ingredients` → array |
| `description` | TEXT | CSV `description` |
| `youtube_url` | TEXT NULL | CSV |
| `youtube_video_id` | TEXT NULL | CSV |
| `channel_name` | TEXT NULL | CSV |
| `source` | TEXT | CSV `source` |
| `discovered_at` | TIMESTAMPTZ | CSV `discovered_at` |
| `dish_type` | TEXT NULL | **Deprecated** — set NULL |
| `pairs_with` | JSONB NULL | **Deprecated** — set NULL |

Unchanged: `ingredients`, `ingredient_aliases` contents.

Import must fail (not invent) if a CSV `ingredient_id` is missing from `ingredients`.

## Cutover procedure

1. **Migration `007_dish_catalog_schema.sql`**
   - Add `dish_group`, `consistency`, `base_tags`, `accompaniments`, `english_alias` if missing
   - Ensure `dish_category` remains (values reloaded from CSV; meaning is Excel’s category, not the old meal-group misuse)
   - Add indexes useful for filtering: `dish_group`, `dish_category`, `consistency`
   - Leave `dish_type` / `pairs_with` in place as deprecated

2. **Wipe dish-linked data** (FK-safe order), including at least:
   - `selection_events`, `combo_candidates`, `generation_sessions`
   - `feedback`, `combos`, `user_preferred_combos`, `global_combos`
   - Reset `user_profiles.meal_templates` and `user_profiles.food_plates` to `[]`
   - Delete all rows from `dishes`

3. **Import script** (e.g. `scripts/import-dish-catalog-csv.ts`)
   - Read the CSV path above (or a repo copy if we vendor a snapshot for reproducibility)
   - Insert with explicit IDs
   - Parse list fields on `;` with trim → JSONB arrays
   - Empty optional strings → NULL (or `[]` for list fields)
   - Reset `dishes_id_seq` to `MAX(id)` after load

4. **App updates**
   - Catalog types / DB reads expose new fields
   - Meal templates & combo builder match slots using:
     - `dish_group` for plate role
     - `dish_category` for style within group
     - `base_tags` for pairing / staple coverage (replaces `pairs_with`)
   - UI labels show Excel values as stored (Title Case as in CSV; no forced remapping)
   - Extend plate-role support to all Excel `dish_group` values, including Curry and Snack
   - Match groups/categories case-insensitively in code; persist exact Excel strings in DB
   - Stop depending on deprecated `dish_type` / `pairs_with` for new logic
   - Update tests to the new model

5. **Verification**
   - Row count = 730
   - Spot-check IDs/names/groups against CSV
   - Template/combo tests pass
   - No code path required for suggestions still reads only deprecated columns

## Non-goals

- Editing or “fixing” Excel values
- Rebuilding or renaming ingredients from CSV
- Gradual dual-table migration
- Keeping stale combos/feedback across the cutover

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Missing `ingredient_id` in DB | Import aborts with clear list of missing IDs |
| App still assumes old lowercase meal groups only | Explicitly support Excel `dish_group` set including Curry & Snack |
| Templates after wipe are empty | Expected for demo; users rebuild plates against new catalog |
| CSV path outside repo | Document path; optionally copy snapshot into `data/` for CI |

## Success criteria

- DB dish rows match CSV field-for-field (lists as arrays)
- Deprecated columns are NULL
- Menu suggestion code uses `dish_group` / `dish_category` / `base_tags` / `consistency`
- Tests updated and green
