export type MealSlot = "breakfast" | "lunch" | "dinner";
export type DayType = "school_day" | "holiday" | "any" | string;

export type DishCategory =
  | "tiffin"
  | "kulambu"
  | "mixed_rice"
  | "side_poriyal"
  | "protein"
  | "chutney"
  | "sambar"
  | "curry"
  | "rice_staple";

export interface DishSlot {
  category: DishCategory;
  count: number;
  options?: DishCategory[];
  note?: string;
  /** Cook once and reuse across meals in this template */
  reuse?: "all_meals" | MealSlot;
  /** Pin a specific catalog dish (from search) */
  dishId?: number;
  dishName?: string;
}

export interface MealPlan {
  breakfast?: DishSlot[];
  lunch?: DishSlot[];
  dinner?: DishSlot[];
}

export interface BalanceTarget {
  carb: number;
  veg: number;
  protein: number;
}

export interface MealTemplate {
  id: string;
  name: string;
  /** Per-meal dish lists (preferred) */
  meals?: MealPlan;
  /** @deprecated legacy flat list — migrated via normalizeTemplate */
  meal_slots?: MealSlot[];
  day_types?: DayType[];
  slots?: DishSlot[];
  balance_target?: BalanceTarget;
}

export interface DaySettings {
  school_weekdays: number[];
  holiday_override?: { date: string; is_holiday: boolean } | null;
}

export const DISH_CATEGORY_LABELS: Record<DishCategory, string> = {
  tiffin: "Tiffin",
  kulambu: "Kulambu",
  mixed_rice: "Mixed Rice",
  side_poriyal: "Side",
  protein: "Protein",
  chutney: "Chutney",
  sambar: "Sambar",
  curry: "Curry",
  rice_staple: "Rice",
};

export const ALL_DISH_CATEGORIES: DishCategory[] = [
  "tiffin",
  "kulambu",
  "mixed_rice",
  "side_poriyal",
  "protein",
  "chutney",
  "sambar",
  "curry",
  "rice_staple",
];

const DISH_TYPE_TO_CATEGORY: Record<string, DishCategory> = {
  gravy: "kulambu",
  kulambu: "kulambu",
  kuzhambu: "kulambu",
  kuzhambu_style: "kulambu",
  rasam: "kulambu",
  curry: "curry",
  sambar: "sambar",
  side: "side_poriyal",
  fry: "side_poriyal",
  poriyal: "side_poriyal",
  roast: "side_poriyal",
  thoran: "side_poriyal",
  chutney: "chutney",
  pachadi: "chutney",
  tiffin: "tiffin",
  idli: "tiffin",
  dosa: "tiffin",
  upma: "tiffin",
  mixed_rice: "mixed_rice",
  biryani: "mixed_rice",
  pulao: "mixed_rice",
  protein: "protein",
  rice: "rice_staple",
  staple: "rice_staple",
};

const NAME_HINTS: Array<{ pattern: RegExp; category: DishCategory }> = [
  { pattern: /\b(idli|dosa|upma|pongal|puttu|appam|adai|uthappam)\b/i, category: "tiffin" },
  { pattern: /\b(sambar)\b/i, category: "sambar" },
  { pattern: /\b(chutney|pachadi|thogayal)\b/i, category: "chutney" },
  { pattern: /\b(poriyal|varuval|fry|roast|thoran|kootu)\b/i, category: "side_poriyal" },
  { pattern: /\b(kulambu|kuzhambu|gravy|rasam)\b/i, category: "kulambu" },
  { pattern: /\b(curry)\b/i, category: "curry" },
  { pattern: /\b(biryani|pulao|mixed.?rice|lemon.?rice|tamarind.?rice)\b/i, category: "mixed_rice" },
  { pattern: /\b(egg|omelette|omelet|chicken|fish|meen|mutton|prawn|shrimp)\b/i, category: "protein" },
];

export function resolveDishCategory(dishType: string | null | undefined, name?: string): DishCategory {
  const type = (dishType ?? "").toLowerCase().trim();
  if (type && DISH_TYPE_TO_CATEGORY[type]) return DISH_TYPE_TO_CATEGORY[type];

  const haystack = `${type} ${name ?? ""}`.toLowerCase();
  for (const hint of NAME_HINTS) {
    if (hint.pattern.test(haystack)) return hint.category;
  }

  if (type.includes("gravy") || type.includes("kulambu")) return "kulambu";
  if (type.includes("side") || type.includes("poriyal")) return "side_poriyal";
  return "side_poriyal";
}

export function slotAcceptsCategory(slot: DishSlot, category: DishCategory): boolean {
  if (slot.category === category) return true;
  return (slot.options ?? []).includes(category);
}

export function formatCategoryLabel(category: DishCategory): string {
  return DISH_CATEGORY_LABELS[category] ?? category;
}

export function formatSlotLabel(slot: DishSlot): string {
  if (slot.dishName?.trim()) return slot.dishName.trim();
  const categories = [slot.category, ...(slot.options ?? [])];
  const unique = [...new Set(categories)];
  return unique.map(formatCategoryLabel).join(" / ");
}

export function slotFromDishName(
  name: string,
  dishType?: string | null,
  dishCategory?: string | null,
  dishId?: number
): DishSlot {
  const category = (dishCategory as DishCategory | undefined) ?? resolveDishCategory(dishType, name);
  return {
    category,
    count: 1,
    dishId,
    dishName: name.trim(),
  };
}

export function formatSlotPreview(slot: DishSlot): string {
  return `${slot.count} ${formatSlotLabel(slot)}`;
}

export function formatReuseLabel(reuse: DishSlot["reuse"]): string | null {
  if (!reuse) return null;
  if (reuse === "all_meals") return "all meals";
  return `from ${reuse}`;
}

export function normalizeTemplate(template: MealTemplate): MealTemplate & { meals: MealPlan } {
  if (template.meals && Object.values(template.meals).some((s) => s && s.length > 0)) {
    const meal_slots = templateMealSlots(template);
    return {
      ...template,
      meals: template.meals,
      meal_slots,
      day_types: [],
      slots: flattenMealPlan(template.meals),
    };
  }

  const meals: MealPlan = {};
  const legacySlots = template.slots ?? [];
  const legacyMeals = template.meal_slots?.length ? template.meal_slots : ["lunch" as MealSlot];
  if (legacySlots.length > 0) {
    for (const ms of legacyMeals) {
      meals[ms] = legacySlots.map((s) => ({ ...s, options: s.options ? [...s.options] : undefined }));
    }
  }

  return {
    ...template,
    meals,
    meal_slots: templateMealSlots({ ...template, meals }),
    day_types: [],
    slots: flattenMealPlan(meals),
  };
}

export function flattenMealPlan(meals: MealPlan): DishSlot[] {
  return (["breakfast", "lunch", "dinner"] as MealSlot[]).flatMap((ms) => meals[ms] ?? []);
}

export function templateMealSlots(template: MealTemplate): MealSlot[] {
  const meals = template.meals ?? {};
  return (["breakfast", "lunch", "dinner"] as MealSlot[]).filter(
    (ms) => (meals[ms]?.length ?? 0) > 0
  );
}

export function getSlotsForMeal(template: MealTemplate, mealSlot: MealSlot): DishSlot[] {
  const normalized = normalizeTemplate(template);
  return normalized.meals[mealSlot] ?? [];
}

export function templateHasMealSlot(template: MealTemplate, mealSlot: MealSlot): boolean {
  return getSlotsForMeal(template, mealSlot).length > 0;
}

export function formatTemplatePreview(template: MealTemplate): string {
  const normalized = normalizeTemplate(template);
  const parts: string[] = [];
  for (const ms of templateMealSlots(normalized)) {
    const slots = normalized.meals[ms] ?? [];
    if (slots.length === 0) continue;
    const label = uiSlotFromMealSlot(ms);
    parts.push(`${label}: ${slots.map(formatSlotLabel).join(" + ")}`);
  }
  return parts.join(" · ") || "Empty template";
}

export function formatMealSectionPreview(mealSlot: MealSlot, slots: DishSlot[]): string {
  if (slots.length === 0) return "No dishes yet";
  return slots.map(formatSlotLabel).join(" + ");
}

export function templateMealsLabel(template: MealTemplate): string {
  return templateMealSlots(normalizeTemplate(template))
    .map((s) => formatMealSlotLabel(s))
    .join(" · ");
}

export function prepareTemplateForSave(template: MealTemplate): MealTemplate {
  const normalized = normalizeTemplate(template);
  const hasAnySlot = templateMealSlots(normalized).length > 0;
  if (!hasAnySlot) return normalized;
  return {
    id: template.id,
    name: template.name.trim(),
    meals: {
      breakfast: normalized.meals.breakfast?.map((s) => ({ ...s })),
      lunch: normalized.meals.lunch?.map((s) => ({ ...s })),
      dinner: normalized.meals.dinner?.map((s) => ({ ...s })),
    },
    meal_slots: templateMealSlots(normalized),
    day_types: [],
    slots: flattenMealPlan(normalized.meals),
    balance_target: template.balance_target,
  };
}

export function shouldFillSlotAtMeal(slot: DishSlot, _mealSlot: MealSlot): boolean {
  if (!slot.reuse) return true;
  if (slot.reuse === "all_meals") return true;
  return false;
}

export function reuseOptionsForMeal(
  mealSlot: MealSlot,
  plan: MealPlan
): Array<DishSlot["reuse"] | undefined> {
  const order: MealSlot[] = ["breakfast", "lunch", "dinner"];
  const idx = order.indexOf(mealSlot);
  const earlier = order.slice(0, idx).filter((ms) => (plan[ms]?.length ?? 0) > 0);
  const opts: Array<DishSlot["reuse"] | undefined> = [undefined];
  if (mealSlot === "breakfast") {
    opts.push("all_meals");
  } else {
    for (const m of earlier) opts.push(m);
  }
  return opts;
}

export function templateMatchesDayType(template: MealTemplate, dayType: DayType): boolean {
  const types = template.day_types ?? ["any"];
  return (
    types.includes("any") ||
    types.includes(dayType) ||
    (dayType !== "school_day" && dayType !== "holiday" && types.includes(dayType))
  );
}

export function templateMatchesContext(
  template: MealTemplate,
  mealSlot: MealSlot,
  _dayType?: DayType
): boolean {
  return templateHasMealSlot(template, mealSlot);
}

export function pickAutoTemplate(
  templates: MealTemplate[],
  mealSlot: MealSlot,
  _dayType?: DayType
): MealTemplate | undefined {
  const matching = templates.filter((t) => templateHasMealSlot(t, mealSlot));
  return matching[0];
}

export function templatePrimaryMealSlot(template: MealTemplate): MealSlot {
  const slots = templateMealSlots(template);
  return slots[0] ?? "lunch";
}

export function templateHasRiceStaple(template: MealTemplate, mealSlot?: MealSlot): boolean {
  const normalized = normalizeTemplate(template);
  const check = (slots: DishSlot[]) =>
    slots.some(
      (s) => s.category === "rice_staple" || (s.options ?? []).includes("rice_staple")
    );
  if (mealSlot) return check(normalized.meals[mealSlot] ?? []);
  return check(flattenMealPlan(normalized.meals));
}

export function inferDefaultMealSlot(date = new Date()): MealSlot {
  const hour = date.getHours();
  if (hour < 11) return "breakfast";
  if (hour < 16) return "lunch";
  return "dinner";
}

/** Rice only when template requires it or user manually added rice — never auto for breakfast. */
export function resolveComboStaple(
  template: MealTemplate | undefined,
  mealSlot: MealSlot,
  includesRice: boolean
): string | null {
  if (mealSlot === "breakfast") {
    return includesRice ? "Rice" : null;
  }
  if (template && templateHasRiceStaple(template, mealSlot)) {
    return "Rice";
  }
  return includesRice ? "Rice" : null;
}

export function formatMealSlotLabel(slot: MealSlot): string {
  return uiSlotFromMealSlot(slot);
}

export function getDayTypeForDate(date: Date, settings: DaySettings): DayType {
  const iso = date.toISOString().slice(0, 10);
  if (settings.holiday_override?.date === iso) {
    return settings.holiday_override.is_holiday ? "holiday" : "school_day";
  }
  const weekday = date.getDay();
  return settings.school_weekdays.includes(weekday) ? "school_day" : "holiday";
}

export function createBlankMealPlan(): MealPlan {
  return { breakfast: [], lunch: [], dinner: [] };
}

export const QUICK_DISH_PRESETS: Array<{ label: string; slot: DishSlot }> = [
  { label: "Tiffin", slot: { category: "tiffin", count: 1 } },
  { label: "Chutney / Sambar", slot: { category: "chutney", count: 1, options: ["sambar"] } },
  { label: "Veg Side", slot: { category: "side_poriyal", count: 1 } },
  { label: "Protein", slot: { category: "protein", count: 1 } },
  { label: "Mixed Rice", slot: { category: "mixed_rice", count: 1 } },
  { label: "Rice", slot: { category: "rice_staple", count: 1 } },
  { label: "Kulambu", slot: { category: "kulambu", count: 1 } },
  { label: "Curry", slot: { category: "curry", count: 1 } },
];

export function createTemplateId(): string {
  return `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export const DEFAULT_DAY_SETTINGS: DaySettings = {
  school_weekdays: [1, 2, 3, 4, 5],
  holiday_override: null,
};

export const REGION_PRESET_TEMPLATES: MealTemplate[] = [
  {
    id: "preset-school-day-combo",
    name: "School Day Combo",
    meals: {
      breakfast: [
        { category: "tiffin", count: 1 },
        { category: "chutney", count: 1, options: ["sambar"] },
        { category: "side_poriyal", count: 1, reuse: "all_meals" },
        { category: "protein", count: 1, reuse: "all_meals", note: "egg preferred for kids" },
      ],
      lunch: [
        { category: "mixed_rice", count: 1 },
        { category: "side_poriyal", count: 1, reuse: "breakfast" },
        { category: "protein", count: 1, reuse: "breakfast" },
      ],
    },
  },
  {
    name: "Tamil Nadu Lunch",
    meal_slots: ["lunch"],
    day_types: ["any"],
    slots: [
      { category: "kulambu", count: 1 },
      { category: "side_poriyal", count: 2 },
    ],
  },
  {
    id: "preset-school-breakfast",
    name: "School Day Breakfast",
    meal_slots: ["breakfast"],
    day_types: ["school_day"],
    slots: [
      { category: "tiffin", count: 1 },
      { category: "chutney", count: 1, options: ["sambar"] },
      { category: "protein", count: 1, note: "egg preferred for kids" },
    ],
  },
  {
    id: "preset-school-lunch",
    name: "School Day Lunch",
    meal_slots: ["lunch"],
    day_types: ["school_day"],
    slots: [{ category: "mixed_rice", count: 1, note: "inherits protein from morning batch" }],
  },
  {
    id: "preset-holiday-breakfast",
    name: "Holiday Breakfast",
    meal_slots: ["breakfast"],
    day_types: ["holiday"],
    slots: [
      { category: "tiffin", count: 1 },
      { category: "side_poriyal", count: 1 },
      { category: "protein", count: 1 },
    ],
  },
  {
    id: "preset-holiday-lunch",
    name: "Holiday Lunch",
    meal_slots: ["lunch"],
    day_types: ["holiday"],
    slots: [
      { category: "rice_staple", count: 1 },
      { category: "kulambu", count: 1, options: ["curry"] },
      { category: "side_poriyal", count: 1 },
      { category: "protein", count: 1 },
    ],
  },
  {
    id: "preset-kerala-lunch",
    name: "Kerala Lunch",
    meal_slots: ["lunch"],
    day_types: ["any"],
    slots: [
      { category: "curry", count: 1 },
      { category: "side_poriyal", count: 1 },
    ],
  },
  {
    id: "preset-homestyle",
    name: "Classic Homestyle",
    meal_slots: ["lunch", "dinner"],
    day_types: ["any"],
    slots: [
      { category: "kulambu", count: 1, options: ["curry"] },
      { category: "side_poriyal", count: 1 },
    ],
  },
  {
    id: "preset-high-protein",
    name: "High Protein Plate",
    meal_slots: ["lunch", "dinner"],
    day_types: ["any"],
    slots: [
      { category: "protein", count: 1 },
      { category: "rice_staple", count: 1 },
    ],
    balance_target: { carb: 30, veg: 20, protein: 50 },
  },
];

export function mealSlotFromUi(slot: "Breakfast" | "Lunch" | "Dinner"): MealSlot {
  return slot.toLowerCase() as MealSlot;
}

export function uiSlotFromMealSlot(slot: MealSlot): "Breakfast" | "Lunch" | "Dinner" {
  const map: Record<MealSlot, "Breakfast" | "Lunch" | "Dinner"> = {
    breakfast: "Breakfast",
    lunch: "Lunch",
    dinner: "Dinner",
  };
  return map[slot];
}
