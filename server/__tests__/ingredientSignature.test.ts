import { describe, it, expect } from "vitest";
import { buildIngredientSignature, normalizeIngredient } from "../db/ingredientSignature";

describe("normalizeIngredient", () => {
  it("lowercases and trims", () => {
    expect(normalizeIngredient("  Brinjal  ")).toBe("brinjal");
  });
});

describe("buildIngredientSignature", () => {
  it("sorts and joins ingredients", () => {
    expect(buildIngredientSignature(["Potato", "Brinjal"])).toBe("eggplant|potato");
  });

  it("excludes rice", () => {
    expect(buildIngredientSignature(["Rice", "Brinjal", "Potato"])).toBe("eggplant|potato");
  });

  it("deduplicates via normalization and alias resolution", () => {
    expect(buildIngredientSignature(["brinjal", "Eggplant"])).toBe("eggplant");
  });

  it("returns empty string for rice-only input", () => {
    expect(buildIngredientSignature(["Rice"])).toBe("");
  });
});
