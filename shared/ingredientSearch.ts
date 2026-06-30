import { fuzzyScore } from "./damerauLevenshtein";
import {
  INGREDIENT_CATALOG,
  normalizeAlias,
  type IngredientEntry,
  type IngredientSearchResult,
} from "./ingredientCatalog";

interface AliasRow {
  ingredientId: string;
  alias: string;
  normalized: string;
}

const catalogById = new Map<string, IngredientEntry>(
  INGREDIENT_CATALOG.map((e) => [e.id, e])
);

const aliasIndex: AliasRow[] = [];

for (const entry of INGREDIENT_CATALOG) {
  const variants = [
    entry.canonical,
    entry.transliteration,
    entry.tamil,
    ...entry.aliases,
  ].filter(Boolean) as string[];

  for (const alias of variants) {
    aliasIndex.push({
      ingredientId: entry.id,
      alias,
      normalized: normalizeAlias(alias),
    });
  }
}

function toResult(
  entry: IngredientEntry,
  matchedAlias: string,
  matchType: IngredientSearchResult["matchType"],
  score: number
): IngredientSearchResult {
  return {
    id: entry.id,
    canonical: entry.canonical,
    tamil: entry.tamil,
    transliteration: entry.transliteration,
    matchedAlias,
    matchType,
    score,
  };
}

export function searchIngredients(query: string, limit = 8): IngredientSearchResult[] {
  const q = normalizeAlias(query);
  if (!q) return [];

  const seen = new Set<string>();
  const results: IngredientSearchResult[] = [];

  const push = (result: IngredientSearchResult) => {
    if (seen.has(result.id)) return;
    seen.add(result.id);
    results.push(result);
  };

  // 1. Exact alias match
  for (const row of aliasIndex) {
    if (row.normalized === q) {
      const entry = catalogById.get(row.ingredientId)!;
      push(toResult(entry, row.alias, "exact", 1));
    }
  }

  // 2. Prefix match
  for (const row of aliasIndex) {
    if (row.normalized.startsWith(q) && row.normalized !== q) {
      const entry = catalogById.get(row.ingredientId)!;
      push(toResult(entry, row.alias, "prefix", 0.95));
    }
  }

  // 3. Contains match
  for (const row of aliasIndex) {
    if (row.normalized.includes(q) && !row.normalized.startsWith(q)) {
      const entry = catalogById.get(row.ingredientId)!;
      push(toResult(entry, row.alias, "contains", 0.85));
    }
  }

  // 4. Fuzzy fallback (Damerau-Levenshtein)
  if (results.length < limit) {
    const fuzzyCandidates: IngredientSearchResult[] = [];
    for (const row of aliasIndex) {
      if (seen.has(row.ingredientId)) continue;
      const score = fuzzyScore(q, row.normalized);
      if (score > 0.6) {
        const entry = catalogById.get(row.ingredientId)!;
        fuzzyCandidates.push(toResult(entry, row.alias, "fuzzy", score));
      }
    }
    fuzzyCandidates.sort((a, b) => b.score - a.score);
    for (const c of fuzzyCandidates) push(c);
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function resolveIngredient(input: string): IngredientSearchResult | null {
  const q = normalizeAlias(input);
  if (!q) return null;

  const exact = searchIngredients(q, 1).find((r) => r.matchType === "exact");
  if (exact) return exact;

  const fuzzy = searchIngredients(q, 1);
  return fuzzy[0] ?? null;
}

export function resolveToCanonical(input: string): string {
  const resolved = resolveIngredient(input);
  return resolved?.canonical ?? input.trim().charAt(0).toUpperCase() + input.trim().slice(1);
}

export function resolveIngredientList(inputs: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of inputs) {
    const canonical = resolveToCanonical(raw);
    const key = normalizeAlias(canonical);
    if (key && key !== "rice" && !seen.has(key)) {
      seen.add(key);
      out.push(canonical);
    }
  }
  return out;
}

export function getCatalogEntry(id: string): IngredientEntry | undefined {
  return catalogById.get(id);
}

export { INGREDIENT_CATALOG, catalogById, aliasIndex };
