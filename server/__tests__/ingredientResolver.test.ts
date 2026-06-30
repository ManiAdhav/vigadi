import { describe, it, expect } from "vitest";
import { damerauLevenshtein, fuzzyScore } from "../../shared/damerauLevenshtein";
import {
  searchIngredients,
  resolveIngredient,
  resolveToCanonical,
  resolveIngredientList,
} from "../../shared/ingredientSearch";

describe("damerauLevenshtein", () => {
  it("returns 0 for identical strings", () => {
    expect(damerauLevenshtein("sorakkai", "sorakkai")).toBe(0);
  });

  it("handles single-char typo", () => {
    expect(damerauLevenshtein("sorakai", "sorakkai")).toBe(1);
  });

  it("handles transposition", () => {
    expect(damerauLevenshtein("kathiri", "kathriki")).toBeLessThanOrEqual(2);
  });
});

describe("fuzzyScore", () => {
  it("scores prefix matches highly", () => {
    expect(fuzzyScore("sor", "sorakkai")).toBe(1);
  });

  it("scores typo matches above zero", () => {
    expect(fuzzyScore("sorakai", "sorakkai")).toBeGreaterThan(0.6);
  });
});

describe("searchIngredients", () => {
  it("finds exact alias brinjal → Brinjal", () => {
    const results = searchIngredients("brinjal");
    expect(results[0]?.canonical).toBe("Brinjal");
    expect(results[0]?.matchType).toBe("exact");
  });

  it("finds Tamil transliteration kathirikai", () => {
    const results = searchIngredients("kathirikai");
    expect(results[0]?.canonical).toBe("Brinjal");
  });

  it("finds bhindi → Okra", () => {
    const results = searchIngredients("bhindi");
    expect(results[0]?.canonical).toBe("Okra");
  });

  it("fuzzy matches sorakai → Bottle gourd", () => {
    const results = searchIngredients("sorakai");
    expect(results.some((r) => r.canonical === "Bottle gourd")).toBe(true);
  });

  it("finds urulaikilangu → Potato", () => {
    const results = searchIngredients("urulaikilangu");
    expect(results[0]?.canonical).toBe("Potato");
  });

  it("returns empty for blank query", () => {
    expect(searchIngredients("")).toEqual([]);
  });
});

describe("resolveToCanonical", () => {
  it("maps brinjal to Brinjal", () => {
    expect(resolveToCanonical("brinjal")).toBe("Brinjal");
  });

  it("maps baingan to Brinjal", () => {
    expect(resolveToCanonical("baingan")).toBe("Brinjal");
  });

  it("maps eggplant to Eggplant", () => {
    expect(resolveToCanonical("eggplant")).toBe("Eggplant");
  });

  it("passes through unknown ingredients with capitalization", () => {
    expect(resolveToCanonical("custom veg")).toBe("Custom veg");
  });
});

describe("resolveIngredientList", () => {
  it("deduplicates aliases to one canonical", () => {
    expect(resolveIngredientList(["brinjal", "Brinjal", "baingan"])).toEqual(["Brinjal"]);
  });

  it("excludes rice", () => {
    expect(resolveIngredientList(["Rice", "Potato"])).toEqual(["Potato"]);
  });
});

describe("resolveIngredient", () => {
  it("returns exact match metadata", () => {
    const r = resolveIngredient("vendakkai");
    expect(r?.canonical).toBe("Okra");
    expect(r?.matchType).toBe("exact");
  });
});
