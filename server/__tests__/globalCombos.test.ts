import { describe, it, expect } from "vitest";
import { upsertGlobalCombo, getPopularCombos } from "../db/globalCombos";

const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)("globalCombos", () => {
  const signature = `test-${Date.now()}`;
  const dishIds = [999001, 999002, 999003];

  it("upserts and increments selection count", async () => {
    const id1 = await upsertGlobalCombo({
      ingredientSignature: signature,
      dishIds,
      comboName: "Test Plate",
      subComponents: ["A", "B", "Rice"],
      cityCode: null,
    });
    const id2 = await upsertGlobalCombo({
      ingredientSignature: signature,
      dishIds,
      comboName: "Test Plate",
      subComponents: ["A", "B", "Rice"],
      cityCode: null,
    });
    expect(id1).toBe(id2);

    const popular = await getPopularCombos({
      ingredientSignature: signature,
      cityCode: null,
      limit: 5,
    });
    expect(popular[0]?.selectionCount).toBeGreaterThanOrEqual(2);
  });
});
