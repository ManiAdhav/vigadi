import { resolveToCanonical } from "./ingredientResolver";

export function normalizeIngredient(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function buildIngredientSignature(ingredients: string[]): string {
  const normalized = [
    ...new Set(
      ingredients
        .map((name) => normalizeIngredient(resolveToCanonical(name)))
        .filter((i) => i && i !== "rice")
    ),
  ].sort();
  return normalized.join("|");
}
