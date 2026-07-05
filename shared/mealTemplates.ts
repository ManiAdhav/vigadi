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
}

export interface BalanceTarget {
  carb: number;
  veg: number;
  protein: number;
}

export interface MealTemplate {
  id: string;
  name: string;
  meal_slots: MealSlot[];
  day_types: DayType[];
  slots: DishSlot[];
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

export function formatSlotPreview(slot: DishSlot): string {
  const categories = [slot.category, ...(slot.options ?? [])];
  const unique = [...new Set(categories)];
  const label =
    unique.length > 1
      ? unique.map(formatCategoryLabel).join("/")
      : formatCategoryLabel(slot.category);
  return `${slot.count} ${label}`;
}

export function formatTemplatePreview(template: MealTemplate): string {
  return template.slots.map(formatSlotPreview).join(" + ");
}

export function templateMatchesContext(
  template: MealTemplate,
  mealSlot: MealSlot,
  dayType: DayType
): boolean {
  const slotMatch = template.meal_slots.includes(mealSlot);
  const dayMatch =
    template.day_types.includes("any") ||
    template.day_types.includes(dayType) ||
    (dayType !== "school_day" && dayType !== "holiday" && template.day_types.includes(dayType));
  return slotMatch && dayMatch;
}

export function getDayTypeForDate(date: Date, settings: DaySettings): DayType {
  const iso = date.toISOString().slice(0, 10);
  if (settings.holiday_override?.date === iso) {
    return settings.holiday_override.is_holiday ? "holiday" : "school_day";
  }
  const weekday = date.getDay();
  return settings.school_weekdays.includes(weekday) ? "school_day" : "holiday";
}

export function pickAutoTemplate(
  templates: MealTemplate[],
  mealSlot: MealSlot,
  dayType: DayType
): MealTemplate | undefined {
  const matching = templates.filter((t) => templateMatchesContext(t, mealSlot, dayType));
  if (matching.length === 0) {
    return templates.find((t) => t.meal_slots.includes(mealSlot));
  }
  const exact = matching.find((t) => !t.day_types.includes("any"));
  return exact ?? matching[0];
}

export function createTemplateId(): string {
  return `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export const DEFAULT_DAY_SETTINGS: DaySettings = {
  school_weekdays: [1, 2, 3, 4, 5],
  holiday_override: null,
};

export const REGION_PRESET_TEMPLATES: MealTemplate[] = [
  {
    id: "preset-tn-lunch",
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
