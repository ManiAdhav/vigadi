import { describe, it, expect } from "vitest";
import type { DishRow } from "../db/catalog";
import type { TasteProfile } from "../db/users";
import {
  assembleRuleBasedCombos,
  parseComboRules,
} from "../comboBuilder";
import { allowsIngredientReuse, anchorSignature } from "../comboBalance";

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
  mildKootu: dish({
    id: 4,
    name: "Podalangai Kootu",
    ingredient_name: "Snake gourd",
    spice_level: "mild",
    consistency: "semi_liquid",
    dish_group: "Curry",
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
  chickenCurry: dish({
    id: 12,
    name: "Chicken Curry",
    ingredient_name: "Chicken",
    spice_level: "medium",
    consistency: "liquid",
    dish_group: "Gravy",
  }),
  chicken65: dish({
    id: 13,
    name: "Chicken 65",
    ingredient_name: "Chicken",
    spice_level: "spicy",
    consistency: "crisp",
    dish_group: "Side",
  }),
  mildPotato: dish({
    id: 14,
    name: "Potato Poriyal",
    ingredient_name: "Potato",
    spice_level: "mild",
    consistency: "dry",
    dish_group: "Side",
  }),
};

const allDishes = Object.values(catalog);
const defaultRules = parseComboRules("1 gravy + 2 sides");

describe("assembleRuleBasedCombos", () => {
  it("produces distinct anchor signatures across combos", () => {
    const combos = assembleRuleBasedCombos({
      dishes: allDishes,
      rules: defaultRules,
      taste: emptyTaste,
      ingredients: ["Fish", "Cabbage", "Snake gourd", "Carrot", "Rice", "Chicken"],
      category: "lunch",
      maxCombos: 5,
    });

    expect(combos.length).toBeGreaterThanOrEqual(3);
    const sigKeys = combos.map((c) => {
      const anchorId = c.dishIds[0];
      const anchor = allDishes.find((d) => d.id === anchorId)!;
      const sig = anchorSignature(anchor);
      return `${sig.consistencyBand}:${sig.spiceBand}`;
    });
    expect(new Set(sigKeys).size).toBe(sigKeys.length);
  });

  it("excludes archetype E when no protein ingredient picked", () => {
    const combos = assembleRuleBasedCombos({
      dishes: allDishes,
      rules: defaultRules,
      taste: emptyTaste,
      ingredients: ["Cabbage", "Carrot", "Rice"],
      category: "lunch",
      maxCombos: 5,
    });

    const hasSameProteinPair = combos.some((c) => {
      const dishes = c.dishIds.map((id) => allDishes.find((d) => d.id === id)!);
      const proteins = dishes.filter((d) => d.ingredient_name === "Chicken" || d.ingredient_name === "Fish");
      return proteins.length >= 2;
    });
    expect(hasSameProteinPair).toBe(false);
  });

  it("includes archetype E combo when protein ingredient picked", () => {
    const combos = assembleRuleBasedCombos({
      dishes: [catalog.chickenCurry, catalog.chicken65, catalog.mildPotato],
      rules: defaultRules,
      taste: emptyTaste,
      ingredients: ["Chicken", "Potato"],
      category: "lunch",
      maxCombos: 3,
    });

    expect(combos.length).toBeGreaterThan(0);
    expect(combos[0].dishIds).toContain(catalog.chickenCurry.id);
    expect(combos[0].dishIds).toContain(catalog.chicken65.id);
  });

  it("includes fish curry + fish fry in same combo when fish picked", () => {
    const combos = assembleRuleBasedCombos({
      dishes: [catalog.spicyFishCurry, catalog.spicyFishFry, catalog.mildCabbage],
      rules: defaultRules,
      taste: emptyTaste,
      ingredients: ["Fish", "Cabbage"],
      category: "lunch",
      maxCombos: 3,
    });

    expect(combos.length).toBeGreaterThan(0);
    const fishPair = combos.find(
      (c) =>
        c.dishIds.includes(catalog.spicyFishCurry.id) &&
        c.dishIds.includes(catalog.spicyFishFry.id)
    );
    expect(fishPair).toBeDefined();
  });

  it("fills extra gravies when gravyCount > 1", () => {
    const rules = parseComboRules("2 gravy + 2 sides");
    const combos = assembleRuleBasedCombos({
      dishes: [
        catalog.spicyFishCurry,
        catalog.mediumSambar,
        catalog.mildCabbage,
        catalog.mildBeans,
      ],
      rules,
      taste: emptyTaste,
      ingredients: ["Fish", "Cabbage"],
      category: "lunch",
      maxCombos: 1,
    });

    expect(combos.length).toBe(1);
    const gravyIds = combos[0].dishIds.filter((id) => {
      const d = allDishes.find((row) => row.id === id)!;
      const group = (d.dish_group ?? "").toLowerCase();
      return group === "gravy" || group === "curry";
    });
    expect(gravyIds.length).toBeGreaterThanOrEqual(2);
    expect(combos[0].dishIds.length).toBeLessThanOrEqual(rules.gravyCount + rules.sideCount);
  });

  it("skips plain rice staple when anchor is Rice group", () => {
    const combos = assembleRuleBasedCombos({
      dishes: [catalog.lemonRice, catalog.kootuSide, catalog.mildCabbage],
      rules: defaultRules,
      taste: emptyTaste,
      ingredients: ["Rice", "Bottle gourd", "Cabbage"],
      category: "lunch",
      maxCombos: 3,
    });

    const riceCombo = combos.find((c) => c.dishIds.includes(catalog.lemonRice.id));
    expect(riceCombo).toBeDefined();
    expect(riceCombo!.staple).toBe("");
    expect(riceCombo!.subComponents).not.toContain("Rice");
  });

  it("adds rice staple for non-Rice anchors at lunch", () => {
    const combos = assembleRuleBasedCombos({
      dishes: [catalog.spicyFishCurry, catalog.mildCabbage, catalog.mildBeans],
      rules: defaultRules,
      taste: emptyTaste,
      ingredients: ["Fish", "Cabbage"],
      category: "lunch",
      maxCombos: 1,
    });

    expect(combos[0].staple).toBe("Rice");
    expect(combos[0].subComponents).toContain("Rice");
  });

  it("blocks brinjal reuse but allows fish protein reuse within a combo", () => {
    expect(
      allowsIngredientReuse(catalog.brinjalCurry, catalog.brinjalPoriyal)
    ).toBe(false);
    expect(
      allowsIngredientReuse(catalog.spicyFishCurry, catalog.spicyFishFry)
    ).toBe(true);

    const combos = assembleRuleBasedCombos({
      dishes: [
        catalog.spicyFishCurry,
        catalog.spicyFishFry,
        catalog.mildCabbage,
        catalog.brinjalCurry,
        catalog.brinjalPoriyal,
      ],
      rules: defaultRules,
      taste: emptyTaste,
      ingredients: ["Fish", "Brinjal", "Cabbage"],
      category: "lunch",
      maxCombos: 5,
    });

    for (const combo of combos) {
      const dishes = combo.dishIds.map((id) => allDishes.find((d) => d.id === id) ?? catalog.brinjalCurry);
      const resolved = dishes.filter((d) =>
        combo.dishIds.includes(catalog.brinjalCurry.id) || combo.dishIds.includes(catalog.brinjalPoriyal.id)
          ? d.id === catalog.brinjalCurry.id || d.id === catalog.brinjalPoriyal.id
          : false
      );
      if (resolved.length === 2) {
        expect(resolved.map((d) => d.id).sort()).not.toEqual(
          [catalog.brinjalCurry.id, catalog.brinjalPoriyal.id].sort()
        );
      }
    }
  });

  it("uses buildBalanceRationale for combo rationale", () => {
    const combos = assembleRuleBasedCombos({
      dishes: [catalog.spicyFishCurry, catalog.mildCabbage, catalog.mildBeans],
      rules: defaultRules,
      taste: emptyTaste,
      ingredients: ["Fish", "Cabbage"],
      category: "lunch",
      maxCombos: 1,
    });

    expect(combos[0].rationale.toLowerCase()).toContain("balanced");
  });
});
