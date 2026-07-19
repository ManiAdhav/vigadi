import { describe, it, expect } from "vitest";
import {
  resolveMealGroup,
  resolveDishType,
  resolveStapleForCombo,
  DISH_PICKER_PILLS,
} from "../../shared/mealTemplates";

describe("DISH_PICKER_PILLS", () => {
  const labels = DISH_PICKER_PILLS.map((p) => p.label);

  it("is a flat list of group and category pills", () => {
    for (const group of ["Rice", "Gravy", "Side"]) {
      expect(labels).toContain(group);
    }
    for (const category of ["Plain Rice", "Mixed Rice", "Kulambu", "Curry", "Poriyal", "Fry"]) {
      expect(labels).toContain(category);
    }
  });

  it("excludes individual dishes like Sambar", () => {
    expect(labels).not.toContain("Sambar");
    expect(DISH_PICKER_PILLS.some((p) => p.slot.dish_type === "sambar")).toBe(false);
  });

  it("group pills carry no dish_type (any dish in the group)", () => {
    const rice = DISH_PICKER_PILLS.find((p) => p.label === "Rice");
    expect(rice?.slot).toMatchObject({ category: "rice", count: 1 });
    expect(rice?.slot.dish_type).toBeUndefined();
  });
});

describe("resolveDishType", () => {
  it("classifies carrot rice as mixed_rice", () => {
    expect(resolveDishType("side", "Carrot Rice")).toBe("mixed_rice");
  });

  it("classifies tomato rice as mixed_rice", () => {
    expect(resolveDishType("mixed_rice", "Tomato Rice")).toBe("mixed_rice");
  });
});

describe("resolveMealGroup", () => {
  it("maps mixed_rice dish type to rice group", () => {
    expect(resolveMealGroup("mixed_rice", "Carrot Rice")).toBe("rice");
  });

  it("maps poriyal dish type to side group", () => {
    expect(resolveMealGroup("poriyal", "Carrot Poriyal")).toBe("side");
  });

  it("maps breakfast dish type to tiffin group", () => {
    expect(resolveMealGroup("breakfast", "Rava Upma")).toBe("tiffin");
  });

  it("maps Ven Pongal to tiffin group", () => {
    expect(resolveMealGroup("side", "Ven Pongal")).toBe("tiffin");
  });
});

describe("resolveStapleForCombo", () => {
  it("uses Poori when a dish base_tags include poori but not rice", () => {
    expect(
      resolveStapleForCombo([{ baseTags: ["poori"] }], "Rice")
    ).toBe("Poori");
  });

  it("keeps template staple for rice meals", () => {
    expect(
      resolveStapleForCombo([{ baseTags: ["rice", "chapati"] }], "Rice")
    ).toBe("Rice");
  });

  it("supports legacy pairsWith", () => {
    expect(
      resolveStapleForCombo([{ pairsWith: ["Poori"] }], "Rice")
    ).toBe("Poori");
  });
});
