import { normalizeAlias } from "./ingredientCatalog";

/**
 * Ingredients that are ALWAYS secondary — pantry/condiment items that everyone
 * keeps at home. They can never be a dish's primary ingredient, so they must
 * never gate a combo, never be suggested as an "unlock" hint, and never key a
 * dish during seeding.
 *
 * Note: contextually-primary ingredients (tomato, curry leaves, onion, garlic)
 * are intentionally NOT here — they can be the primary ingredient of signature
 * dishes (Tomato Chutney, Curry Leaves Rice, Onion Chutney), and gate only
 * those dishes via their keying.
 */
export const ALWAYS_SECONDARY_INGREDIENTS: ReadonlySet<string> = new Set(
  [
    "tamarind",
    "puli", // Tamil: புளி
    "salt",
    "uppu", // Tamil: உப்பு
    "water",
  ].map(normalizeAlias)
);

/** Matches a standalone "oil" token, e.g. "oil", "sesame oil", "coconut oil". */
const OIL_PATTERN = /(^|\s)oil(\s|$)/;

export function isAlwaysSecondary(name: string): boolean {
  const normalized = normalizeAlias(name ?? "");
  if (!normalized) return false;
  if (ALWAYS_SECONDARY_INGREDIENTS.has(normalized)) return true;
  return OIL_PATTERN.test(normalized);
}

export function stripAlwaysSecondary(names: string[]): string[] {
  return names.filter((name) => !isAlwaysSecondary(name));
}
