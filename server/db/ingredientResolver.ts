export {
  damerauLevenshtein,
  fuzzyScore,
} from "../../shared/damerauLevenshtein";
export {
  INGREDIENT_CATALOG,
  normalizeAlias,
  type IngredientEntry,
  type IngredientSearchResult,
} from "../../shared/ingredientCatalog";
export {
  searchIngredients,
  resolveIngredient,
  resolveToCanonical,
  resolveIngredientList,
  getCatalogEntry,
} from "../../shared/ingredientSearch";
