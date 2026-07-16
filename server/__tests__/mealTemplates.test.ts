import { describe, it, expect } from "vitest";
import { resolveMealGroup, resolveDishType } from "../../shared/mealTemplates";

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
});
