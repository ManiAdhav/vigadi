import { describe, it, expect } from "vitest";
import { describeComboBuildFailure } from "../comboBuildErrors";
import type { MealTemplate } from "../../shared/mealTemplates";

const schoolDayCombo: MealTemplate = {
  id: "preset-school-day-combo",
  name: "School Day Combo",
  meals: {
    breakfast: [
      { category: "tiffin", count: 1 },
      { category: "chutney", count: 1, options: ["sambar"] },
    ],
    lunch: [{ category: "rice", dish_type: "mixed_rice", count: 1 }],
  },
};

describe("describeComboBuildFailure", () => {
  it("returns catalog-empty guidance when no dishes exist", () => {
    const result = describeComboBuildFailure({
      catalogCount: 0,
      mealSlot: "lunch",
      template: schoolDayCombo,
    });

    expect(result.code).toBe("CATALOG_EMPTY");
    expect(result.error).toContain("Discover Dishes");
  });

  it("returns template mismatch guidance when catalog has dishes but slots do not match", () => {
    const result = describeComboBuildFailure({
      catalogCount: 12,
      mealSlot: "lunch",
      template: schoolDayCombo,
    });

    expect(result.code).toBe("TEMPLATE_NO_MATCH");
    expect(result.error).toContain("lunch");
    expect(result.error).toContain("Mixed Rice");
    expect(result.error).toContain("edit your template");
  });
});
