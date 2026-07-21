import { describe, it, expect } from "vitest";
import type { DishRow } from "../db/catalog";
import type { MealTemplate } from "../../shared/mealTemplates";
import { getSlotsForMeal, shouldFillSlotAtMeal } from "../../shared/mealTemplates";
import type { TasteProfile } from "../db/users";
import {
  compareTemplateSlotCandidates,
  type TemplateSlotTasteProfile,
} from "../comboBalance";
import { fillTemplateSlotsFromCatalog } from "../mealTemplateBuilder";
import { scoreDishForTaste } from "../comboBuilder";

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

const emptyTaste: TasteProfile = {
  liked_dish_types: {},
  disliked_dish_types: {},
  liked_prep_styles: {},
  disliked_prep_styles: {},
  preferred_spice: null,
  liked_combos: [],
  disliked_combos: [],
  ingredient_preferences: {},
};

const lunchTemplate: MealTemplate = {
  id: "ac8-fixture",
  name: "Lunch plate",
  meals: {
    lunch: [
      { category: "gravy", count: 1 },
      { category: "side", count: 2 },
    ],
  },
};

function tasteOnlyCompare(
  a: DishRow,
  b: DishRow,
  _alreadyPicked: DishRow[],
  taste: TemplateSlotTasteProfile,
  variant: number
): number {
  const scoreTaste = (d: DishRow) =>
    scoreDishForTaste(d, taste as TasteProfile, d.ingredient_name ?? "");
  return (
    scoreTaste(b) - scoreTaste(a) + variant * ((a.id % 7) - (b.id % 7))
  );
}

function structureSignature(result: ReturnType<typeof fillTemplateSlotsFromCatalog>) {
  return {
    slotFills: result.slotFills.map((s) => ({
      category: s.category,
      requested: s.requested,
      filled: s.filled,
    })),
    unfilled: result.unfilled.map((u) => ({
      slotIndex: u.slotIndex,
      category: u.category,
    })),
  };
}

describe("AC8 template slot structure regression", () => {
  const catalog = [
    dish({
      id: 1,
      name: "Meen Kuzhambu",
      dish_group: "Gravy",
      dish_category: "Kuzhambu",
      consistency: "liquid",
      spice_level: "spicy",
      ingredient_name: "Fish",
    }),
    dish({
      id: 2,
      name: "Cabbage Poriyal",
      dish_group: "Side",
      dish_category: "Poriyal",
      consistency: "dry",
      spice_level: "mild",
      ingredient_name: "Cabbage",
    }),
    dish({
      id: 3,
      name: "Beans Poriyal",
      dish_group: "Side",
      dish_category: "Poriyal",
      consistency: "dry",
      spice_level: "mild",
      ingredient_name: "Beans",
    }),
    dish({
      id: 4,
      name: "Potato Masala",
      dish_group: "Side",
      dish_category: "Masala",
      consistency: "semi_liquid",
      spice_level: "spicy",
      ingredient_name: "Potato",
    }),
  ];

  const fillableSlots = getSlotsForMeal(lunchTemplate, "lunch").filter((slot) =>
    shouldFillSlotAtMeal(slot, "lunch")
  );

  it("keeps slot categories/counts and unfilled shape when balance breaks ties", () => {
    const withBalance = fillTemplateSlotsFromCatalog({
      catalogDishes: catalog,
      fillableSlots,
      taste: emptyTaste,
      ingredients: ["Fish", "Cabbage", "Beans", "Potato"],
    });
    const withoutBalance = fillTemplateSlotsFromCatalog({
      catalogDishes: catalog,
      fillableSlots,
      taste: emptyTaste,
      ingredients: ["Fish", "Cabbage", "Beans", "Potato"],
      compareCandidates: (a, b, alreadyPicked, taste, variant) =>
        tasteOnlyCompare(a, b, alreadyPicked, taste, variant),
    });

    expect(structureSignature(withBalance)).toEqual(structureSignature(withoutBalance));
    expect(withBalance.picked).toHaveLength(3);
    expect(withBalance.slotFills).toEqual([
      { slotIndex: 0, category: "gravy", requested: 1, filled: 1 },
      { slotIndex: 1, category: "side", requested: 2, filled: 2 },
    ]);
    expect(withBalance.unfilled).toEqual([]);
    expect(new Set(withBalance.picked.map((d) => d.id)).size).toBe(3);
  });
});

describe("multi-count slot balance within pickForSlot", () => {
  it("ranks second side pick using first sibling already picked in the slot", () => {
    const spicyAnchor = dish({
      id: 1,
      name: "Meen Kuzhambu",
      dish_group: "Gravy",
      consistency: "liquid",
      spice_level: "spicy",
      ingredient_name: "Fish",
    });
    const mildA = dish({
      id: 2,
      name: "Cabbage Poriyal",
      dish_group: "Side",
      consistency: "dry",
      spice_level: "mild",
      ingredient_name: "Cabbage",
    });
    const mildB = dish({
      id: 3,
      name: "Beans Poriyal",
      dish_group: "Side",
      consistency: "dry",
      spice_level: "mild",
      ingredient_name: "Beans",
    });
    const spicySide = dish({
      id: 4,
      name: "Potato Masala",
      dish_group: "Side",
      consistency: "semi_liquid",
      spice_level: "spicy",
      ingredient_name: "Potato",
    });

    const fillableSlots = [
      { category: "gravy" as const, count: 1 },
      { category: "side" as const, count: 2 },
    ];
    const result = fillTemplateSlotsFromCatalog({
      catalogDishes: [spicyAnchor, mildA, mildB, spicySide],
      fillableSlots,
      taste: emptyTaste,
      ingredients: ["Fish", "Cabbage", "Beans", "Potato"],
    });

    expect(result.picked).toHaveLength(3);
    expect(result.picked[0].id).toBe(1);
    expect(result.picked.slice(1).every((d) => d.spice_level === "mild")).toBe(true);
    expect(result.picked.some((d) => d.id === 4)).toBe(false);
  });

  it("uses compareTemplateSlotCandidates with cumulative alreadyPicked per pick", () => {
    const anchor = dish({
      id: 10,
      name: "Sambar",
      dish_group: "Gravy",
      consistency: "liquid",
      spice_level: "spicy",
      ingredient_name: "Toor dal",
    });
    const firstSide = dish({
      id: 20,
      name: "Carrot Poriyal",
      dish_group: "Side",
      consistency: "dry",
      spice_level: "mild",
      ingredient_name: "Carrot",
    });
    const secondMild = dish({
      id: 21,
      name: "Beans Poriyal",
      dish_group: "Side",
      consistency: "dry",
      spice_level: "mild",
      ingredient_name: "Beans",
    });
    const secondSpicy = dish({
      id: 22,
      name: "Potato Masala",
      dish_group: "Side",
      consistency: "semi_liquid",
      spice_level: "spicy",
      ingredient_name: "Potato",
    });

    const seenAlreadyPickedLengths: number[] = [];
    const trackingCompare: typeof compareTemplateSlotCandidates = (
      a,
      b,
      alreadyPicked,
      taste,
      variant,
      scoreTaste
    ) => {
      seenAlreadyPickedLengths.push(alreadyPicked.length);
      return compareTemplateSlotCandidates(
        a,
        b,
        alreadyPicked,
        taste,
        variant,
        scoreTaste
      );
    };

    fillTemplateSlotsFromCatalog({
      catalogDishes: [anchor, firstSide, secondMild, secondSpicy],
      fillableSlots: [
        { category: "gravy", count: 1 },
        { category: "side", count: 2 },
      ],
      taste: emptyTaste,
      ingredients: ["Toor dal", "Carrot", "Beans", "Potato"],
      compareCandidates: trackingCompare,
    });

    expect(Math.max(...seenAlreadyPickedLengths)).toBeGreaterThanOrEqual(2);
  });
});
