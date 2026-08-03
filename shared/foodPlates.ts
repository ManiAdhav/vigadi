import {
  DishSlot,
  MealSlot,
  MealTemplate,
  formatMealSectionPreview,
  uiSlotFromMealSlot,
} from "./mealTemplates";

export type FoodPlateSource = "manual" | "learned";

export interface FoodPlate {
  id: string;
  name: string;
  meal_slot: MealSlot;
  slots: DishSlot[];
  /** 0 = Sunday … 6 = Saturday (Date.getDay()) */
  weekdays: number[];
  source: FoodPlateSource;
}

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

/** Pre-filled into a new plate so the name is never the reason a save is blocked. */
export const DEFAULT_FOOD_PLATE_NAME = "Balanced Lunch";

/** Returns the one thing stopping this plate from saving, or null when it is ready. */
export function validateFoodPlate(plate: FoodPlate): string | null {
  if (!plate.name.trim()) return "Give this plan a name";
  if (plate.slots.length === 0) return "Add at least one dish";
  if (plate.weekdays.length === 0) return "Pick at least one day";
  return null;
}

export function createFoodPlateId(): string {
  return `plate-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function formatWeekdays(weekdays: number[]): string {
  const sorted = [...weekdays].sort((a, b) => a - b);
  if (sorted.length === 7) return "Every day";
  if (sorted.length === 5 && [1, 2, 3, 4, 5].every((d) => sorted.includes(d))) return "Mon–Fri";
  if (sorted.length === 2 && sorted.includes(0) && sorted.includes(6)) return "Weekends";
  return sorted.map((d) => WEEKDAY_LABELS[d]).join(", ");
}

export function formatFoodPlatePreview(plate: FoodPlate): string {
  return formatMealSectionPreview(plate.meal_slot, plate.slots);
}

export function foodPlateToTemplate(plate: FoodPlate): MealTemplate {
  return {
    id: plate.id,
    name: plate.name,
    meals: {
      [plate.meal_slot]: plate.slots.map((s) => ({
        ...s,
        options: s.options ? [...s.options] : undefined,
      })),
    },
  };
}

export function foodPlateToRulesDescription(plate: FoodPlate): string {
  const meal = uiSlotFromMealSlot(plate.meal_slot);
  return `${plate.name} (${meal}, ${formatWeekdays(plate.weekdays)}): ${formatFoodPlatePreview(plate)}`;
}

export function resolveActiveFoodPlate(
  plates: FoodPlate[],
  mealSlot: MealSlot,
  date: Date = new Date()
): FoodPlate | undefined {
  const weekday = date.getDay();
  return plates.find((p) => p.meal_slot === mealSlot && p.weekdays.includes(weekday));
}

export function prepareFoodPlateForSave(plate: FoodPlate): FoodPlate {
  return {
    id: plate.id,
    name: plate.name.trim(),
    meal_slot: plate.meal_slot,
    slots: plate.slots.map((s) => ({
      ...s,
      options: s.options ? [...s.options] : undefined,
    })),
    weekdays: [...new Set(plate.weekdays)].sort((a, b) => a - b),
    source: plate.source ?? "manual",
  };
}

export function foodPlateSummary(plate: FoodPlate): string {
  const meal = uiSlotFromMealSlot(plate.meal_slot);
  return `${meal} · ${formatWeekdays(plate.weekdays)} · ${formatFoodPlatePreview(plate)}`;
}
