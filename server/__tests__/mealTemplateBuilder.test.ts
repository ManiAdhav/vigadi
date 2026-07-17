import { describe, expect, it } from "vitest";
import {
  effectiveMealGroup,
  isRiceStapleCoveredByTag,
  normalizeDishSlot,
  normalizeSlotCategory,
  slotMatchesDish,
} from "../../shared/mealTemplates";
import { unlockIngredientHint } from "../mealTemplateBuilder";

describe("unlockIngredientHint", () => {
  const secondary = ["oil", "tomato", "onion", "ginger", "garlic", "tamarind", "lemon"];

  it("never suggests pantry/secondary ingredients", () => {
    for (const category of ["tiffin", "gravy", "rice", "side", "chutney"] as const) {
      const hint = unlockIngredientHint(category).toLowerCase();
      for (const item of secondary) {
        expect(hint).not.toContain(item);
      }
    }
  });

  it("suggests primary ingredients for gravy (curry) dishes", () => {
    const hint = unlockIngredientHint("gravy").toLowerCase();
    expect(
      ["vegetable", "paneer", "chicken", "fish"].some((p) => hint.includes(p))
    ).toBe(true);
  });
});

describe("normalizeSlotCategory", () => {
  it("maps legacy protein slots to side", () => {
    expect(normalizeSlotCategory("protein")).toBe("side");
  });

  it("maps legacy mixed_rice to rice group", () => {
    expect(normalizeSlotCategory("mixed_rice")).toBe("rice");
  });
});

describe("normalizeDishSlot", () => {
  it("remaps protein category in saved templates", () => {
    expect(normalizeDishSlot({ category: "protein", count: 1 }).category).toBe("side");
  });

  it("migrates legacy mixed_rice slot to rice group with dish_type", () => {
    const slot = normalizeDishSlot({ category: "mixed_rice", count: 1 });
    expect(slot.category).toBe("rice");
    expect(slot.dish_type).toBe("mixed_rice");
  });
});

describe("effectiveMealGroup", () => {
  it("maps legacy DB protein tag to side", () => {
    expect(
      effectiveMealGroup({
        dish_category: "protein",
        dish_type: "fry",
        name: "Chicken 65",
      })
    ).toBe("side");
  });

  it("classifies chicken fry as side", () => {
    expect(
      effectiveMealGroup({
        dish_category: "side",
        dish_type: "fry",
        name: "Chicken 65",
      })
    ).toBe("side");
  });
});

describe("isRiceStapleCoveredByTag", () => {
  it("is true when user tagged rice and template has plain rice slot", () => {
    expect(
      isRiceStapleCoveredByTag({ category: "rice", dish_type: "plain_rice", count: 1 }, true)
    ).toBe(true);
    expect(
      isRiceStapleCoveredByTag({ category: "rice", dish_type: "plain_rice", count: 1 }, false)
    ).toBe(false);
  });

  it("supports legacy rice_staple slots", () => {
    expect(isRiceStapleCoveredByTag({ category: "rice_staple", count: 1 }, true)).toBe(true);
  });
});

describe("cross-slot ingredient diversity", () => {
  it("uses different ingredients across two side slots", () => {
    const used = new Set<string>();
    const catalog = [
      { id: 1, ingredient_name: "Carrot", name: "Carrot Fry" },
      { id: 2, ingredient_name: "Carrot", name: "Carrot Poriyal" },
      { id: 3, ingredient_name: "Potato", name: "Potato Fry" },
      { id: 4, ingredient_name: "French beans", name: "Beans Poriyal" },
    ];

    function pickOne(candidates: typeof catalog, usedIngredients: Set<string>) {
      for (const dish of candidates) {
        const ing = dish.ingredient_name.toLowerCase();
        if (!usedIngredients.has(ing)) {
          usedIngredients.add(ing);
          return dish;
        }
      }
      return candidates[0];
    }

    const side1 = pickOne(catalog, used);
    const side2 = pickOne(catalog, used);

    expect(side1.ingredient_name).toBe("Carrot");
    expect(side2.ingredient_name).not.toBe("Carrot");
  });
});

describe("slotMatchesDish", () => {
  it("matches sambar for chutney slot with sambar dish_type option", () => {
    expect(
      slotMatchesDish(
        { category: "chutney", count: 1, options: ["sambar"] },
        { dish_category: "gravy", dish_type: "sambar", name: "Sambar" }
      )
    ).toBe(true);
  });

  it("matches mixed rice slot by dish_type", () => {
    expect(
      slotMatchesDish(
        { category: "rice", dish_type: "mixed_rice", count: 1 },
        { dish_category: "rice", dish_type: "mixed_rice", name: "Carrot Rice" }
      )
    ).toBe(true);
  });
});
