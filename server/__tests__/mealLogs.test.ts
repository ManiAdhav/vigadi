import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  addDishesToMeal,
  deleteMealLog,
  deleteMealLogItem,
  clearMealLogs,
  getMealLogsForDate,
} from "../db/mealLogs";
import {
  formatLogDateLabel,
  isIsoDate,
  normalizeMealType,
  shiftIsoDate,
  sumMacros,
  toIsoDate,
  validateMealLogInput,
} from "../../shared/mealLogs";

// These exercise the in-memory path, which is the same code the app runs
// whenever DATABASE_URL is unset. .env.local would otherwise point this at the
// real dev database, so the tests pin themselves to memory instead.
beforeAll(() => {
  delete process.env.DATABASE_URL;
});

const USER = "user-test";

describe("date handling", () => {
  it("builds the local calendar date, not the UTC one", () => {
    // 00:30 local on Aug 10. toISOString() would report Aug 9 in IST.
    expect(toIsoDate(new Date(2026, 7, 10, 0, 30))).toBe("2026-08-10");
    // 23:30 local on Aug 10. toISOString() would report Aug 11 in UTC-5.
    expect(toIsoDate(new Date(2026, 7, 10, 23, 30))).toBe("2026-08-10");
  });

  it("shifts a day backwards across a month boundary", () => {
    expect(shiftIsoDate("2026-08-01", -1)).toBe("2026-07-31");
    expect(shiftIsoDate("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("labels today and yesterday in plain words", () => {
    expect(formatLogDateLabel("2026-08-10", "2026-08-10")).toBe("Today");
    expect(formatLogDateLabel("2026-08-09", "2026-08-10")).toBe("Yesterday");
    expect(formatLogDateLabel("2026-08-02", "2026-08-10")).not.toMatch(/Today|Yesterday/);
  });

  it("rejects dates that are not real days", () => {
    expect(isIsoDate("2026-08-10")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("10-08-2026")).toBe(false);
    expect(isIsoDate(undefined)).toBe(false);
  });
});

describe("input validation", () => {
  it("names the missing piece rather than failing silently", () => {
    expect(validateMealLogInput("nope", [{ name: "Rice" }])).toBe("Pick a valid date");
    expect(validateMealLogInput("2026-08-10", [])).toBe("Add at least one dish");
    expect(validateMealLogInput("2026-08-10", [{ name: "   " }])).toBe("Add at least one dish");
    expect(validateMealLogInput("2026-08-10", [{ name: "Rice" }])).toBeNull();
  });

  it("falls back to snack instead of throwing on an unknown meal type", () => {
    expect(normalizeMealType("Lunch")).toBe("lunch");
    expect(normalizeMealType("lunch")).toBe("lunch");
    expect(normalizeMealType("brunch")).toBe("snack");
    expect(normalizeMealType(undefined)).toBe("snack");
  });
});

describe("logging a home-cooked meal", () => {
  beforeEach(async () => {
    await clearMealLogs(USER);
  });

  it("stores a four-dish lunch as one meal", async () => {
    const meals = await addDishesToMeal(USER, "2026-08-10", "lunch", [
      { name: "Rice", dishId: 1 },
      { name: "Sambar", dishId: 2 },
      { name: "Fish Fry" },
      { name: "Beans Poriyal", dishId: 3 },
    ]);

    expect(meals).toHaveLength(1);
    expect(meals[0].mealType).toBe("lunch");
    expect(meals[0].items.map((i) => i.dishName)).toEqual([
      "Rice",
      "Sambar",
      "Fish Fry",
      "Beans Poriyal",
    ]);
  });

  it("keeps a dish the catalog does not have, exactly as typed", async () => {
    const meals = await addDishesToMeal(USER, "2026-08-10", "lunch", [
      { name: "Amma's special vathal kuzhambu" },
    ]);
    const item = meals[0].items[0];
    expect(item.dishName).toBe("Amma's special vathal kuzhambu");
    expect(item.dishId).toBeNull();
  });

  it("files a backdated meal under yesterday, not today", async () => {
    await addDishesToMeal(USER, "2026-08-09", "dinner", [{ name: "Idli" }]);

    expect(await getMealLogsForDate(USER, "2026-08-09")).toHaveLength(1);
    expect(await getMealLogsForDate(USER, "2026-08-10")).toHaveLength(0);
  });

  it("appends to the same lunch instead of creating a second lunch card", async () => {
    await addDishesToMeal(USER, "2026-08-10", "lunch", [{ name: "Rice" }]);
    const meals = await addDishesToMeal(USER, "2026-08-10", "lunch", [{ name: "Rasam" }]);

    expect(meals).toHaveLength(1);
    expect(meals[0].items.map((i) => i.dishName)).toEqual(["Rice", "Rasam"]);
  });

  it("keeps breakfast and lunch on the same day apart", async () => {
    await addDishesToMeal(USER, "2026-08-10", "lunch", [{ name: "Rice" }]);
    await addDishesToMeal(USER, "2026-08-10", "breakfast", [{ name: "Dosa" }]);

    const meals = await getMealLogsForDate(USER, "2026-08-10");
    // Sorted the way the day is eaten, not the order they were entered.
    expect(meals.map((m) => m.mealType)).toEqual(["breakfast", "lunch"]);
  });

  it("drops blank dishes so a stray Enter logs nothing", async () => {
    const meals = await addDishesToMeal(USER, "2026-08-10", "lunch", [
      { name: "Rice" },
      { name: "   " },
    ]);
    expect(meals[0].items).toHaveLength(1);
  });
});

describe("removing logged food", () => {
  beforeEach(async () => {
    await clearMealLogs(USER);
  });

  it("removes one dish and leaves the rest of the meal", async () => {
    const meals = await addDishesToMeal(USER, "2026-08-10", "lunch", [
      { name: "Rice" },
      { name: "Sambar" },
    ]);
    await deleteMealLogItem(USER, meals[0].id, meals[0].items[0].id);

    const after = await getMealLogsForDate(USER, "2026-08-10");
    expect(after[0].items.map((i) => i.dishName)).toEqual(["Sambar"]);
  });

  it("removes the meal once its last dish is gone", async () => {
    const meals = await addDishesToMeal(USER, "2026-08-10", "lunch", [{ name: "Rice" }]);
    await deleteMealLogItem(USER, meals[0].id, meals[0].items[0].id);

    expect(await getMealLogsForDate(USER, "2026-08-10")).toHaveLength(0);
  });

  it("deletes a whole meal", async () => {
    const meals = await addDishesToMeal(USER, "2026-08-10", "lunch", [
      { name: "Rice" },
      { name: "Sambar" },
    ]);
    await deleteMealLog(USER, meals[0].id);

    expect(await getMealLogsForDate(USER, "2026-08-10")).toHaveLength(0);
  });

  it("keeps one person's diary out of another's", async () => {
    await addDishesToMeal(USER, "2026-08-10", "lunch", [{ name: "Rice" }]);
    await addDishesToMeal("user-other", "2026-08-10", "lunch", [{ name: "Dosa" }]);

    await clearMealLogs(USER);

    expect(await getMealLogsForDate(USER, "2026-08-10")).toHaveLength(0);
    expect(await getMealLogsForDate("user-other", "2026-08-10")).toHaveLength(1);
  });
});

describe("macro totals", () => {
  it("reports nothing to show when every dish was typed by hand", async () => {
    await clearMealLogs(USER);
    const meals = await addDishesToMeal(USER, "2026-08-10", "lunch", [
      { name: "Rice" },
      { name: "Sambar" },
    ]);

    const totals = sumMacros(meals);
    expect(totals.hasAny).toBe(false);
    expect(totals.calories).toBe(0);
  });

  it("sums only the scanned dishes, ignoring hand-typed ones", async () => {
    await clearMealLogs(USER);
    const meals = await addDishesToMeal(USER, "2026-08-10", "lunch", [
      { name: "Rice" },
      { name: "Scanned plate", calories: 300, carbs: 40, protein: 12, fat: 8 },
    ]);

    const totals = sumMacros(meals);
    expect(totals.hasAny).toBe(true);
    expect(totals.calories).toBe(300);
    expect(totals.carbs).toBe(40);
  });
});
