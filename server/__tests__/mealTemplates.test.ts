import { describe, it, expect } from "vitest";
import { resolveDishCategory } from "../../shared/mealTemplates";

describe("resolveDishCategory", () => {
  it("classifies carrot rice as mixed_rice", () => {
    expect(resolveDishCategory("side", "Carrot Rice")).toBe("mixed_rice");
  });

  it("classifies tomato rice as mixed_rice", () => {
    expect(resolveDishCategory("mixed_rice", "Tomato Rice")).toBe("mixed_rice");
  });
});
