# Ingredient classification: primary vs always-secondary

**Date:** 2026-07-17
**Status:** Approved

## Problem

Combo building and unlock hints treated pantry/secondary ingredients as if
they gate dishes. Users were told to "Add tomato or tamarind to unlock Curry
dishes" even though those are staples everyone keeps at home. Dishes should be
gated only by their **primary** ingredient.

## Domain rule

- **Always-secondary** — never a dish's primary ingredient. Never gates, never
  suggested, never keys a dish. Starter set: `tamarind`, `oil` (any *… oil*),
  `salt`, `water`.
- **Contextually primary** — secondary by default but primary for signature
  dishes (e.g. `tomato` → Tomato Chutney, `curry leaves` → Curry Leaves Rice,
  `onion` → Onion Chutney). These are **not** in the always-secondary set, so
  they can key their signature dishes and gate only those dishes.

A dish's "primary" ingredient is whatever it is keyed to (`dishes.ingredient_id`).
So contextual primacy is decided at seeding time, not inferred at runtime.

## Design

### Shared helper — `shared/ingredientClassification.ts`

- `ALWAYS_SECONDARY_INGREDIENTS: Set<string>` (normalized names + aliases).
- `isAlwaysSecondary(name: string): boolean` — normalized, alias-aware; also
  matches any `"… oil"`.
- `stripAlwaysSecondary(names: string[]): string[]` — convenience filter.

### Wire-ups

1. **Gating** (`shared/catalogIngredients.ts`)
   - `expandCatalogIngredients` strips always-secondary from the ingredient list
     used to fetch/match dishes → combos never block on them.
   - `filterMixedRiceForIngredients` ignores always-secondary needles.
2. **Seeding** (`scripts/sync-dish-batch.ts`, `scripts/sync-dish-file.ts`)
   - Skip + warn when a block's primary ingredient is always-secondary, so no
     dish gets keyed to tamarind/oil/salt/water.
3. **Hints** (`server/mealTemplateBuilder.ts`)
   - `unlockIngredientHint` already suggests only primary ingredients; a test
     keeps it pantry-free.

## Out of scope (YAGNI)

- No runtime inference of "is tomato primary for this dish" — decided by keying.
- No UI changes to the ingredient catalog.

## Testing

- Unit tests for `isAlwaysSecondary` / `stripAlwaysSecondary` (tamarind & oil
  variants true; tomato, curry leaves, chicken, paneer false).
- Existing gating tests continue to pass; hints test enforces no pantry items.
