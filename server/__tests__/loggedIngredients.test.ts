import { describe, expect, it } from "vitest";
import {
  buildLoggedIngredientSignature,
  cleanLoggedIngredients,
  formatLoggedIngredients,
  parseLoggedIngredients,
  resolveLoggedIngredient,
  unmatchedIngredients,
  MAX_LOGGED_INGREDIENTS,
} from "../../shared/loggedIngredients";

describe("resolving a typed ingredient", () => {
  it("matches catalog names and their Tamil transliterations", () => {
    expect(resolveLoggedIngredient("carrot")).toEqual({
      raw: "carrot",
      canonical: "Carrot",
      matched: true,
    });
    // The whole point of her example: "chow chow" is Chayote in the catalog.
    expect(resolveLoggedIngredient("chow chow")?.canonical).toBe("Chayote");
    expect(resolveLoggedIngredient("chow chow")?.matched).toBe(true);
  });

  it("keeps an ingredient the catalog does not have, exactly as typed", () => {
    for (const missing of ["tamarind", "jaggery", "sambar powder"]) {
      const resolved = resolveLoggedIngredient(missing);
      expect(resolved?.matched).toBe(false);
      expect(resolved?.raw).toBe(missing);
    }
  });

  it("refuses a substring match rather than filing it under the wrong food", () => {
    // "oil" sits inside "parboiled rice". A confident wrong match would quietly
    // corrupt the diary, so this must come back unmatched.
    const resolved = resolveLoggedIngredient("oil");
    expect(resolved?.matched).toBe(false);
    expect(resolved?.canonical).toBe("Oil");
  });

  it("trusts a suggestion the user tapped", () => {
    const resolved = resolveLoggedIngredient({ raw: "chow chow", canonical: "Chayote" });
    expect(resolved).toEqual({ raw: "chow chow", canonical: "Chayote", matched: true });
  });

  it("does not trust a canonical name that is not in the catalog", () => {
    const resolved = resolveLoggedIngredient({ raw: "tamarind", canonical: "Tamarind" });
    expect(resolved?.matched).toBe(false);
  });

  it("records nothing for a blank entry", () => {
    expect(resolveLoggedIngredient("   ")).toBeNull();
    expect(resolveLoggedIngredient({ raw: "" })).toBeNull();
  });
});

describe("cleaning a list", () => {
  it("keeps her sambar exactly as she built it", () => {
    const list = cleanLoggedIngredients(["Carrot", "beans", "chow chow"]);
    expect(list.map((i) => i.canonical)).toEqual(["Carrot", "French beans", "Chayote"]);
    expect(list.every((i) => i.matched)).toBe(true);
  });

  it("drops blanks and the same ingredient entered twice", () => {
    const list = cleanLoggedIngredients(["Carrot", "  ", "carrot", "Tomato"]);
    expect(list.map((i) => i.canonical)).toEqual(["Carrot", "Tomato"]);
  });

  it("caps a runaway list", () => {
    const many = Array.from({ length: 60 }, (_, i) => `ingredient ${i}`);
    expect(cleanLoggedIngredients(many)).toHaveLength(MAX_LOGGED_INGREDIENTS);
  });

  it("returns an empty list for anything that is not a list", () => {
    expect(cleanLoggedIngredients(null)).toEqual([]);
    expect(cleanLoggedIngredients(undefined)).toEqual([]);
  });
});

describe("matching one cook's version against another's", () => {
  it("ignores the order the ingredients were added in", () => {
    const a = buildLoggedIngredientSignature(cleanLoggedIngredients(["Carrot", "beans", "chow chow"]));
    const b = buildLoggedIngredientSignature(cleanLoggedIngredients(["chow chow", "Carrot", "beans"]));
    expect(a).toBe(b);
  });

  it("treats a different set of vegetables as a different sambar", () => {
    const a = buildLoggedIngredientSignature(cleanLoggedIngredients(["Carrot", "beans"]));
    const b = buildLoggedIngredientSignature(cleanLoggedIngredients(["Carrot", "Tomato"]));
    expect(a).not.toBe(b);
  });

  it("still keys on ingredients the catalog is missing", () => {
    const sig = buildLoggedIngredientSignature(cleanLoggedIngredients(["tamarind", "Carrot"]));
    expect(sig).toBe("carrot|tamarind");
  });
});

describe("reading back", () => {
  it("reads as a plain sentence", () => {
    expect(formatLoggedIngredients(cleanLoggedIngredients(["Carrot", "chow chow"]))).toBe(
      "Carrot, Chayote"
    );
  });

  it("reports which ingredients the catalog is missing", () => {
    const list = cleanLoggedIngredients(["Carrot", "tamarind", "jaggery"]);
    expect(unmatchedIngredients(list)).toEqual(["Tamarind", "Jaggery"]);
  });
});

describe("reading rows written by older or stale clients", () => {
  it("treats a missing column as no ingredients", () => {
    expect(parseLoggedIngredients(null)).toEqual([]);
    expect(parseLoggedIngredients(undefined)).toEqual([]);
    expect(parseLoggedIngredients("Carrot")).toEqual([]);
  });

  it("accepts a plain list of names", () => {
    expect(parseLoggedIngredients(["carrot"])).toEqual([
      { raw: "carrot", canonical: "Carrot", matched: true },
    ]);
  });

  it("skips entries with no usable name", () => {
    expect(parseLoggedIngredients([{ raw: "  ", canonical: "" }, null, 7])).toEqual([]);
  });
});
