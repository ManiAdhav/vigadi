import { describe, it, expect } from "vitest";
import type { DishRow } from "../db/catalog";
import {
  spiceScore,
  getConsistency,
  isProteinDish,
  pickedIngredientsIncludeProtein,
  allowsIngredientReuse,
  scoreComboBalance,
  ARCHETYPES,
  anchorSignature,
  getEligibleArchetypes,
  buildBalanceRationale,
  shouldSkipPlainRiceStaple,
} from "../comboBalance";

function dish(partial: Partial<DishRow> & Pick<DishRow, "id" | "name">): DishRow {
  return {
    id: partial.id,
    ingredient_id: partial.ingredient_id ?? partial.id,
    name: partial.name,
    dish_group: partial.dish_group ?? null,
    dish_category: partial.dish_category ?? null,
    consistency: partial.consistency ?? null,
    base_tags: null,
    accompaniments: null,
    english_alias: null,
    youtube_url: null,
    youtube_video_id: null,
    dish_type: null,
    spice_level: partial.spice_level ?? null,
    main_ingredients: null,
    pairs_with: null,
    description: null,
    channel_name: null,
    discovered_at: "2026-01-01",
    source: "test",
    ingredient_name: partial.ingredient_name,
  };
}

describe("spiceScore", () => {
  it("maps spice levels to numeric scores", () => {
    expect(spiceScore(dish({ id: 1, name: "A", spice_level: "mild" }))).toBe(1);
    expect(spiceScore(dish({ id: 2, name: "B", spice_level: "medium" }))).toBe(2);
    expect(spiceScore(dish({ id: 3, name: "C", spice_level: "spicy" }))).toBe(3);
    expect(spiceScore(dish({ id: 4, name: "D", spice_level: "very_spicy" }))).toBe(4);
  });
});

describe("getConsistency", () => {
  it("uses the consistency column when present", () => {
    expect(getConsistency(dish({ id: 1, name: "X", consistency: "crisp" }))).toBe("crisp");
  });

  it("infers liquid from kuzhambu keywords when column is null", () => {
    expect(
      getConsistency(dish({ id: 1, name: "Meen Kuzhambu", dish_category: "kuzhambu" }))
    ).toBe("liquid");
  });

  it("infers semi_liquid from kootu keywords when column is null", () => {
    expect(getConsistency(dish({ id: 1, name: "Podalangai Kootu" }))).toBe("semi_liquid");
  });

  it("infers dry from poriyal keywords when column is null", () => {
    expect(getConsistency(dish({ id: 1, name: "Cabbage Poriyal" }))).toBe("dry");
  });

  it("defaults to semi_liquid when no signal", () => {
    expect(getConsistency(dish({ id: 1, name: "Mystery Dish" }))).toBe("semi_liquid");
  });
});

describe("acceptance 1: spicy anchor prefers mild sides (B1)", () => {
  const spicyFishCurry = dish({
    id: 1,
    name: "Meen Kuzhambu",
    ingredient_name: "Fish",
    spice_level: "spicy",
    consistency: "liquid",
    dish_group: "Gravy",
  });
  const mildCabbage = dish({
    id: 2,
    name: "Cabbage Poriyal",
    ingredient_name: "Cabbage",
    spice_level: "mild",
    consistency: "dry",
    dish_group: "Side",
  });
  const mildBeans = dish({
    id: 3,
    name: "Beans Poriyal",
    ingredient_name: "French beans",
    spice_level: "medium",
    consistency: "dry",
    dish_group: "Side",
  });
  const spicyPotato = dish({
    id: 4,
    name: "Potato Masala",
    ingredient_name: "Potato",
    spice_level: "spicy",
    consistency: "semi_liquid",
    dish_group: "Side",
  });

  it("scores mild sides higher than a second spicy side", () => {
    const balanced = scoreComboBalance(spicyFishCurry, [mildCabbage, mildBeans]);
    const unbalanced = scoreComboBalance(spicyFishCurry, [mildCabbage, spicyPotato]);
    expect(balanced).toBeGreaterThan(unbalanced);
  });
});

describe("acceptance 2: mild kootu anchor prefers spicy dry side (B1)", () => {
  const mildKootu = dish({
    id: 1,
    name: "Podalangai Kootu",
    ingredient_name: "Snake gourd",
    spice_level: "mild",
    consistency: "semi_liquid",
    dish_group: "Curry",
  });
  const spicyFishFry = dish({
    id: 2,
    name: "Meen Varuval",
    ingredient_name: "Fish",
    spice_level: "spicy",
    consistency: "dry",
    dish_group: "Side",
  });
  const mediumBeans = dish({
    id: 3,
    name: "Beans Poriyal",
    ingredient_name: "French beans",
    spice_level: "medium",
    consistency: "dry",
    dish_group: "Side",
  });
  const mildCarrot = dish({
    id: 4,
    name: "Carrot Poriyal",
    ingredient_name: "Carrot",
    spice_level: "mild",
    consistency: "dry",
    dish_group: "Side",
  });

  it("prefers at least one spicy side over all-mild sides", () => {
    const withSpicy = scoreComboBalance(mildKootu, [spicyFishFry, mediumBeans]);
    const allMild = scoreComboBalance(mildKootu, [mildCarrot, mediumBeans]);
    expect(withSpicy).toBeGreaterThan(allMild);
  });
});

describe("acceptance 3: liquid anchor prefers dry/crisp side (B2)", () => {
  const liquidAnchor = dish({
    id: 1,
    name: "Kara Kuzhambu",
    spice_level: "spicy",
    consistency: "liquid",
    dish_group: "Gravy",
  });
  const drySide = dish({
    id: 2,
    name: "Cauliflower 65",
    spice_level: "mild",
    consistency: "crisp",
    dish_group: "Side",
  });
  const liquidSide = dish({
    id: 3,
    name: "Sambar",
    spice_level: "mild",
    consistency: "liquid",
    dish_group: "Gravy",
  });
  const mildDry = dish({
    id: 4,
    name: "Beans Poriyal",
    spice_level: "mild",
    consistency: "dry",
    dish_group: "Side",
  });

  it("scores dry/crisp side higher than all-liquid sides", () => {
    const balanced = scoreComboBalance(liquidAnchor, [drySide, mildDry]);
    const allLiquid = scoreComboBalance(liquidAnchor, [liquidSide, mildDry]);
    expect(balanced).toBeGreaterThan(allLiquid);
  });
});

describe("acceptance 4: protein ingredient reuse exception (B3)", () => {
  const fishCurry = dish({
    id: 1,
    name: "Meen Kuzhambu",
    ingredient_name: "Fish",
    spice_level: "spicy",
    consistency: "liquid",
  });
  const fishFry = dish({
    id: 2,
    name: "Meen Varuval",
    ingredient_name: "Fish",
    spice_level: "spicy",
    consistency: "dry",
  });
  const brinjalCurry = dish({
    id: 3,
    name: "Brinjal Curry",
    ingredient_name: "Brinjal",
    spice_level: "medium",
    consistency: "liquid",
  });
  const brinjalPoriyal = dish({
    id: 4,
    name: "Brinjal Poriyal",
    ingredient_name: "Brinjal",
    spice_level: "mild",
    consistency: "dry",
  });

  it("allows same protein ingredient reuse", () => {
    expect(isProteinDish(fishCurry)).toBe(true);
    expect(isProteinDish(fishFry)).toBe(true);
    expect(allowsIngredientReuse(fishCurry, fishFry)).toBe(true);
  });

  it("blocks same non-protein ingredient reuse", () => {
    expect(isProteinDish(brinjalCurry)).toBe(false);
    expect(allowsIngredientReuse(brinjalCurry, brinjalPoriyal)).toBe(false);
  });
});

describe("acceptance 5: archetype signatures are distinct", () => {
  const anchors = {
    A: dish({
      id: 1,
      name: "Meen Kuzhambu",
      spice_level: "spicy",
      consistency: "liquid",
      dish_group: "Gravy",
    }),
    B: dish({
      id: 2,
      name: "Podalangai Kootu",
      spice_level: "mild",
      consistency: "semi_liquid",
      dish_group: "Curry",
    }),
    C: dish({
      id: 3,
      name: "Sambar",
      spice_level: "medium",
      consistency: "liquid",
      dish_group: "Gravy",
      dish_category: "sambar",
    }),
    D: dish({
      id: 4,
      name: "Lemon Rice",
      spice_level: "mild",
      consistency: "dry",
      dish_group: "Rice",
    }),
    E: dish({
      id: 5,
      name: "Chicken 65",
      ingredient_name: "Chicken",
      spice_level: "spicy",
      consistency: "dry",
      dish_group: "Side",
    }),
  };

  it("each archetype produces a unique signature for its representative anchor", () => {
    const signatures = ARCHETYPES.map((a) => a.signature(anchors[a.id as keyof typeof anchors]));
    const keys = signatures.map((s) => `${s.consistencyBand}:${s.spiceBand}`);
    expect(new Set(keys).size).toBe(ARCHETYPES.length);
  });

  it("anchorSignature matches archetype signature helper", () => {
    for (const archetype of ARCHETYPES) {
      const anchor = anchors[archetype.id as keyof typeof anchors];
      expect(archetype.signature(anchor)).toEqual(anchorSignature(anchor));
    }
  });
});

describe("acceptance 6: archetype E is protein-gated", () => {
  it("includes E only when picked ingredients include protein", () => {
    const withoutProtein = getEligibleArchetypes(["Cabbage", "Potato"]);
    const withProtein = getEligibleArchetypes(["Fish", "Cabbage"]);

    expect(withoutProtein.map((a) => a.id)).not.toContain("E");
    expect(withProtein.map((a) => a.id)).toContain("E");
  });

  it("pickedIngredientsIncludeProtein detects catalog protein entries", () => {
    expect(pickedIngredientsIncludeProtein(["Cabbage"])).toBe(false);
    expect(pickedIngredientsIncludeProtein(["Fish", "meen"])).toBe(true);
  });
});

describe("acceptance 7: variety rice balance helpers", () => {
  const lemonRice = dish({
    id: 1,
    name: "Elumichai Sadam",
    spice_level: "mild",
    consistency: "dry",
    dish_group: "Rice",
  });
  const kootuSide = dish({
    id: 2,
    name: "Sorakkai Kootu",
    spice_level: "medium",
    consistency: "semi_liquid",
    dish_group: "Side",
  });
  const dryPoriyal = dish({
    id: 3,
    name: "Carrot Poriyal",
    spice_level: "mild",
    consistency: "dry",
    dish_group: "Side",
  });

  it("prefers semi_liquid side for dry rice anchor", () => {
    const withKootu = scoreComboBalance(lemonRice, [kootuSide]);
    const allDry = scoreComboBalance(lemonRice, [dryPoriyal]);
    expect(withKootu).toBeGreaterThan(allDry);
  });

  it("skips plain rice staple when anchor is Rice group", () => {
    expect(shouldSkipPlainRiceStaple(lemonRice)).toBe(true);
    expect(
      shouldSkipPlainRiceStaple(
        dish({ id: 9, name: "Sambar", dish_group: "Gravy", consistency: "liquid" })
      )
    ).toBe(false);
  });
});

describe("buildBalanceRationale", () => {
  it("describes spice balance in plain English", () => {
    const anchor = dish({
      id: 1,
      name: "Meen Kuzhambu",
      ingredient_name: "Fish",
      spice_level: "spicy",
      consistency: "liquid",
    });
    const sides = [
      dish({
        id: 2,
        name: "Cabbage Poriyal",
        spice_level: "mild",
        consistency: "dry",
      }),
      dish({
        id: 3,
        name: "Beans Poriyal",
        spice_level: "medium",
        consistency: "dry",
      }),
    ];
    const rationale = buildBalanceRationale(anchor, sides);
    expect(rationale.toLowerCase()).toContain("spicy");
    expect(rationale.toLowerCase()).toContain("mild");
    expect(rationale.toLowerCase()).toContain("balanced");
  });
});
