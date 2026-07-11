import type { MealTemplate, MealSlot } from "../shared/mealTemplates";
import {
  formatMealSectionPreview,
  getSlotsForMeal,
  uiSlotFromMealSlot,
} from "../shared/mealTemplates";

export function describeComboBuildFailure(params: {
  catalogCount: number;
  mealSlot: MealSlot;
  template?: MealTemplate;
}): { error: string; code: "CATALOG_EMPTY" | "TEMPLATE_NO_MATCH" } {
  const mealLabel = uiSlotFromMealSlot(params.mealSlot);

  if (params.catalogCount === 0) {
    return {
      code: "CATALOG_EMPTY",
      error: "No dishes in catalog for these ingredients. Run Discover Dishes first.",
    };
  }

  const slotPreview = params.template
    ? formatMealSectionPreview(params.mealSlot, getSlotsForMeal(params.template, params.mealSlot))
    : mealLabel;

  return {
    code: "TEMPLATE_NO_MATCH",
    error: `No ${mealLabel.toLowerCase()} combos matched your template (${slotPreview}). Try ingredients that fit those dish types, or edit your template.`,
  };
}
