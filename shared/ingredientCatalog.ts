import catalogData from "./ingredients.json";

export type IngredientCategory =
  | "vegetable"
  | "protein"
  | "legume"
  | "herb"
  | "grain"
  | "flour";

export interface IngredientEntry {
  id: string;
  canonical: string;
  tamil?: string;
  transliteration?: string;
  aliases: string[];
  category: IngredientCategory;
}

/** Offline South Indian ingredient catalog (from shared/ingredients.json). */
export const INGREDIENT_CATALOG: IngredientEntry[] = catalogData as IngredientEntry[];

export function normalizeAlias(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

export interface IngredientSearchResult {
  id: string;
  canonical: string;
  tamil?: string;
  transliteration?: string;
  matchedAlias: string;
  matchType: "exact" | "prefix" | "contains" | "fuzzy";
  score: number;
}
