import { describe, expect, it } from "vitest";
import {
  createFoodPlateId,
  formatWeekdays,
  foodPlateToTemplate,
  resolveActiveFoodPlate,
  type FoodPlate,
} from "../../shared/foodPlates";

const balancedLunch: FoodPlate = {
  id: "plate-test-1",
  name: "Balanced Lunch",
  meal_slot: "lunch",
  slots: [
    { category: "rice", dish_type: "plain_rice", count: 1 },
    { category: "gravy", dish_type: "curry", count: 1 },
    { category: "side", count: 2 },
    { category: "gravy", dish_type: "kulambu", count: 1 },
  ],
  weekdays: [0, 1, 2, 3, 4, 5, 6],
  source: "manual",
};

const wednesdaySalad: FoodPlate = {
  id: "plate-test-2",
  name: "Vegetable Salad",
  meal_slot: "breakfast",
  slots: [{ category: "side", count: 1, note: "salad" }],
  weekdays: [3],
  source: "manual",
};

describe("resolveActiveFoodPlate", () => {
  it("returns lunch plate on any weekday", () => {
    const wednesday = new Date("2026-07-15T12:00:00"); // Wednesday
    const plate = resolveActiveFoodPlate([balancedLunch, wednesdaySalad], "lunch", wednesday);
    expect(plate?.name).toBe("Balanced Lunch");
  });

  it("returns breakfast salad only on Wednesday", () => {
    const wednesday = new Date("2026-07-15T08:00:00");
    const tuesday = new Date("2026-07-14T08:00:00");
    expect(resolveActiveFoodPlate([balancedLunch, wednesdaySalad], "breakfast", wednesday)?.name).toBe(
      "Vegetable Salad"
    );
    expect(resolveActiveFoodPlate([balancedLunch, wednesdaySalad], "breakfast", tuesday)).toBeUndefined();
  });
});

describe("foodPlateToTemplate", () => {
  it("maps plate slots to single meal template", () => {
    const template = foodPlateToTemplate(balancedLunch);
    expect(template.name).toBe("Balanced Lunch");
    expect(template.meals?.lunch?.length).toBe(4);
    expect(template.meals?.breakfast).toBeUndefined();
  });
});

describe("formatWeekdays", () => {
  it("formats all days and single day", () => {
    expect(formatWeekdays([0, 1, 2, 3, 4, 5, 6])).toBe("Every day");
    expect(formatWeekdays([3])).toBe("Wed");
  });
});

describe("createFoodPlateId", () => {
  it("generates unique ids", () => {
    expect(createFoodPlateId()).toMatch(/^plate-/);
    expect(createFoodPlateId()).not.toBe(createFoodPlateId());
  });
});
