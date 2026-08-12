/**
 * Meal logging: a record of what was actually eaten on a given day.
 *
 * A log is a meal, not a dish — "Lunch on Aug 10 was rice, sambar, fish fry and
 * beans poriyal" is one MealLogEntry with four items.
 */

import {
  cleanLoggedIngredients,
  type LoggedIngredient,
  type LoggedIngredientInput,
} from "./loggedIngredients";

export const MEAL_LOG_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;

export type MealLogType = (typeof MEAL_LOG_TYPES)[number];

export interface MealLogItem {
  id: number;
  dishName: string;
  /** null when the dish is not in the catalog and we kept what was typed. */
  dishId: number | null;
  /** What went into this dish on this day. Empty when she did not say. */
  ingredients: LoggedIngredient[];
  calories: number | null;
  carbs: number | null;
  protein: number | null;
  fat: number | null;
  imageUrl: string | null;
  review: string | null;
}

/**
 * One past version of a dish — "the sambar you made with carrot, beans and chow
 * chow". Offered back as a starting point, never applied automatically: nobody
 * cooks the same sambar twice.
 */
export interface DishVariant {
  dishName: string;
  ingredients: LoggedIngredient[];
  /** Sorted canonical set, so the same version logged twice is recognised as one. */
  signature: string;
  timesLogged: number;
  lastLoggedOn: string;
}

export interface MealLogEntry {
  id: string;
  /** Local calendar date as YYYY-MM-DD — never a UTC-derived timestamp. */
  loggedOn: string;
  mealType: MealLogType;
  items: MealLogItem[];
}

/** What the client posts to add dishes to a meal. */
export interface MealLogItemInput {
  name: string;
  dishId?: number | null;
  ingredients?: (LoggedIngredientInput | string)[] | null;
  calories?: number | null;
  carbs?: number | null;
  protein?: number | null;
  fat?: number | null;
  imageUrl?: string | null;
  review?: string | null;
}

const MEAL_TYPE_LABELS: Record<MealLogType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

export function formatMealTypeLabel(mealType: MealLogType): string {
  return MEAL_TYPE_LABELS[mealType];
}

/**
 * Accepts the mixed casing already floating around the app ("Lunch", "lunch")
 * and anything a stale client sends, falling back to snack rather than throwing.
 */
export function normalizeMealType(value: unknown): MealLogType {
  const lower = String(value ?? "").trim().toLowerCase();
  return (MEAL_LOG_TYPES as readonly string[]).includes(lower)
    ? (lower as MealLogType)
    : "snack";
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

/**
 * Local calendar date, deliberately not `toISOString()`. In IST the UTC date is
 * a day behind for part of every evening, which would file a late dinner under
 * yesterday.
 */
export function toIsoDate(date: Date = new Date()): string {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function todayIso(): string {
  return toIsoDate();
}

/** Shifts an ISO date by whole days, staying in local time. */
export function shiftIsoDate(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return toIsoDate(new Date(y, m - 1, d + days));
}

export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** "Today" / "Yesterday" / "Sun, 10 Aug" — relative to the given day. */
export function formatLogDateLabel(iso: string, today: string = todayIso()): string {
  if (iso === today) return "Today";
  if (iso === shiftIsoDate(today, -1)) return "Yesterday";
  if (iso === shiftIsoDate(today, 1)) return "Tomorrow";
  return parseIsoDate(iso).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/** Meals read top-to-bottom in the order they are eaten, not alphabetically. */
export function sortMealsByTime(meals: MealLogEntry[]): MealLogEntry[] {
  return [...meals].sort(
    (a, b) => MEAL_LOG_TYPES.indexOf(a.mealType) - MEAL_LOG_TYPES.indexOf(b.mealType)
  );
}

export function createMealLogId(): string {
  return `meal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Returns the one thing stopping this entry from saving, or null when ready. */
export function validateMealLogInput(
  date: unknown,
  items: MealLogItemInput[]
): string | null {
  if (!isIsoDate(date)) return "Pick a valid date";
  if (!items.length) return "Add at least one dish";
  if (items.every((i) => !i.name?.trim())) return "Add at least one dish";
  return null;
}

/**
 * A dish plus the ingredients that went into it, ready to store: names trimmed,
 * blanks dropped, ingredients resolved against the catalog.
 */
export interface CleanMealLogItem extends MealLogItemInput {
  name: string;
  ingredients: LoggedIngredient[];
}

/** Drops blanks and trims, so a stray Enter never logs an empty dish. */
export function cleanMealLogItems(items: MealLogItemInput[]): CleanMealLogItem[] {
  return items
    .filter((i) => i.name?.trim())
    .map((i) => ({
      ...i,
      name: i.name.trim(),
      ingredients: cleanLoggedIngredients(i.ingredients),
    }));
}

/** Only sums what actually has numbers — hand-typed dishes contribute nothing. */
export function sumMacros(meals: MealLogEntry[]) {
  const totals = { calories: 0, carbs: 0, protein: 0, fat: 0 };
  let hasAny = false;
  for (const meal of meals) {
    for (const item of meal.items) {
      if (item.calories == null && item.carbs == null && item.protein == null && item.fat == null) {
        continue;
      }
      hasAny = true;
      totals.calories += item.calories ?? 0;
      totals.carbs += item.carbs ?? 0;
      totals.protein += item.protein ?? 0;
      totals.fat += item.fat ?? 0;
    }
  }
  return { ...totals, hasAny };
}
