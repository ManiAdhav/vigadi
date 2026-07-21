import { DishRow, getCatalogDishesForBuild, parseDishRow, getTasteProfile, type TasteProfile } from "./db";
import {
  expandCatalogIngredients,
  filterMixedRiceForIngredients,
} from "../shared/catalogIngredients";
import {
  DishSlot,
  MealTemplate,
  MealSlot,
  formatMealSectionPreview,
  formatTemplatePreview,
  getSlotsForMeal,
  mealSlotFromUi,
  normalizeTemplate,
  normalizeDishSlot,
  resolveComboStaple,
  resolveStapleForCombo,
  isRiceStapleCoveredByTag,
  shouldFillSlotAtMeal,
  slotMatchesDish,
  formatDishTypeLabel,
  formatCategoryLabel,
} from "../shared/mealTemplates";
import type { MealGroup } from "../shared/mealTemplates";
import { BuiltCombo, scoreDishForTaste, MAX_COMBOS } from "./comboBuilder";
import {
  compareTemplateSlotCandidates,
  resolveTemplateComboStaple,
  type TemplateSlotTasteProfile,
} from "./comboBalance";

export interface UnfilledSlot {
  slotIndex: number;
  category: MealGroup;
  options?: string[];
  note?: string;
  suggestion?: string;
}

export interface TemplateBuiltCombo extends BuiltCombo {
  unfilledSlots?: UnfilledSlot[];
  templatePreview?: string;
}

function dishesMatchingSlot(
  allDishes: DishRow[],
  slot: DishSlot,
  usedIds: Set<number>,
  userIngredients: string[] = []
): DishRow[] {
  if (slot.dishId) {
    const pinned = allDishes.find((d) => d.id === slot.dishId && !usedIds.has(d.id));
    return pinned ? [pinned] : [];
  }
  if (slot.dishName?.trim()) {
    const needle = slot.dishName.trim().toLowerCase();
    const named = allDishes.filter(
      (d) =>
        !usedIds.has(d.id) &&
        (d.name.toLowerCase().includes(needle) || needle.includes(d.name.toLowerCase())) &&
        slotMatchesDish(slot, d)
    );
    if (named.length > 0) return named;
  }
  let candidates = allDishes.filter(
    (d) => !usedIds.has(d.id) && slotMatchesDish(slot, d)
  );
  const normalized = normalizeDishSlot(slot);
  if (normalized.category === "rice" && normalized.dish_type === "mixed_rice") {
    candidates = filterMixedRiceForIngredients(candidates, userIngredients);
  }
  return candidates;
}

function suggestForSlot(
  slot: DishSlot,
  available: DishRow[],
  userIngredients: string[] = []
): string | undefined {
  if (available.length > 0) return undefined;
  const normalized = normalizeDishSlot(slot);
  if (slot.dishName) {
    return `Add ingredients for "${slot.dishName}" or discover dishes first`;
  }
  if (normalized.category === "rice" && (!normalized.dish_type || normalized.dish_type === "plain_rice")) {
    return "Add Rice as an ingredient tag to include plain rice with this meal";
  }
  const label = normalized.dish_type
    ? formatDishTypeLabel(normalized.dish_type)
    : normalized.options?.length
      ? normalized.options.map(formatDishTypeLabel).join(" or ")
      : formatCategoryLabel(normalized.category);
  const sample = allIngredientHints(normalized);
  return `Add ${sample} to unlock ${label} dishes`;
}

/**
 * Suggests PRIMARY ingredients that unlock a group's dishes.
 * Never suggests pantry/secondary staples (oil, tomato, onion, ginger, garlic,
 * tamarind) since users always have those and dishes are gated on their
 * primary ingredient, not pantry items.
 */
export function unlockIngredientHint(category: MealGroup): string {
  const hints: Record<MealGroup, string> = {
    tiffin: "rava or idli batter",
    gravy: "a vegetable, paneer, chicken or fish",
    rice: "a vegetable like carrot or beans",
    side: "a vegetable like potato or beans",
    chutney: "coconut or a vegetable",
    snack: "a snack ingredient like aval or potato",
  };
  return hints[category] ?? "a primary ingredient";
}

function allIngredientHints(slot: DishSlot): string {
  return unlockIngredientHint(slot.category);
}

type CompareTemplateCandidates = typeof compareTemplateSlotCandidates;

function pickForSlot(
  candidates: DishRow[],
  slot: DishSlot,
  taste: TasteProfile,
  variant: number,
  usedIngredients: Set<string>,
  alreadyPicked: DishRow[] = [],
  compareCandidates: CompareTemplateCandidates = compareTemplateSlotCandidates
): DishRow[] {
  const scoreTaste = (dish: DishRow, profile: TasteProfile) =>
    scoreDishForTaste(dish, profile, dish.ingredient_name ?? "");
  const picked: DishRow[] = [];
  const balanceContext = [...alreadyPicked];

  const pickNext = (requireUniqueIngredient: boolean): boolean => {
    const remaining = candidates.filter((c) => !picked.some((p) => p.id === c.id));
    const sorted = [...remaining].sort((a, b) =>
      compareCandidates(
        a,
        b,
        balanceContext,
        taste as TemplateSlotTasteProfile,
        variant,
        scoreTaste
      )
    );

    for (const dish of sorted) {
      const ing = (dish.ingredient_name ?? "").toLowerCase();
      if (requireUniqueIngredient && usedIngredients.has(ing)) continue;
      picked.push(dish);
      if (requireUniqueIngredient) usedIngredients.add(ing);
      balanceContext.push(dish);
      return true;
    }
    return false;
  };

  while (picked.length < slot.count) {
    if (!pickNext(true)) break;
  }
  while (picked.length < slot.count) {
    if (!pickNext(false)) break;
  }

  return picked.slice(0, slot.count);
}

export interface TemplateSlotFillEntry {
  slotIndex: number;
  category: MealGroup;
  requested: number;
  filled: number;
}

export interface TemplateSlotFillResult {
  picked: DishRow[];
  unfilled: UnfilledSlot[];
  slotFills: TemplateSlotFillEntry[];
}

/** Thin wrapper for one template combo fill — no DB; used by AC8 regression tests. */
export function fillTemplateSlotsFromCatalog(params: {
  catalogDishes: DishRow[];
  fillableSlots: DishSlot[];
  taste: TasteProfile;
  variant?: number;
  ingredients?: string[];
  compareCandidates?: CompareTemplateCandidates;
}): TemplateSlotFillResult {
  const usedIds = new Set<number>();
  const usedIngredients = new Set<string>();
  const picked: DishRow[] = [];
  const unfilled: UnfilledSlot[] = [];
  const slotFills: TemplateSlotFillEntry[] = [];
  const variant = params.variant ?? 0;
  const ingredients = params.ingredients ?? [];
  const compareCandidates = params.compareCandidates ?? compareTemplateSlotCandidates;

  params.fillableSlots.forEach((slot, slotIndex) => {
    const candidates = dishesMatchingSlot(
      params.catalogDishes,
      slot,
      usedIds,
      ingredients
    );
    const slotPicked = pickForSlot(
      candidates,
      slot,
      params.taste,
      variant,
      usedIngredients,
      picked,
      compareCandidates
    );

    slotFills.push({
      slotIndex,
      category: slot.category,
      requested: slot.count,
      filled: slotPicked.length,
    });

    if (slotPicked.length < slot.count) {
      unfilled.push({
        slotIndex,
        category: slot.category,
        options: slot.options,
        note: slot.note,
      });
    }

    slotPicked.forEach((d) => {
      picked.push(d);
      usedIds.add(d.id);
    });
  });

  return { picked, unfilled, slotFills };
}

function buildComboNameFromTemplate(dishes: DishRow[], template: MealTemplate, mealSlot: MealSlot): string {
  if (dishes.length === 0) return template.name;
  const names = dishes.map((d) => d.name.split(" ")[0]).slice(0, 3);
  const mealLabel = mealSlot.charAt(0).toUpperCase() + mealSlot.slice(1);
  return `${names.join(" + ")} · ${mealLabel}`;
}

function resolveMealSlot(category: string, template: MealTemplate): MealSlot {
  try {
    const fromUi = mealSlotFromUi(category as "Breakfast" | "Lunch" | "Dinner");
    if (getSlotsForMeal(template, fromUi).length > 0) return fromUi;
  } catch {
    /* fall through */
  }
  const normalized = normalizeTemplate(template);
  const slots = normalized.meal_slots ?? [];
  return slots[0] ?? "lunch";
}

export async function buildCombosFromTemplate(params: {
  userId: string;
  ingredients: string[];
  template: MealTemplate;
  category: string;
  includesRice?: boolean;
  excludeDishIds?: number[];
  maxCombos?: number;
}): Promise<TemplateBuiltCombo[]> {
  const { template } = params;
  const mealSlot = resolveMealSlot(params.category, template);
  const includesRice = params.includesRice ?? false;
  const taste = await getTasteProfile(params.userId);
  const maxCombos = params.maxCombos ?? MAX_COMBOS;
  const excludeIds = new Set(params.excludeDishIds ?? []);

  const catalogDishes = (
    await getCatalogDishesForBuild({
      ingredients: params.ingredients,
      includesRice: params.includesRice,
      template: params.template,
      mealSlot,
    })
  ).filter((d) => !excludeIds.has(d.id));
  if (catalogDishes.length === 0) return [];

  const allSlots = getSlotsForMeal(template, mealSlot);
  const fillableSlots = allSlots.filter(
    (slot) =>
      shouldFillSlotAtMeal(slot, mealSlot) && !isRiceStapleCoveredByTag(slot, includesRice)
  );
  const riceStapleCovered = allSlots.some((slot) =>
    isRiceStapleCoveredByTag(slot, includesRice)
  );
  const inheritedCount = allSlots.length - fillableSlots.length - (riceStapleCovered ? 1 : 0);

  const preview =
    inheritedCount > 0
      ? `${formatMealSectionPreview(mealSlot, fillableSlots)} (+ ${inheritedCount} from earlier meal)`
      : formatMealSectionPreview(mealSlot, fillableSlots);

  if (fillableSlots.length === 0) return [];

  const combos: TemplateBuiltCombo[] = [];
  const globallyUsed = new Set<number>();

  for (let variant = 0; variant < maxCombos; variant++) {
    const usedIds = new Set<number>(globallyUsed);
    const usedIngredients = new Set<string>();
    const picked: DishRow[] = [];
    const unfilled: UnfilledSlot[] = [];

    fillableSlots.forEach((slot, slotIndex) => {
      const candidates = dishesMatchingSlot(catalogDishes, slot, usedIds, params.ingredients);
      const slotPicked = pickForSlot(
        candidates,
        slot,
        taste,
        variant,
        usedIngredients,
        picked
      );

      if (slotPicked.length < slot.count) {
        unfilled.push({
          slotIndex,
          category: slot.category,
          options: slot.options,
          note: slot.note,
          suggestion: suggestForSlot(slot, candidates, params.ingredients),
        });
      }

      slotPicked.forEach((d) => {
        picked.push(d);
        usedIds.add(d.id);
      });
    });

    picked.forEach((d) => globallyUsed.add(d.id));
    if (picked.length === 0) continue;

    const parsed = picked.map(parseDishRow);
    const staple = resolveTemplateComboStaple(
      picked,
      resolveStapleForCombo(
        parsed,
        resolveComboStaple(template, mealSlot, includesRice)
      )
    );
    const subComponents = [...parsed.map((d) => d.name)];
    if (staple) {
      if (riceStapleCovered) subComponents.unshift(staple);
      else subComponents.push(staple);
    }

    combos.push({
      id: `combo-tpl-${Date.now()}-${variant}`,
      name: buildComboNameFromTemplate(picked, template, mealSlot),
      dishIds: picked.map((d) => d.id),
      subComponents,
      dishes: parsed,
      staple: staple ?? "",
      rationale:
        unfilled.length > 0
          ? `${preview} — ${unfilled.length} slot(s) could not be fully filled from your ingredients.`
          : `Built for ${mealSlot}: ${preview}`,
      source: "rule_engine",
      unfilledSlots: unfilled.length > 0 ? unfilled : undefined,
      templatePreview: formatTemplatePreview(template),
    });
  }

  return combos.slice(0, maxCombos);
}

export function templateToRulesDescription(template: MealTemplate): string {
  return formatTemplatePreview(template);
}
