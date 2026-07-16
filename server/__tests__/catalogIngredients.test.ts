import { describe, it, expect } from "vitest";
import {
  expandCatalogIngredients,
  filterMixedRiceForIngredients,
  templateNeedsMixedRice,
} from "../../shared/catalogIngredients";
import type { MealTemplate } from "../../shared/mealTemplates";

const schoolDayCombo: MealTemplate = {
  id: "preset-school-day-combo",
  name: "School Day Combo",
  meals: {
    breakfast: [{ category: "tiffin", count: 1 }],
    lunch: [{ category: "rice", dish_type: "mixed_rice", count: 1 }],
  },
};

describe("expandCatalogIngredients", () => {
  it("adds Rice when template lunch needs mixed_rice", () => {
    const result = expandCatalogIngredients(["Carrot", "Tomato"], {
      template: schoolDayCombo,
      mealSlot: "lunch",
    });
    expect(result).toEqual(["Carrot", "Tomato", "Rice"]);
  });

  it("does not duplicate Rice when already present", () => {
    const result = expandCatalogIngredients(["Carrot", "Rice"], {
      includesRice: true,
    });
    expect(result).toEqual(["Carrot", "Rice"]);
  });

  it("leaves ingredients unchanged when mixed rice not needed", () => {
    const result = expandCatalogIngredients(["Carrot", "Tomato"]);
    expect(result).toEqual(["Carrot", "Tomato"]);
  });
});

describe("templateNeedsMixedRice", () => {
  it("returns true for lunch with mixed_rice slot", () => {
    expect(templateNeedsMixedRice(schoolDayCombo, "lunch")).toBe(true);
  });

  it("returns false for breakfast without mixed_rice", () => {
    expect(templateNeedsMixedRice(schoolDayCombo, "breakfast")).toBe(false);
  });
});

describe("filterMixedRiceForIngredients", () => {
  const mixedRiceDishes = [
    { name: "Carrot Rice (Carrot Sadam)" },
    { name: "Thakkali Sadam (Tomato Rice)" },
    { name: "Elumichai Sadam (Lemon Rice)" },
  ];

  it("prefers mixed rice matching user vegetables", () => {
    const result = filterMixedRiceForIngredients(mixedRiceDishes, ["Carrot", "Tomato", "Rice"]);
    expect(result.map((d) => d.name)).toEqual([
      "Carrot Rice (Carrot Sadam)",
      "Thakkali Sadam (Tomato Rice)",
    ]);
  });

  it("returns all dishes when no vegetable match exists", () => {
    const result = filterMixedRiceForIngredients(mixedRiceDishes, ["Rice"]);
    expect(result).toEqual(mixedRiceDishes);
  });
});
