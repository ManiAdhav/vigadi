/**
 * What actually went into a dish that was eaten.
 *
 * "Sambar" is not one dish. The same cook makes it with carrot one day and
 * chow chow the next, so the ingredients belong to the log entry, never to the
 * dish. Every entry records that day's version.
 *
 * Names are resolved against the 110-ingredient catalog where possible, because
 * a canonical name is what later lets two people's sambar be recognised as the
 * same thing and what nutrition data will eventually join on. Anything the
 * catalog does not know — tamarind, coconut, sambar powder — is kept exactly as
 * typed and flagged, rather than dropped or forced onto a wrong match.
 */

import { normalizeAlias } from "./ingredientCatalog";
import { searchIngredients } from "./ingredientSearch";

export interface LoggedIngredient {
  /** Exactly what was typed or tapped. Never rewritten. */
  raw: string;
  /** Catalog name when confident, otherwise the tidied raw text. */
  canonical: string;
  /** false when the catalog has no entry for it. */
  matched: boolean;
}

/** What the client sends. `canonical` is set only when a suggestion was tapped. */
export interface LoggedIngredientInput {
  raw: string;
  canonical?: string | null;
}

/** A plate has a handful of ingredients, not a hundred. Guards against junk. */
export const MAX_LOGGED_INGREDIENTS = 24;

/**
 * A short typed word matches far too much by substring — "oil" is inside
 * "parboiled rice". Prefix matches are only trusted once enough has been typed
 * to mean something.
 */
const MIN_TRUSTED_PREFIX = 4;

function tidy(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/** True only when the catalog holds this exact name or alias. */
function isCatalogName(name: string): boolean {
  return searchIngredients(name, 1)[0]?.matchType === "exact";
}

/**
 * Deliberately stricter than `resolveIngredient`: contains- and fuzzy-matches
 * are refused. A wrong confident match ("oil" filed as parboiled rice) is worse
 * than an honest unmatched one, because it silently corrupts the diary.
 */
function resolveTyped(raw: string): { canonical: string; matched: boolean } {
  const hit = searchIngredients(raw, 1)[0];
  const trustworthy =
    hit &&
    (hit.matchType === "exact" ||
      (hit.matchType === "prefix" && normalizeAlias(raw).length >= MIN_TRUSTED_PREFIX));
  return trustworthy
    ? { canonical: hit.canonical, matched: true }
    : { canonical: tidy(raw), matched: false };
}

/** Returns null for blank input so a stray Enter records nothing. */
export function resolveLoggedIngredient(
  input: LoggedIngredientInput | string
): LoggedIngredient | null {
  const source = typeof input === "string" ? { raw: input } : input;
  const raw = (source.raw ?? "").trim().replace(/\s+/g, " ");
  if (!raw) return null;

  // A tapped suggestion already knows its catalog name — but verify it, since
  // this also runs on whatever a client posts.
  const picked = (source.canonical ?? "").trim();
  if (picked && isCatalogName(picked)) {
    return { raw, canonical: searchIngredients(picked, 1)[0].canonical, matched: true };
  }

  const { canonical, matched } = resolveTyped(raw);
  return { raw, canonical, matched };
}

/** Trims, drops blanks, removes repeats of the same ingredient, and caps length. */
export function cleanLoggedIngredients(
  inputs: (LoggedIngredientInput | string)[] | null | undefined
): LoggedIngredient[] {
  if (!Array.isArray(inputs)) return [];
  const seen = new Set<string>();
  const out: LoggedIngredient[] = [];
  for (const input of inputs) {
    const resolved = resolveLoggedIngredient(input);
    if (!resolved) continue;
    const key = normalizeAlias(resolved.canonical);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(resolved);
    if (out.length >= MAX_LOGGED_INGREDIENTS) break;
  }
  return out;
}

/**
 * Order-independent key for "the same dish made the same way", used to match one
 * cook's version against another's. Built from canonical names so carrot typed
 * as "carrot" and tapped as "Carrot" land on the same key.
 */
export function buildLoggedIngredientSignature(list: LoggedIngredient[]): string {
  return [...new Set(list.map((i) => normalizeAlias(i.canonical)).filter(Boolean))]
    .sort()
    .join("|");
}

/** "Carrot, French beans, Chayote" — for reading back on the diary. */
export function formatLoggedIngredients(list: LoggedIngredient[]): string {
  return list.map((i) => i.canonical).join(", ");
}

/** Ingredients the catalog is missing, so gaps can be fed back into it later. */
export function unmatchedIngredients(list: LoggedIngredient[]): string[] {
  return list.filter((i) => !i.matched).map((i) => i.canonical);
}

/** Tolerates rows written before this feature, and anything a stale client sends. */
export function parseLoggedIngredients(value: unknown): LoggedIngredient[] {
  if (!Array.isArray(value)) return [];
  const out: LoggedIngredient[] = [];
  for (const entry of value) {
    if (typeof entry === "string") {
      const resolved = resolveLoggedIngredient(entry);
      if (resolved) out.push(resolved);
      continue;
    }
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const raw = typeof row.raw === "string" ? row.raw : "";
    const canonical = typeof row.canonical === "string" ? row.canonical : raw;
    if (!canonical.trim()) continue;
    out.push({
      raw: raw.trim() || canonical.trim(),
      canonical: canonical.trim(),
      matched: row.matched === true,
    });
  }
  return out;
}
