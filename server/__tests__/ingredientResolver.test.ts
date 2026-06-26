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
  it("finds exact alias brinjal → Eggplant", () => {
    const results = searchIngredients("brinjal");
    expect(results[0]?.canonical).toBe("Eggplant");
    expect(results[0]?.matchType).toBe("exact");
  });

  it("finds Tamil transliteration kathirikai", () => {
    const results = searchIngredients("kathirikai");
    expect(results[0]?.canonical).toBe("Eggplant");
  });

  it("finds green jaal → Okra", () => {
    const results = searchIngredients("green jaal");
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
  it("maps brinjal to Eggplant", () => {
    expect(resolveToCanonical("brinjal")).toBe("Eggplant");
  });

  it("maps baingan to Eggplant", () => {
    expect(resolveToCanonical("baingan")).toBe("Eggplant");
  });

  it("passes through unknown ingredients with capitalization", () => {
    expect(resolveToCanonical("custom veg")).toBe("Custom veg");
  });
});

describe("resolveIngredientList", () => {
  it("deduplicates aliases to one canonical", () => {
    expect(resolveIngredientList(["brinjal", "Eggplant", "baingan"])).toEqual(["Eggplant"]);
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
