import type { DishRow } from "./db/catalog";
import {
  getCatalogEntry,
  resolveIngredient,
  resolveToCanonical,
} from "../shared/ingredientSearch";
import { normalizeAlias } from "../shared/ingredientCatalog";

export type ConsistencyValue = "dry" | "semi_liquid" | "liquid" | "crisp";
export type SpiceBand = "spicy" | "medium" | "mild";
export type ConsistencyBand = "liquid" | "semi_liquid" | "dry";

export interface ComboSignature {
  consistencyBand: ConsistencyBand;
  spiceBand: SpiceBand;
}

export interface BalanceArchetype {
  id: "A" | "B" | "C" | "D" | "E";
  label: string;
  requiresProteinIngredient?: boolean;
  matchesAnchor: (dish: DishRow) => boolean;
  matchesSide: (dish: DishRow, slotIndex: number) => boolean;
  signature: (anchor: DishRow) => ComboSignature;
}

const SPICE_SCORES: Record<string, number> = {
  mild: 1,
  medium: 2,
  spicy: 3,
  very_spicy: 4,
};

const SCORE_B1_SATISFIED = 20;
const SCORE_B1_VIOLATED = -25;
const SCORE_B2_SATISFIED = 20;
const SCORE_B2_VIOLATED = -25;
const SCORE_ALL_SAME_SPICE = -15;
const SCORE_ALL_SAME_WETNESS = -15;
const SCORE_CRISP_BONUS = 5;
const SCORE_SEMI_LIQUID_FOR_DRY_RICE = 10;

function normalizeGroup(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function dishText(dish: DishRow): string {
  return `${dish.dish_category ?? ""} ${dish.name}`.toLowerCase();
}

function ingredientKey(dish: DishRow): string {
  const name = dish.ingredient_name ?? "";
  if (!name) return "";
  return normalizeAlias(resolveToCanonical(name));
}

export function spiceScore(dish: DishRow): number {
  const level = (dish.spice_level ?? "medium").toLowerCase();
  return SPICE_SCORES[level] ?? 2;
}

export function isSpicyBand(dish: DishRow): boolean {
  return spiceScore(dish) >= 3;
}

export function isMildBand(dish: DishRow): boolean {
  return spiceScore(dish) <= 2;
}

export function isMediumBand(dish: DishRow): boolean {
  return spiceScore(dish) === 2;
}

export function getConsistency(dish: DishRow): ConsistencyValue {
  const column = dish.consistency?.toLowerCase();
  if (
    column === "dry" ||
    column === "semi_liquid" ||
    column === "liquid" ||
    column === "crisp"
  ) {
    return column;
  }

  const text = dishText(dish);
  if (/kuzhambu|sambar|rasam|gravy|curry/.test(text)) return "liquid";
  if (/kootu|pachadi|chutney|thuvaiyal|masala/.test(text)) return "semi_liquid";
  if (/poriyal|fry|roast|varuval|65|sundal/.test(text)) return "dry";
  return "semi_liquid";
}

export function isDryForBalance(consistency: ConsistencyValue): boolean {
  return consistency === "dry" || consistency === "crisp";
}

export function isLiquidishForBalance(consistency: ConsistencyValue): boolean {
  return consistency === "liquid" || consistency === "semi_liquid";
}

export function isProteinDish(dish: DishRow): boolean {
  const name = dish.ingredient_name;
  if (!name) return false;
  const resolved = resolveIngredient(name);
  if (!resolved) return false;
  return getCatalogEntry(resolved.id)?.category === "protein";
}

export function pickedIngredientsIncludeProtein(ingredientNames: string[]): boolean {
  return ingredientNames.some((name) => {
    const resolved = resolveIngredient(name);
    if (!resolved) return false;
    return getCatalogEntry(resolved.id)?.category === "protein";
  });
}

export function allowsIngredientReuse(a: DishRow, b: DishRow): boolean {
  const keyA = ingredientKey(a);
  const keyB = ingredientKey(b);
  if (!keyA || !keyB || keyA !== keyB) return true;
  return isProteinDish(a) && isProteinDish(b);
}

export function anchorSignature(anchor: DishRow): ComboSignature {
  const consistency = getConsistency(anchor);
  let consistencyBand: ConsistencyBand;
  if (isDryForBalance(consistency)) consistencyBand = "dry";
  else if (consistency === "liquid") consistencyBand = "liquid";
  else consistencyBand = "semi_liquid";

  const score = spiceScore(anchor);
  let spiceBand: SpiceBand;
  if (score >= 3) spiceBand = "spicy";
  else if (score === 2) spiceBand = "medium";
  else spiceBand = "mild";

  return { consistencyBand, spiceBand };
}

function isGravyOrCurry(dish: DishRow): boolean {
  const group = normalizeGroup(dish.dish_group);
  return group === "gravy" || group === "curry";
}

function isKootuStyle(dish: DishRow): boolean {
  const text = dishText(dish);
  return text.includes("kootu") || getConsistency(dish) === "semi_liquid";
}

function isSambarStyle(dish: DishRow): boolean {
  const text = dishText(dish);
  return text.includes("sambar") || normalizeGroup(dish.dish_category) === "sambar";
}

function isDrySide(dish: DishRow): boolean {
  return isDryForBalance(getConsistency(dish));
}

function isSemiLiquidSide(dish: DishRow): boolean {
  return getConsistency(dish) === "semi_liquid";
}

function isSpicyDrySide(dish: DishRow): boolean {
  return isSpicyBand(dish) && isDrySide(dish);
}

export const ARCHETYPES: BalanceArchetype[] = [
  {
    id: "A",
    label: "Spicy liquid gravy with mild dry sides",
    matchesAnchor: (dish) =>
      isGravyOrCurry(dish) && isSpicyBand(dish) && getConsistency(dish) === "liquid",
    matchesSide: (dish) => isMildBand(dish) && isDrySide(dish),
    signature: anchorSignature,
  },
  {
    id: "B",
    label: "Mild kootu with spicy dry side and medium side",
    matchesAnchor: (dish) =>
      isMildBand(dish) && isKootuStyle(dish) && isLiquidishForBalance(getConsistency(dish)),
    matchesSide: (dish, slotIndex) =>
      slotIndex === 0 ? isSpicyDrySide(dish) : isMediumBand(dish),
    signature: anchorSignature,
  },
  {
    id: "C",
    label: "Everyday sambar plate",
    matchesAnchor: (dish) =>
      isSambarStyle(dish) && isMediumBand(dish) && getConsistency(dish) === "liquid",
    matchesSide: (dish) => isMediumBand(dish),
    signature: anchorSignature,
  },
  {
    id: "D",
    label: "Variety rice with semi-liquid side",
    matchesAnchor: (dish) =>
      normalizeGroup(dish.dish_group) === "rice" && isDryForBalance(getConsistency(dish)),
    matchesSide: (dish) => isSemiLiquidSide(dish),
    signature: anchorSignature,
  },
  {
    id: "E",
    label: "Same-protein curry and fry with mild veg side",
    requiresProteinIngredient: true,
    matchesAnchor: (dish) => isProteinDish(dish) && isGravyOrCurry(dish),
    matchesSide: (dish, slotIndex) =>
      slotIndex === 0 ? isProteinDish(dish) && isDrySide(dish) : isMildBand(dish),
    signature: anchorSignature,
  },
];

export function getEligibleArchetypes(pickedIngredients: string[]): BalanceArchetype[] {
  const includeProteinArchetype = pickedIngredientsIncludeProtein(pickedIngredients);
  return ARCHETYPES.filter(
    (archetype) => !archetype.requiresProteinIngredient || includeProteinArchetype
  );
}

export function shouldSkipPlainRiceStaple(anchor: DishRow): boolean {
  return normalizeGroup(anchor.dish_group) === "rice";
}

export function pickedIncludesVarietyRice(dishes: DishRow[]): boolean {
  return dishes.some(shouldSkipPlainRiceStaple);
}

export function resolveTemplateComboStaple(
  picked: DishRow[],
  templateStaple: string | null
): string | null {
  if (pickedIncludesVarietyRice(picked) && templateStaple === "Rice") {
    return null;
  }
  return templateStaple;
}

export function findTemplateComboAnchor(alreadyPicked: DishRow[]): DishRow | null {
  const gravyOrCurry = alreadyPicked.find(isGravyOrCurry);
  if (gravyOrCurry) return gravyOrCurry;
  const riceAnchor = alreadyPicked.find((d) => normalizeGroup(d.dish_group) === "rice");
  return riceAnchor ?? null;
}

export function scoreTemplateCandidateBalance(
  candidate: DishRow,
  alreadyPicked: DishRow[]
): number {
  const anchor = findTemplateComboAnchor(alreadyPicked);
  if (!anchor) return 0;
  const existingSides = alreadyPicked.filter((d) => d.id !== anchor.id);
  return scoreComboBalance(anchor, [...existingSides, candidate]);
}

export interface TemplateSlotTasteProfile {
  liked_dish_types: Record<string, number>;
  disliked_dish_types: Record<string, number>;
  liked_prep_styles: Record<string, string[]>;
  disliked_prep_styles: Record<string, string[]>;
  preferred_spice: string | null;
  liked_combos: unknown[];
  disliked_combos: unknown[];
  ingredient_preferences: Record<
    string,
    { preferred: string[]; avoided: string[] }
  >;
}

export function compareTemplateSlotCandidates(
  a: DishRow,
  b: DishRow,
  alreadyPicked: DishRow[],
  taste: TemplateSlotTasteProfile,
  variant: number,
  scoreTaste: (dish: DishRow, taste: TemplateSlotTasteProfile) => number
): number {
  const tasteDelta =
    scoreTaste(b, taste) -
    scoreTaste(a, taste) +
    variant * ((a.id % 7) - (b.id % 7));
  if (tasteDelta !== 0) return tasteDelta;
  return (
    scoreTemplateCandidateBalance(b, alreadyPicked) -
    scoreTemplateCandidateBalance(a, alreadyPicked)
  );
}

export function scoreComboBalance(anchor: DishRow, sides: DishRow[]): number {
  let score = 0;
  const allDishes = [anchor, ...sides];
  const spiceScores = allDishes.map(spiceScore);
  if (new Set(spiceScores).size === 1) score += SCORE_ALL_SAME_SPICE;

  if (isSpicyBand(anchor)) {
    const sidesAllMild = sides.length > 0 && sides.every(isMildBand);
    score += sidesAllMild ? SCORE_B1_SATISFIED : SCORE_B1_VIOLATED;
    if (sides.some(isSpicyBand)) score += SCORE_B1_VIOLATED;
  } else if (isMildBand(anchor)) {
    score += sides.some(isSpicyBand) ? SCORE_B1_SATISFIED : SCORE_B1_VIOLATED;
  }

  const anchorConsistency = getConsistency(anchor);
  const sideConsistencies = sides.map(getConsistency);
  const allConsistencies = [anchorConsistency, ...sideConsistencies];
  const allLiquidish = allConsistencies.every(isLiquidishForBalance);
  const allDryish = allConsistencies.every(isDryForBalance);
  if (allLiquidish || allDryish) score += SCORE_ALL_SAME_WETNESS;

  if (isLiquidishForBalance(anchorConsistency)) {
    const hasDrySide = sideConsistencies.some(isDryForBalance);
    score += hasDrySide ? SCORE_B2_SATISFIED : SCORE_B2_VIOLATED;
    if (anchorConsistency === "liquid" && sideConsistencies.some((c) => c === "crisp")) {
      score += SCORE_CRISP_BONUS;
    }
  } else if (
    isDryForBalance(anchorConsistency) &&
    normalizeGroup(anchor.dish_group) === "rice"
  ) {
    const hasSemiLiquid = sideConsistencies.some((c) => c === "semi_liquid");
    score += hasSemiLiquid ? SCORE_SEMI_LIQUID_FOR_DRY_RICE : SCORE_B2_VIOLATED;
  }

  return score;
}

function describeSpice(dish: DishRow): string {
  const level = (dish.spice_level ?? "medium").replace(/_/g, " ");
  return level;
}

function primaryDishLabel(dish: DishRow): string {
  return dish.name;
}

export function buildBalanceRationale(anchor: DishRow, sides: DishRow[]): string {
  const anchorSpice = describeSpice(anchor);
  const sideLabels = sides.map((side) => `${describeSpice(side)} ${primaryDishLabel(side)}`);
  const anchorLabel = primaryDishLabel(anchor);

  if (sides.length === 0) {
    return `${anchorSpice} ${anchorLabel} plate.`;
  }

  if (sides.length === 1) {
    return `${anchorSpice} ${anchorLabel} balanced with ${sideLabels[0]}.`;
  }

  const last = sideLabels.pop();
  return `${anchorSpice} ${anchorLabel} balanced with ${sideLabels.join(", ")} and ${last}.`;
}
