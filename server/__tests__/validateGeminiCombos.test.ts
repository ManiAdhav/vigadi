import { describe, it, expect } from "vitest";
import type { DishRow } from "../db/catalog";
import type { TasteProfile } from "../db/users";
import {
  validateAndRepairGeminiCombos,
  splitGeminiComboAnchorAndSides,
  parseComboRules,
  type GeminiComboDraft,
} from "../comboBuilder";
import { anchorSignature, scoreComboBalance } from "../comboBalance";

function dish(partial: Partial<DishRow> & Pick<DishRow, "id" | "name">): DishRow {
  return {
    id: partial.id,
    ingredient_id: partial.ingredient_id ?? partial.id,
    name: partial.name,
    dish_group: partial.dish_group ?? null,
    dish_category: partial.dish_category ?? null,
    consistency: partial.consistency ?? null,
    base_tags: null,
    accompaniments: null,
    english_alias: null,
    youtube_url: null,
    youtube_video_id: null,
    dish_type: null,
    spice_level: partial.spice_level ?? null,
    main_ingredients: null,
    pairs_with: null,
    description: null,
    channel_name: null,
    discovered_at: "2026-01-01",
    source: "test",
    ingredient_name: partial.ingredient_name,
  };
}

const emptyTaste: TasteProfile = {
  liked_dish_types: {},
  disliked_dish_types: {},
  liked_prep_styles: {},
  disliked_prep_styles: {},
  preferred_spice: null,
  liked_combos: [],
  disliked_combos: [],
  ingredient_preferences: {},
};

const catalog = {
  spicyFishCurry: dish({
    id: 1,
    name: "Meen Kuzhambu",
    ingredient_name: "Fish",
    spice_level: "spicy",
    consistency: "liquid",
    dish_group: "Gravy",
  }),
  mildCabbage: dish({
    id: 2,
    name: "Cabbage Poriyal",
    ingredient_name: "Cabbage",
    spice_level: "mild",
    consistency: "dry",
    dish_group: "Side",
  }),
  mildBeans: dish({
    id: 3,
    name: "Beans Poriyal",
    ingredient_name: "French beans",
    spice_level: "medium",
    consistency: "dry",
    dish_group: "Side",
  }),
  spicyFishFry: dish({
    id: 5,
    name: "Meen Varuval",
    ingredient_name: "Fish",
    spice_level: "spicy",
    consistency: "dry",
    dish_group: "Side",
  }),
  mediumSambar: dish({
    id: 6,
    name: "Sambar",
    ingredient_name: "Mixed veg",
    spice_level: "medium",
    consistency: "liquid",
    dish_group: "Gravy",
    dish_category: "sambar",
  }),
  mediumCarrot: dish({
    id: 7,
    name: "Carrot Poriyal",
    ingredient_name: "Carrot",
    spice_level: "medium",
    consistency: "dry",
    dish_group: "Side",
  }),
  lemonRice: dish({
    id: 8,
    name: "Elumichai Sadam",
    ingredient_name: "Rice",
    spice_level: "mild",
    consistency: "dry",
    dish_group: "Rice",
  }),
  kootuSide: dish({
    id: 9,
    name: "Sorakkai Kootu",
    ingredient_name: "Bottle gourd",
    spice_level: "medium",
    consistency: "semi_liquid",
    dish_group: "Side",
  }),
  brinjalCurry: dish({
    id: 10,
    name: "Brinjal Curry",
    ingredient_name: "Brinjal",
    spice_level: "medium",
    consistency: "liquid",
    dish_group: "Gravy",
  }),
  brinjalPoriyal: dish({
    id: 11,
    name: "Brinjal Poriyal",
    ingredient_name: "Brinjal",
    spice_level: "mild",
    consistency: "dry",
    dish_group: "Side",
  }),
};

const allDishes = Object.values(catalog);
const defaultRules = parseComboRules("1 gravy + 2 sides");

function sigKey(dishIds: number[], dishes: DishRow[]): string {
  const rows = dishIds.map((id) => dishes.find((d) => d.id === id)!);
  const split = splitGeminiComboAnchorAndSides(rows);
  if (!split) return "invalid";
  const sig = anchorSignature(split.anchor);
  return `${sig.consistencyBand}:${sig.spiceBand}`;
}

describe("splitGeminiComboAnchorAndSides", () => {
  it("treats first gravy/curry/rice dish as anchor", () => {
    const rows = [catalog.mildCabbage, catalog.spicyFishCurry, catalog.mildBeans];
    const split = splitGeminiComboAnchorAndSides(rows);
    expect(split!.anchor.id).toBe(catalog.spicyFishCurry.id);
    expect(split!.sides.map((d) => d.id)).toEqual([
      catalog.mildCabbage.id,
      catalog.mildBeans.id,
    ]);
  });
});

describe("validateAndRepairGeminiCombos", () => {
  it("keeps well-balanced Gemini combos with unique signatures", () => {
    const drafts: GeminiComboDraft[] = [
      { dishIds: [1, 2, 3], name: "Fish plate", rationale: "Balanced" },
      { dishIds: [6, 7, 5], name: "Sambar plate", rationale: "Everyday" },
    ];

    const result = validateAndRepairGeminiCombos({
      geminiCombos: drafts,
      catalogDishes: allDishes,
      rules: defaultRules,
      taste: emptyTaste,
      ingredients: ["Fish", "Cabbage", "Carrot"],
      category: "lunch",
      maxCombos: 2,
    });

    expect(result).toHaveLength(2);
    expect(result.filter((c) => c.source === "gemini")).toHaveLength(2);
    const sigs = result.map((c) => sigKey(c.dishIds, allDishes));
    expect(new Set(sigs).size).toBe(2);
  });

  it("replaces combos with poor balance scores", () => {
    const badDraft: GeminiComboDraft = {
      dishIds: [1, 5, 2],
      name: "Double spicy fish",
      rationale: "Too hot",
    };
    const split = splitGeminiComboAnchorAndSides([
      catalog.spicyFishCurry,
      catalog.spicyFishFry,
      catalog.mildCabbage,
    ])!;
    expect(scoreComboBalance(split.anchor, split.sides)).toBeLessThan(0);

    const result = validateAndRepairGeminiCombos({
      geminiCombos: [badDraft],
      catalogDishes: allDishes,
      rules: defaultRules,
      taste: emptyTaste,
      ingredients: ["Fish", "Cabbage", "Carrot"],
      category: "lunch",
      maxCombos: 1,
    });

    expect(result).toHaveLength(1);
    expect(result[0].source).toBe("rule_engine");
    const keptSplit = splitGeminiComboAnchorAndSides(
      result[0].dishIds.map((id) => allDishes.find((d) => d.id === id)!)
    )!;
    expect(scoreComboBalance(keptSplit.anchor, keptSplit.sides)).toBeGreaterThanOrEqual(0);
  });

  it("replaces duplicate-signature combos, keeping the first", () => {
    const drafts: GeminiComboDraft[] = [
      { dishIds: [1, 2, 3], name: "Fish A" },
      { dishIds: [1, 7, 3], name: "Fish B duplicate sig" },
    ];

    const result = validateAndRepairGeminiCombos({
      geminiCombos: drafts,
      catalogDishes: allDishes,
      rules: defaultRules,
      taste: emptyTaste,
      ingredients: ["Fish", "Cabbage", "Carrot"],
      category: "lunch",
      maxCombos: 2,
    });

    expect(result).toHaveLength(2);
    const geminiKept = result.filter((c) => c.source === "gemini");
    expect(geminiKept).toHaveLength(1);
    expect(geminiKept[0].dishIds).toEqual([1, 2, 3]);
    const sigs = result.map((c) => sigKey(c.dishIds, allDishes));
    expect(new Set(sigs).size).toBe(2);
  });

  it("replaces combos violating B3 ingredient reuse", () => {
    const drafts: GeminiComboDraft[] = [
      { dishIds: [10, 11, 2], name: "Double brinjal" },
    ];

    const result = validateAndRepairGeminiCombos({
      geminiCombos: drafts,
      catalogDishes: allDishes,
      rules: defaultRules,
      taste: emptyTaste,
      ingredients: ["Brinjal", "Cabbage"],
      category: "lunch",
      maxCombos: 1,
    });

    expect(result).toHaveLength(1);
    expect(result[0].source).toBe("rule_engine");
    const ids = result[0].dishIds;
    expect(ids.includes(10) && ids.includes(11)).toBe(false);
  });

  it("fills remaining slots with rule-engine combos", () => {
    const drafts: GeminiComboDraft[] = [
      { dishIds: [1, 2, 3], name: "Fish plate" },
    ];

    const result = validateAndRepairGeminiCombos({
      geminiCombos: drafts,
      catalogDishes: allDishes,
      rules: defaultRules,
      taste: emptyTaste,
      ingredients: ["Fish", "Cabbage", "Carrot", "Rice"],
      category: "lunch",
      maxCombos: 2,
    });

    expect(result).toHaveLength(2);
    expect(result.some((c) => c.source === "gemini")).toBe(true);
    expect(result.some((c) => c.source === "rule_engine")).toBe(true);
    const sigs = result.map((c) => sigKey(c.dishIds, allDishes));
    expect(new Set(sigs).size).toBe(2);
  });

  it("skips plain rice staple when anchor is Rice group", () => {
    const drafts: GeminiComboDraft[] = [
      { dishIds: [8, 9, 2], name: "Lemon rice", staple: "Rice", subComponents: ["Rice", "Kootu", "Cabbage"] },
    ];

    const result = validateAndRepairGeminiCombos({
      geminiCombos: drafts,
      catalogDishes: [catalog.lemonRice, catalog.kootuSide, catalog.mildCabbage],
      rules: defaultRules,
      taste: emptyTaste,
      ingredients: ["Rice", "Bottle gourd", "Cabbage"],
      category: "lunch",
      maxCombos: 1,
    });

    expect(result[0].staple).toBe("");
    expect(result[0].subComponents).not.toContain("Rice");
  });

  it("omits rice staple for breakfast category", () => {
    const drafts: GeminiComboDraft[] = [
      { dishIds: [1, 2, 3], name: "Fish breakfast" },
    ];

    const result = validateAndRepairGeminiCombos({
      geminiCombos: drafts,
      catalogDishes: [catalog.spicyFishCurry, catalog.mildCabbage, catalog.mildBeans],
      rules: defaultRules,
      taste: emptyTaste,
      ingredients: ["Fish", "Cabbage"],
      category: "breakfast",
      maxCombos: 1,
    });

    expect(result[0].staple).toBe("");
    expect(result[0].subComponents).not.toContain("Rice");
  });
});
