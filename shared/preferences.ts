import { DishSlot, MealSlot, MealTemplate } from "./mealTemplates";

export type Diet = "veg" | "veg_egg";
export type ProteinEmphasis = "light" | "balanced" | "high";

export interface PreferenceProfile {
  diet: Diet;
  proteinEmphasis: ProteinEmphasis;
}

const DIET_VALUES: Diet[] = ["veg", "veg_egg"];
const PROTEIN_EMPHASIS_VALUES: ProteinEmphasis[] = ["light", "balanced", "high"];

/**
 * "Veg and protein equally" — Mani's own example — so an untouched profile
 * still drives a sensible fallback before anyone opens the Preferences section.
 */
export const DEFAULT_PREFERENCES: PreferenceProfile = {
  diet: "veg_egg",
  proteinEmphasis: "balanced",
};

export function parsePreferences(raw: unknown): PreferenceProfile {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_PREFERENCES };
  const obj = raw as Partial<PreferenceProfile>;
  return {
    diet: DIET_VALUES.includes(obj.diet as Diet) ? (obj.diet as Diet) : DEFAULT_PREFERENCES.diet,
    proteinEmphasis: PROTEIN_EMPHASIS_VALUES.includes(obj.proteinEmphasis as ProteinEmphasis)
      ? (obj.proteinEmphasis as ProteinEmphasis)
      : DEFAULT_PREFERENCES.proteinEmphasis,
  };
}

const PROTEIN_SIDE_COUNT: Record<ProteinEmphasis, number> = {
  light: 0,
  balanced: 1,
  high: 2,
};

function proteinSideNote(diet: Diet): string {
  return diet === "veg_egg" ? "egg or protein-rich side" : "protein-rich side (paneer, legume, or tofu)";
}

function proteinSideSlot(prefs: PreferenceProfile): DishSlot | null {
  const count = PROTEIN_SIDE_COUNT[prefs.proteinEmphasis];
  if (count === 0) return null;
  return { category: "side", count, note: proteinSideNote(prefs.diet) };
}

/**
 * Slot skeleton for a meal with no food plate or template — a Breakfast build
 * used to fall through to a Lunch-shaped rule ("1 Kulambu, 2 Sides"); this
 * gives each slot its own shape, sized by protein emphasis.
 */
export function preferenceFallbackTemplate(prefs: PreferenceProfile, slot: MealSlot): MealTemplate {
  const proteinSlot = proteinSideSlot(prefs);

  if (slot === "breakfast") {
    const slots: DishSlot[] = [
      { category: "tiffin", count: 1 },
      { category: "chutney", count: 1 },
    ];
    if (proteinSlot) slots.push(proteinSlot);
    return { id: "preference-fallback", name: "Suggested for you", meals: { breakfast: slots } };
  }

  const slots: DishSlot[] = [
    { category: "rice", dish_type: "plain_rice", count: 1 },
    { category: "gravy", dish_type: "kulambu", count: 1 },
    { category: "side", count: 2 },
  ];
  if (proteinSlot) slots.push(proteinSlot);
  return { id: "preference-fallback", name: "Suggested for you", meals: { [slot]: slots } };
}

/**
 * Slot categories/dish_types reach the build pipeline, but a DishSlot's `note`
 * does not — so diet and protein emphasis are spelled out here in the same
 * plain-English rules string real food plates already send downstream.
 */
export function preferenceRulesDescription(prefs: PreferenceProfile, slot: MealSlot): string {
  const dietText = prefs.diet === "veg_egg" ? "Vegetarian, eggs allowed" : "Strictly vegetarian";
  const emphasisText: Record<ProteinEmphasis, string> = {
    light: "Keep it simple, no extra protein side needed.",
    balanced: `Favor a ${proteinSideNote(prefs.diet)} alongside the usual dishes.`,
    high: `Favor two ${proteinSideNote(prefs.diet)} dishes alongside the usual dishes.`,
  };
  return `Tamil Nadu home-style ${slot}. ${dietText}. ${emphasisText[prefs.proteinEmphasis]}`;
}

const DIET_LABELS: Record<Diet, string> = {
  veg: "Vegetarian",
  veg_egg: "Vegetarian with eggs",
};

const PROTEIN_EMPHASIS_LABELS: Record<ProteinEmphasis, string> = {
  light: "Light protein",
  balanced: "Balanced protein",
  high: "High protein",
};

/** Read-only line shown under the pickers — regenerated from them, never hand-typed. */
export function preferenceSummaryText(prefs: PreferenceProfile): string {
  return `Tamil Nadu · ${DIET_LABELS[prefs.diet]} · ${PROTEIN_EMPHASIS_LABELS[prefs.proteinEmphasis]}`;
}
