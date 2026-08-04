import { describe, expect, it } from "vitest";
import {
  DEFAULT_PREFERENCES,
  parsePreferences,
  preferenceFallbackTemplate,
  preferenceRulesDescription,
  preferenceSummaryText,
} from "../../shared/preferences";

describe("parsePreferences", () => {
  it("defaults to veg_egg / balanced when nothing is stored yet", () => {
    // This IS Mani's own example (veg and protein equally) — the fallback must
    // behave correctly before anyone ever opens the Preferences section.
    expect(parsePreferences(undefined)).toEqual(DEFAULT_PREFERENCES);
    expect(parsePreferences(null)).toEqual(DEFAULT_PREFERENCES);
    expect(parsePreferences({})).toEqual(DEFAULT_PREFERENCES);
  });

  it("keeps a valid stored profile", () => {
    expect(parsePreferences({ diet: "veg", proteinEmphasis: "high" })).toEqual({
      diet: "veg",
      proteinEmphasis: "high",
    });
  });

  it("falls back to defaults for garbage values instead of crashing", () => {
    expect(parsePreferences({ diet: "carnivore", proteinEmphasis: "extreme" })).toEqual(
      DEFAULT_PREFERENCES
    );
    expect(parsePreferences("not an object")).toEqual(DEFAULT_PREFERENCES);
  });
});

describe("preferenceFallbackTemplate", () => {
  it("gives breakfast a tiffin + chutney skeleton, not the lunch-shaped rule", () => {
    // The bug this replaces: a hardcoded "1 Kulambu, 2 Sides" applied even at breakfast.
    const template = preferenceFallbackTemplate(DEFAULT_PREFERENCES, "breakfast");
    const categories = template.meals?.breakfast?.map((s) => s.category);
    expect(categories).toContain("tiffin");
    expect(categories).toContain("chutney");
    expect(categories).not.toContain("gravy");
  });

  it("gives lunch/dinner the rice + gravy + sides skeleton", () => {
    const template = preferenceFallbackTemplate(DEFAULT_PREFERENCES, "lunch");
    const categories = template.meals?.lunch?.map((s) => s.category);
    expect(categories).toContain("rice");
    expect(categories).toContain("gravy");
    expect(categories).toContain("side");
  });

  it("adds no protein side when emphasis is light", () => {
    const template = preferenceFallbackTemplate({ diet: "veg_egg", proteinEmphasis: "light" }, "breakfast");
    const proteinSides = template.meals?.breakfast?.filter((s) => s.note?.includes("side")) ?? [];
    expect(proteinSides.length).toBe(0);
  });

  it("adds more protein-side count as emphasis rises", () => {
    const balanced = preferenceFallbackTemplate({ diet: "veg_egg", proteinEmphasis: "balanced" }, "breakfast");
    const high = preferenceFallbackTemplate({ diet: "veg_egg", proteinEmphasis: "high" }, "breakfast");
    const countOf = (t: typeof balanced) =>
      t.meals?.breakfast?.find((s) => s.note?.toLowerCase().includes("egg") || s.note?.toLowerCase().includes("protein"))
        ?.count ?? 0;
    expect(countOf(high)).toBeGreaterThan(countOf(balanced));
  });
});

describe("preferenceRulesDescription", () => {
  it("mentions eggs are allowed for veg_egg diet", () => {
    expect(preferenceRulesDescription({ diet: "veg_egg", proteinEmphasis: "balanced" }, "breakfast")).toMatch(
      /egg/i
    );
  });

  it("does not mention eggs for strict veg diet", () => {
    expect(preferenceRulesDescription({ diet: "veg", proteinEmphasis: "balanced" }, "breakfast")).not.toMatch(
      /egg/i
    );
  });
});

describe("preferenceSummaryText", () => {
  it("reads as a short plain-English line, not a technical dump", () => {
    const text = preferenceSummaryText({ diet: "veg_egg", proteinEmphasis: "balanced" });
    expect(text).toMatch(/vegetarian/i);
    expect(text).toMatch(/balanced/i);
    expect(text.length).toBeLessThan(80);
  });
});
