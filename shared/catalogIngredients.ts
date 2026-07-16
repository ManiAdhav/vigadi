import type { MealGroup, MealSlot, MealTemplate } from "./mealTemplates";
import { getSlotsForMeal, normalizeDishSlot } from "./mealTemplates";

const RICE_INGREDIENT = "rice";
const STAPLE_ONLY_INGREDIENTS = new Set([RICE_INGREDIENT, "pasta"]);

export function templateNeedsMixedRice(template: MealTemplate, mealSlot: MealSlot): boolean {
  const slots = getSlotsForMeal(template, mealSlot);
  return slots.some((slot) => {
    const normalized = normalizeDishSlot(slot);
    return (
      (normalized.category === "rice" && normalized.dish_type === "mixed_rice") ||
      slot.category === "mixed_rice" ||
      (slot.options ?? []).includes("mixed_rice")
    );
  });
}

export function expandCatalogIngredients(
  ingredients: string[],
  options?: {
    includesRice?: boolean;
    template?: MealTemplate;
    mealSlot?: MealSlot;
  }
): string[] {
  const expanded = [...ingredients];
  const hasRiceTag = expanded.some((ing) => ing.toLowerCase() === RICE_INGREDIENT);
  const needsRiceCatalog =
    !!options?.includesRice ||
    (!!options?.template &&
      !!options.mealSlot &&
      templateNeedsMixedRice(options.template, options.mealSlot));

  if (needsRiceCatalog && !hasRiceTag) {
    expanded.push("Rice");
  }

  return expanded;
}

export function dishMatchesUserIngredient(dishName: string, ingredient: string): boolean {
  const name = dishName.toLowerCase();
  const needle = ingredient.toLowerCase().trim();
  if (!needle) return false;
  return name.includes(needle);
}

export function filterMixedRiceForIngredients<T extends { name: string }>(
  dishes: T[],
  ingredients: string[]
): T[] {
  const needles = ingredients
    .map((ing) => ing.trim())
    .filter((ing) => ing && !STAPLE_ONLY_INGREDIENTS.has(ing.toLowerCase()));

  if (needles.length === 0) return dishes;

  const matched = dishes.filter((dish) =>
    needles.some((ingredient) => dishMatchesUserIngredient(dish.name, ingredient))
  );

  return matched.length > 0 ? matched : dishes;
}

import { dishMatchesCategoryFilter } from "./mealTemplates";

export function filterDishesByCategory<T extends { dish_category?: string | null; dish_type?: string | null; name: string }>(
  dishes: T[],
  category?: MealGroup | string
): T[] {
  if (!category) return dishes;
  return dishes.filter((dish) => dishMatchesCategoryFilter(dish, category));
}
