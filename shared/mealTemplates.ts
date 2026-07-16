export type MealSlot = "breakfast" | "lunch" | "dinner";
export type DayType = "school_day" | "holiday" | "any" | string;

/** Meal group — what role a dish plays on the plate (maps to dishes.dish_category). */
export type MealGroup = "rice" | "gravy" | "side" | "chutney" | "tiffin";

/** @alias MealGroup */
export type DishCategory = MealGroup;

export interface DishSlot {
  /** Meal group: rice, gravy, side, chutney, tiffin */
  category: MealGroup;
  /** Dish type within group: mixed_rice, poriyal, kulambu, etc. (maps to dishes.dish_type) */
  dish_type?: string;
  count: number;
  /** OR acceptable dish types within the group */
  options?: string[];
  note?: string;
  reuse?: "all_meals" | MealSlot;
  /** Pin a specific catalog dish by name/id */
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

export const MEAL_GROUP_LABELS: Record<MealGroup, string> = {
  rice: "Rice",
  gravy: "Gravy",
  side: "Side",
  chutney: "Chutney",
  tiffin: "Tiffin",
};

/** @alias MEAL_GROUP_LABELS */
export const DISH_CATEGORY_LABELS = MEAL_GROUP_LABELS;

export const ALL_MEAL_GROUPS: MealGroup[] = ["rice", "gravy", "side", "chutney", "tiffin"];

/** @alias ALL_MEAL_GROUPS */
export const ALL_DISH_CATEGORIES = ALL_MEAL_GROUPS;

export const DISH_TYPE_LABELS: Record<string, string> = {
  plain_rice: "Plain Rice",
  mixed_rice: "Mixed Rice",
  kulambu: "Kulambu",
  curry: "Curry",
  sambar: "Sambar",
  rasam: "Rasam",
  poriyal: "Poriyal",
  fry: "Fry",
  aviyal: "Aviyal",
  kootu: "Kootu",
  thoran: "Thoran",
  chutney: "Chutney",
  pachadi: "Pachadi",
  thogayal: "Thogayal",
  idli: "Idli",
  dosa: "Dosa",
  upma: "Upma",
  pongal: "Pongal",
  tiffin: "Tiffin",
};

const CANONICAL_DISH_TYPES = new Set(Object.keys(DISH_TYPE_LABELS));

const RAW_TYPE_TO_CANONICAL: Record<string, string> = {
  gravy: "kulambu",
  kulambu: "kulambu",
  kuzhambu: "kulambu",
  kuzhambu_style: "kulambu",
  curry: "curry",
  sambar: "sambar",
  rasam: "rasam",
  side: "poriyal",
  fry: "fry",
  poriyal: "poriyal",
  roast: "fry",
  varuval: "fry",
  thoran: "thoran",
  kootu: "kootu",
  aviyal: "aviyal",
  chutney: "chutney",
  pachadi: "pachadi",
  thogayal: "thogayal",
  tiffin: "tiffin",
  idli: "idli",
  dosa: "dosa",
  upma: "upma",
  pongal: "pongal",
  puttu: "tiffin",
  appam: "tiffin",
  adai: "tiffin",
  uthappam: "tiffin",
  mixed_rice: "mixed_rice",
  biryani: "mixed_rice",
  pulao: "mixed_rice",
  plain_rice: "plain_rice",
  rice: "plain_rice",
  staple: "plain_rice",
  protein: "fry",
};

const TYPE_TO_MEAL_GROUP: Record<string, MealGroup> = {
  plain_rice: "rice",
  mixed_rice: "rice",
  kulambu: "gravy",
  curry: "gravy",
  sambar: "gravy",
  rasam: "gravy",
  poriyal: "side",
  fry: "side",
  aviyal: "side",
  kootu: "side",
  thoran: "side",
  chutney: "chutney",
  pachadi: "chutney",
  thogayal: "chutney",
  tiffin: "tiffin",
  idli: "tiffin",
  dosa: "tiffin",
  upma: "tiffin",
  pongal: "tiffin",
};

const NAME_TYPE_HINTS: Array<{ pattern: RegExp; dishType: string }> = [
  { pattern: /\b(idli|dosa|upma|pongal|puttu|appam|adai|uthappam)\b/i, dishType: "tiffin" },
  { pattern: /\b(chutney|pachadi|thogayal)\b/i, dishType: "chutney" },
  { pattern: /\b(sambar)\b/i, dishType: "sambar" },
  { pattern: /\b(rasam)\b/i, dishType: "rasam" },
  { pattern: /\b(kulambu|kuzhambu)\b/i, dishType: "kulambu" },
  { pattern: /\b(curry)\b/i, dishType: "curry" },
  { pattern: /\b(aviyal)\b/i, dishType: "aviyal" },
  { pattern: /\b(kootu)\b/i, dishType: "kootu" },
  { pattern: /\b(poriyal)\b/i, dishType: "poriyal" },
  { pattern: /\b(varuval|fry|roast|thoran)\b/i, dishType: "fry" },
  { pattern: /\b(biryani|pulao)\b/i, dishType: "mixed_rice" },
  { pattern: /\b(lemon|tamarind|tomato|coconut|curd|sambar)\s+rice\b/i, dishType: "mixed_rice" },
  { pattern: /\b\w+\s+rice\b/i, dishType: "mixed_rice" },
];

/** Legacy slot/dish_category values → meal group */
const LEGACY_TO_GROUP: Record<string, MealGroup> = {
  rice_staple: "rice",
  mixed_rice: "rice",
  kulambu: "gravy",
  curry: "gravy",
  sambar: "gravy",
  side_poriyal: "side",
  protein: "side",
  chutney: "chutney",
  tiffin: "tiffin",
};

/** Legacy slot category → default dish_type when migrating */
const LEGACY_TO_DISH_TYPE: Record<string, string> = {
  rice_staple: "plain_rice",
  mixed_rice: "mixed_rice",
  kulambu: "kulambu",
  curry: "curry",
  sambar: "sambar",
};

export function resolveDishType(dishType: string | null | undefined, name?: string): string {
  const type = (dishType ?? "").toLowerCase().trim();
  const nameHaystack = (name ?? "").toLowerCase();

  for (const hint of NAME_TYPE_HINTS) {
    if (nameHaystack && hint.pattern.test(nameHaystack)) return hint.dishType;
  }
  const haystack = `${type} ${nameHaystack}`.trim();
  for (const hint of NAME_TYPE_HINTS) {
    if (hint.pattern.test(haystack)) return hint.dishType;
  }
  if (type && RAW_TYPE_TO_CANONICAL[type]) return RAW_TYPE_TO_CANONICAL[type];
  if (type.includes("gravy") || type.includes("kulambu")) return "kulambu";
  if (type.includes("poriyal") || type.includes("side")) return "poriyal";
  if (type.includes("fry") || type.includes("roast")) return "fry";
  return type || "poriyal";
}

export function mealGroupForDishType(dishType: string): MealGroup {
  return TYPE_TO_MEAL_GROUP[dishType] ?? "side";
}

export function resolveMealGroup(dishType: string | null | undefined, name?: string): MealGroup {
  const canonical = resolveDishType(dishType, name);
  return mealGroupForDishType(canonical);
}

/** @deprecated use resolveMealGroup */
export function resolveDishCategory(dishType: string | null | undefined, name?: string): MealGroup {
  return resolveMealGroup(dishType, name);
}

export function normalizeSlotCategory(category: string): MealGroup {
  return LEGACY_TO_GROUP[category] ?? (category as MealGroup);
}

export function normalizeDishSlot(slot: DishSlot): DishSlot {
  const legacyType = LEGACY_TO_DISH_TYPE[slot.category];
  const category = normalizeSlotCategory(slot.category);
  const dish_type =
    slot.dish_type ??
    legacyType ??
    (slot.options?.length === 1 && CANONICAL_DISH_TYPES.has(slot.options[0])
      ? slot.options[0]
      : undefined);
  const options = slot.options
    ?.map((o) => (LEGACY_TO_DISH_TYPE[o] ? LEGACY_TO_DISH_TYPE[o] : LEGACY_TO_GROUP[o] ? o : o))
    .filter((o) => o !== dish_type)
    .filter((o, i, arr) => arr.indexOf(o) === i);
  return {
    ...slot,
    category,
    dish_type,
    options: options?.length ? options : undefined,
  };
}

export function slotMatchesDish(
  slot: DishSlot,
  dish: { dish_category?: string | null; dish_type?: string | null; name: string }
): boolean {
  const normalized = normalizeDishSlot(slot);
  const dishType = resolveDishType(dish.dish_type, dish.name);
  const group = effectiveMealGroup(dish);

  if (normalized.dishName?.trim()) {
    const needle = normalized.dishName.trim().toLowerCase();
    const matchesName =
      dish.name.toLowerCase().includes(needle) || needle.includes(dish.name.toLowerCase());
    if (!matchesName) return false;
  }

  if (normalized.dish_type) {
    return dishType === normalized.dish_type;
  }
  if (normalized.options?.length) {
    if (normalized.options.includes(dishType)) return true;
    const optionGroups = normalized.options
      .map((o) => LEGACY_TO_GROUP[o] ?? ((ALL_MEAL_GROUPS as string[]).includes(o) ? o : null))
      .filter(Boolean) as MealGroup[];
    if (optionGroups.length && optionGroups.includes(group)) return true;
    return normalized.options.some((o) => {
      const optType = LEGACY_TO_DISH_TYPE[o] ?? o;
      return dishType === optType;
    });
  }
  return group === normalized.category;
}

export function slotAcceptsCategory(slot: DishSlot, group: MealGroup): boolean {
  const normalized = normalizeDishSlot(slot);
  if (normalized.category === group) return true;
  const optionGroups = (normalized.options ?? [])
    .map((o) => LEGACY_TO_GROUP[o] ?? ((ALL_MEAL_GROUPS as string[]).includes(o) ? o : null))
    .filter(Boolean);
  return optionGroups.includes(group);
}

export function dishMatchesCategoryFilter(
  dish: { dish_category?: string | null; dish_type?: string | null; name: string },
  filter?: string
): boolean {
  if (!filter) return true;
  const dishType = resolveDishType(dish.dish_type, dish.name);
  const group = effectiveMealGroup(dish);
  if ((ALL_MEAL_GROUPS as string[]).includes(filter)) {
    return group === filter;
  }
  if (LEGACY_TO_GROUP[filter]) {
    const expectedType = LEGACY_TO_DISH_TYPE[filter];
    return group === LEGACY_TO_GROUP[filter] && (!expectedType || dishType === expectedType);
  }
  if (CANONICAL_DISH_TYPES.has(filter)) {
    return dishType === filter;
  }
  return dish.dish_category === filter || dishType === filter;
}

export function effectiveMealGroup(dish: {
  dish_category?: string | null;
  dish_type?: string | null;
  name: string;
}): MealGroup {
  if (dish.dish_category && LEGACY_TO_GROUP[dish.dish_category]) {
    return LEGACY_TO_GROUP[dish.dish_category];
  }
  if (
    dish.dish_category &&
    (ALL_MEAL_GROUPS as string[]).includes(dish.dish_category)
  ) {
    return dish.dish_category as MealGroup;
  }
  return resolveMealGroup(dish.dish_type, dish.name);
}

/** @alias effectiveMealGroup */
export const effectiveDishCategory = effectiveMealGroup;

export function isPlainRiceCoveredByTag(slot: DishSlot, includesRice: boolean): boolean {
  const normalized = normalizeDishSlot(slot);
  return normalized.category === "rice" && normalized.dish_type === "plain_rice" && includesRice;
}

/** @alias isPlainRiceCoveredByTag */
export function isRiceStapleCoveredByTag(slot: DishSlot, includesRice: boolean): boolean {
  const normalized = normalizeDishSlot(slot);
  if (!includesRice || normalized.category !== "rice") return false;
  return !normalized.dish_type || normalized.dish_type === "plain_rice";
}

export function formatDishTypeLabel(dishType: string): string {
  return DISH_TYPE_LABELS[dishType] ?? dishType.replace(/_/g, " ");
}

export function formatCategoryLabel(category: MealGroup): string {
  return MEAL_GROUP_LABELS[category] ?? category;
}

export function formatSlotLabel(slot: DishSlot): string {
  if (slot.dishName?.trim()) return slot.dishName.trim();
  const normalized = normalizeDishSlot(slot);
  if (normalized.dish_type) {
    return formatDishTypeLabel(normalized.dish_type);
  }
  if (normalized.options?.length) {
    return normalized.options.map(formatDishTypeLabel).join(" / ");
  }
  return formatCategoryLabel(normalized.category);
}

export function slotFromDishName(
  name: string,
  dishType?: string | null,
  dishCategory?: string | null,
  dishId?: number
): DishSlot {
  const canonicalType = resolveDishType(dishType, name);
  const group = dishCategory
    ? normalizeSlotCategory(dishCategory)
    : mealGroupForDishType(canonicalType);
  return {
    category: group,
    dish_type: canonicalType,
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
  const remapPlan = (plan?: MealPlan): MealPlan | undefined => {
    if (!plan) return plan;
    const next: MealPlan = {};
    for (const ms of ["breakfast", "lunch", "dinner"] as MealSlot[]) {
      const slots = plan[ms];
      if (slots?.length) next[ms] = slots.map(normalizeDishSlot);
    }
    return next;
  };

  if (template.meals && Object.values(template.meals).some((s) => s && s.length > 0)) {
    const meals = remapPlan(template.meals)!;
    const meal_slots = templateMealSlots({ ...template, meals });
    return {
      ...template,
      meals,
      meal_slots,
      day_types: [],
      slots: flattenMealPlan(meals),
    };
  }

  const meals: MealPlan = {};
  const legacySlots = (template.slots ?? []).map(normalizeDishSlot);
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
    slots.some((s) => {
      const n = normalizeDishSlot(s);
      if (n.category !== "rice") return false;
      return !n.dish_type || n.dish_type === "plain_rice";
    });
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

export function formatDishSearchSubtitle(dish: {
  name: string;
  dishType?: string | null;
  dishCategory?: string | null;
  ingredientName?: string | null;
}): string {
  const group = formatCategoryLabel(
    (dish.dishCategory as MealGroup | undefined) ?? resolveMealGroup(dish.dishType, dish.name)
  );
  const type = dish.dishType ? formatDishTypeLabel(resolveDishType(dish.dishType, dish.name)) : null;
  return [group, type, dish.ingredientName].filter(Boolean).join(" · ");
}

export interface MealGroupSlotPreset {
  group: MealGroup;
  dishTypes: Array<{ label: string; slot: DishSlot }>;
}

/** TN taxonomy picker: meal group → dish type slots */
export const MEAL_GROUP_SLOT_PRESETS: MealGroupSlotPreset[] = [
  {
    group: "tiffin",
    dishTypes: [{ label: "Tiffin", slot: { category: "tiffin", count: 1 } }],
  },
  {
    group: "chutney",
    dishTypes: [{ label: "Chutney", slot: { category: "chutney", count: 1 } }],
  },
  {
    group: "rice",
    dishTypes: [
      { label: "Plain Rice", slot: { category: "rice", dish_type: "plain_rice", count: 1 } },
      { label: "Mixed Rice", slot: { category: "rice", dish_type: "mixed_rice", count: 1 } },
    ],
  },
  {
    group: "gravy",
    dishTypes: [
      { label: "Kulambu", slot: { category: "gravy", dish_type: "kulambu", count: 1 } },
      { label: "Sambar", slot: { category: "gravy", dish_type: "sambar", count: 1 } },
      { label: "Curry", slot: { category: "gravy", dish_type: "curry", count: 1 } },
    ],
  },
  {
    group: "side",
    dishTypes: [
      { label: "Poriyal", slot: { category: "side", dish_type: "poriyal", count: 1 } },
      { label: "Fry", slot: { category: "side", dish_type: "fry", count: 1 } },
    ],
  },
];

export const QUICK_DISH_PRESETS: Array<{ label: string; slot: DishSlot }> =
  MEAL_GROUP_SLOT_PRESETS.flatMap(({ dishTypes }) => dishTypes);

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
        { category: "side", count: 1, reuse: "all_meals" },
        { category: "side", count: 1, reuse: "all_meals", note: "egg or chicken side" },
      ],
      lunch: [
        { category: "rice", dish_type: "mixed_rice", count: 1 },
        { category: "side", count: 1, reuse: "breakfast" },
        { category: "side", count: 1, reuse: "breakfast", note: "inherits morning side" },
      ],
    },
  },
  {
    name: "Tamil Nadu Lunch",
    meal_slots: ["lunch"],
    day_types: ["any"],
    slots: [
      { category: "gravy", dish_type: "kulambu", count: 1 },
      { category: "side", count: 2 },
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
      { category: "side", count: 1, note: "egg or chicken side" },
    ],
  },
  {
    id: "preset-school-lunch",
    name: "School Day Lunch",
    meal_slots: ["lunch"],
    day_types: ["school_day"],
    slots: [{ category: "rice", dish_type: "mixed_rice", count: 1, note: "inherits sides from morning batch" }],
  },
  {
    id: "preset-holiday-breakfast",
    name: "Holiday Breakfast",
    meal_slots: ["breakfast"],
    day_types: ["holiday"],
    slots: [
      { category: "tiffin", count: 1 },
      { category: "side", count: 1 },
      { category: "side", count: 1, note: "egg or chicken side" },
    ],
  },
  {
    id: "preset-holiday-lunch",
    name: "Holiday Lunch",
    meal_slots: ["lunch"],
    day_types: ["holiday"],
    slots: [
      { category: "rice", dish_type: "plain_rice", count: 1 },
      { category: "gravy", dish_type: "kulambu", count: 1, options: ["curry"] },
      { category: "side", count: 1 },
      { category: "side", count: 1, note: "egg or chicken side" },
    ],
  },
  {
    id: "preset-kerala-lunch",
    name: "Kerala Lunch",
    meal_slots: ["lunch"],
    day_types: ["any"],
    slots: [
      { category: "gravy", dish_type: "curry", count: 1 },
      { category: "side", count: 1 },
    ],
  },
  {
    id: "preset-homestyle",
    name: "Classic Homestyle",
    meal_slots: ["lunch", "dinner"],
    day_types: ["any"],
    slots: [
      { category: "gravy", dish_type: "kulambu", count: 1, options: ["curry"] },
      { category: "side", count: 1 },
    ],
  },
  {
    id: "preset-high-protein",
    name: "High Protein Plate",
    meal_slots: ["lunch", "dinner"],
    day_types: ["any"],
    slots: [
      { category: "side", count: 1, note: "egg or chicken side" },
      { category: "rice", dish_type: "plain_rice", count: 1 },
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
