# Combo Balance Engine — TN Plate Balance Rules

Implementation plan for Cursor. Discussed and approved by Mani, Jul 21 2026.

## Problem

The current combo generation (`server/comboBuilder.ts`) fills slots ("1 gravy + 2 sides") but
ignores how Tamil Nadu people actually balance a plate. Real TN combos balance each other on
two axes:

- **Spice see-saw** — spicy anchor → mild sides (fish curry + cabbage poriyal); mild anchor →
  at least one spicy side (podalangai kootu + fish fry / potato masala).
- **Wetness see-saw** — liquid anchor → at least one dry/crisp side (kara kuzhambu +
  cauliflower 65); dry anchor (variety rice) → a semi-liquid side (lemon rice + bottle gourd kootu).

Also: when 5 combos are generated, they currently all follow the same shape. They must vary.

## Design decisions (already made — do not relitigate)

1. **Two checkpoints.** Checkpoint 1: if the user chose a **meal template**, the template defines
   the plate structure — balance only influences *which dish fills a slot* when several candidates
   match. Checkpoint 2: no template (user chose only a meal time) → the balance rules below define
   both structure and filling. The balance rules are the hard-coded seed of the default Meal Plan
   (app targets Tamil Nadu users; per-user learned plans are future work, out of scope here).
2. **Balance is scoring inside the existing pipeline**, not a new configurable schema. No new
   user-facing settings, no Meal Plan tables. The existing taste scoring
   (`scoreDishForTaste`) stays and acts as the tie-breaker *within* balance-valid options.
3. **Archetypes give variety.** The N generated combos must not share the same shape (see below).
4. **Data is ready.** All dishes already carry `consistency` (`dry` / `semi_liquid` / `liquid` /
   `crisp`), `dish_group` (`Gravy` / `Curry` / `Side` / `Chutney` / `Rice` / `Tiffin` / `Snack`),
   and `spice_level` (`mild` / `medium` / `spicy` / `very_spicy`). No migration, no re-tagging.
   Keyword inference is only a *fallback* for future dishes with NULL consistency.

## The rules

### Axis values

- Spice score: mild=1, medium=2, spicy=3, very_spicy=4. Spicy band = score ≥ 3, mild band = ≤ 2.
- Consistency: use the `consistency` column. Fallback (NULL only) — infer from
  `dish_category`/name keywords: kuzhambu|sambar|rasam|gravy|curry → `liquid`;
  kootu|pachadi|chutney|thuvaiyal|masala → `semi_liquid`; poriyal|fry|roast|varuval|65|sundal →
  `dry`; else `semi_liquid`. For see-saw checks, `crisp` counts as dry (it is the strongest dry).

### Balance rules (apply to every combo, both checkpoints)

- **B1 Spice see-saw:** if the anchor (gravy/curry/rice anchor) is spicy band, every side must be
  mild band. If the anchor is mild band, at least one side must be spicy band. Penalize combos
  where all dishes share one spice level.
- **B2 Wetness see-saw:** if the anchor is `liquid` or `semi_liquid`, at least one side must be
  `dry`/`crisp` (prefer `crisp` for `liquid` anchors). If the anchor is `dry` (variety rice,
  dish_group `Rice`), prefer a `semi_liquid` side. Never all-liquid or all-dry.
- **B3 Ingredient diversity + protein exception:** keep the existing "no repeated main
  ingredient" rule, but allow same-protein pairs — they are culturally correct
  (meen kuzhambu + meen varuval, chicken curry + chicken 65). Protein = the dish's ingredient
  has category `protein` in the ingredient catalog (fish, chicken, egg, prawn, mutton…).

Implement B1/B2 as a **score** (bonus for satisfied, penalty for violated), not hard filters —
small catalogs must still produce combos. A combo violating a see-saw loses to one that
satisfies it, but is still emitted if nothing better exists.

### Archetypes (variety across the generated combos — checkpoint 2 only)

Each combo generated in the no-template path is built against one archetype:

| | Anchor | Sides |
|---|---|---|
| A | spicy liquid gravy/curry | 2 mild dry/crisp sides |
| B | mild liquid/semi_liquid (kootu-style) | 1 spicy dry/crisp (fry/65/roast) + 1 medium side |
| C | everyday sambar plate | all medium, classic |
| D | dry anchor from dish_group `Rice` (variety rice) | 1 semi_liquid side (kootu/pachadi) |
| E | non-veg: same-protein pair (curry + fry of one protein) | + 1 mild veg side |

- **E is ingredient-gated:** it competes only when the user's picked ingredients include a
  protein-category ingredient. No protein picked → only A–D.
- Fill one combo per archetype, picking the highest (taste + balance) scoring candidate set.
  If the catalog can't fill an archetype, skip it and backfill from the next best — but **no two
  emitted combos may share the same signature** (anchor consistency band + anchor spice band).
- In the **template path**, archetypes do NOT apply — structure is the template's. Variety there
  means different dishes across combos (already handled by `usedIds`).

## Where the code changes

All in `repo/server/` unless noted. Suggested new module: `server/comboBalance.ts` holding the
axis helpers, balance scorer, and archetype definitions — imported by both builders.

1. **`comboBalance.ts` (new):**
   - `spiceScore(dish)`, `getConsistency(dish)` (column first, keyword fallback),
     `isProteinDish(dish)` (ingredient category lookup — `ingredient_catalog_slug` /
     `ingredient_id` → ingredient category).
   - `scoreComboBalance(anchor, sides): number` implementing B1 + B2.
   - `ARCHETYPES` array with predicate per role (anchor filter, side filters) + `signature()`.
2. **`comboBuilder.ts` — rule-based path:** rework `buildCombosRuleBased` /
   `pickDishesForCombo` to iterate archetypes instead of the flat `variant` loop:
   for each archetype, filter candidate anchors/sides by the archetype predicates, rank by
   existing `scoreDishForTaste` + `scoreComboBalance`, apply B3 (with protein exception),
   emit best combo, mark `usedIds`, enforce unique signatures. Keep `parseComboRules` — its
   gravy/side counts still bound combo size; archetypes refine, not replace, the counts.
   Update `rationale` to state the balance in plain words, e.g. "Spicy fish curry balanced with
   mild cabbage poriyal and beans poriyal."
3. **`comboBuilder.ts` — Gemini path:** add the balance rules B1–B3 and the archetype-variety
   requirement to the prompt in `buildCombosWithGemini` (dish payload already includes spice;
   also include `consistency` and `dish_group` per dish). After parsing the response, validate
   each combo with `scoreComboBalance` + the signature-uniqueness check; replace violating
   combos with rule-engine-built ones for the missing archetypes.
4. **`mealTemplateBuilder.ts` — template path (checkpoint 1):** in the candidate ranking inside
   slot filling (`dishesMatchingSlot` consumers), add `scoreComboBalance` of the candidate
   *against dishes already picked for this combo* as a secondary sort key after slot match and
   taste score. Do NOT change slot structure, counts, or `shouldFillSlotAtMeal` logic.
5. **Rice staple:** unchanged (added for non-breakfast). One addition: when the anchor is
   dish_group `Rice` (archetype D), do not add plain "Rice" again — the variety rice IS the staple.

## Must NOT change

- API request/response shapes of `/api/combos/build` and template endpoints.
- `scoreDishForTaste` behavior and the taste-profile learning flow (select → taste engine).
- Template structure semantics — a template's slots are law; balance only breaks ties.
- Breakfast rice exclusion; `MIN_COMBOS`/`MAX_COMBOS`.
- No new DB tables/columns, no new user settings.

## Acceptance criteria (plain-English, testable)

1. With ingredients incl. fish + cabbage + potato + brinjal: a fish-curry combo's sides are all
   mild/medium — never a second spicy dish alongside a spicy anchor.
2. With a mild kootu as anchor: the combo contains at least one spicy dry side when one exists
   in the candidate pool.
3. A liquid-anchor combo always contains at least one dry/crisp side when one exists.
4. Fish curry + fish fry can appear in the same combo (protein exception); brinjal curry +
   brinjal poriyal cannot.
5. Requesting 5 combos yields ≥3 distinct archetype signatures; no two combos share
   (anchor consistency band + anchor spice band).
6. Archetype E appears only when a protein-category ingredient was picked.
7. A variety-rice combo has no duplicate "Rice" staple and prefers a semi_liquid side.
8. Template-driven builds produce identical slot structure as before this change (regression
   guard) — only the chosen dishes may differ.
9. Unit tests for the above in `server/__tests__/` (pure functions in `comboBalance.ts` make
   1–7 testable without DB); `npm run lint` and `npm test` pass.
