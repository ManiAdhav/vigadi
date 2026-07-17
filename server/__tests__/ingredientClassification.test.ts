import { describe, it, expect } from "vitest";
import {
  isAlwaysSecondary,
  stripAlwaysSecondary,
} from "../../shared/ingredientClassification";

describe("isAlwaysSecondary", () => {
  it("treats tamarind as always secondary (incl. Tamil alias)", () => {
    expect(isAlwaysSecondary("tamarind")).toBe(true);
    expect(isAlwaysSecondary("Tamarind")).toBe(true);
    expect(isAlwaysSecondary("puli")).toBe(true);
  });

  it("treats any oil, salt and water as always secondary", () => {
    expect(isAlwaysSecondary("oil")).toBe(true);
    expect(isAlwaysSecondary("Sesame oil")).toBe(true);
    expect(isAlwaysSecondary("gingelly oil")).toBe(true);
    expect(isAlwaysSecondary("Coconut oil")).toBe(true);
    expect(isAlwaysSecondary("salt")).toBe(true);
    expect(isAlwaysSecondary("water")).toBe(true);
  });

  it("does NOT treat contextually-primary ingredients as always secondary", () => {
    for (const name of ["tomato", "curry leaves", "onion", "garlic", "ginger"]) {
      expect(isAlwaysSecondary(name)).toBe(false);
    }
  });

  it("does NOT treat true primaries as secondary", () => {
    for (const name of ["chicken", "paneer", "fish", "carrot", "coconut"]) {
      expect(isAlwaysSecondary(name)).toBe(false);
    }
  });

  it("does not mistake words containing 'oil' (e.g. boil)", () => {
    expect(isAlwaysSecondary("boiled egg")).toBe(false);
  });

  it("handles blank input", () => {
    expect(isAlwaysSecondary("")).toBe(false);
    expect(isAlwaysSecondary("   ")).toBe(false);
  });
});

describe("stripAlwaysSecondary", () => {
  it("removes always-secondary ingredients, keeps the rest", () => {
    expect(
      stripAlwaysSecondary(["Chicken", "tamarind", "Tomato", "oil", "Carrot"])
    ).toEqual(["Chicken", "Tomato", "Carrot"]);
  });
});
