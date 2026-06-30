import { describe, it, expect } from "vitest";
import { buildIngredientSignature, normalizeIngredient } from "../db/ingredientSignature";

describe("normalizeIngredient", () => {
  it("lowercases and trims", () => {
    expect(normalizeIngredient("  Brinjal  ")).toBe("brinjal");
  });
});

describe("buildIngredientSignature", () => {
  it("sorts and joins ingredients", () => {
    expect(buildIngredientSignature(["Potato", "Brinjal"])).toBe("brinjal|potato");
  });

  it("excludes rice", () => {
    expect(buildIngredientSignature(["Rice", "Brinjal", "Potato"])).toBe("brinjal|potato");
  });

  it("deduplicates via normalization and alias resolution", () => {
    expect(buildIngredientSignature(["brinjal", "Brinjal"])).toBe("brinjal");
  });

  it("returns empty string for rice-only input", () => {
    expect(buildIngredientSignature(["Rice"])).toBe("");
  });
});
