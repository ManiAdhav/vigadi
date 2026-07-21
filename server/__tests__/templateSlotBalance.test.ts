import { describe, it, expect } from "vitest";
import type { DishRow } from "../db/catalog";
import {
  findTemplateComboAnchor,
  scoreTemplateCandidateBalance,
  compareTemplateSlotCandidates,
  resolveTemplateComboStaple,
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

const emptyTaste = {
  liked_dish_types: {},
  disliked_dish_types: {},
  liked_prep_styles: {},
  disliked_prep_styles: {},
  preferred_spice: null,
  liked_combos: [],
  disliked_combos: [],
  ingredient_preferences: {},
};

describe("findTemplateComboAnchor", () => {
  const gravy = dish({
    id: 1,
    name: "Meen Kuzhambu",
    dish_group: "Gravy",
    consistency: "liquid",
    spice_level: "spicy",
  });
  const rice = dish({
    id: 2,
    name: "Lemon Rice",
    dish_group: "Rice",
    consistency: "dry",
    spice_level: "mild",
  });
  const side = dish({
    id: 3,
    name: "Carrot Poriyal",
    dish_group: "Side",
    consistency: "dry",
    spice_level: "mild",
  });

  it("returns null when nothing picked yet", () => {
    expect(findTemplateComboAnchor([])).toBeNull();
  });

  it("prefers gravy/curry over rice group", () => {
    expect(findTemplateComboAnchor([rice, gravy, side])).toBe(gravy);
  });

  it("uses rice group when no gravy/curry", () => {
    expect(findTemplateComboAnchor([rice, side])).toBe(rice);
  });
});

describe("scoreTemplateCandidateBalance", () => {
  const spicyAnchor = dish({
    id: 1,
    name: "Meen Kuzhambu",
    dish_group: "Gravy",
    consistency: "liquid",
    spice_level: "spicy",
  });
  const mildSide = dish({
    id: 2,
    name: "Cabbage Poriyal",
    dish_group: "Side",
    consistency: "dry",
    spice_level: "mild",
  });
  const spicySide = dish({
    id: 3,
    name: "Potato Masala",
    dish_group: "Side",
    consistency: "semi_liquid",
    spice_level: "spicy",
  });

  it("returns 0 when no anchor among already picked", () => {
    expect(scoreTemplateCandidateBalance(mildSide, [])).toBe(0);
  });

  it("scores higher when candidate improves spice see-saw", () => {
    const mildScore = scoreTemplateCandidateBalance(mildSide, [spicyAnchor]);
    const spicyScore = scoreTemplateCandidateBalance(spicySide, [spicyAnchor]);
    expect(mildScore).toBeGreaterThan(spicyScore);
  });
});

describe("compareTemplateSlotCandidates", () => {
  const spicyAnchor = dish({
    id: 1,
    name: "Meen Kuzhambu",
    dish_group: "Gravy",
    consistency: "liquid",
    spice_level: "spicy",
  });
  const mildSide = dish({
    id: 2,
    name: "Cabbage Poriyal",
    dish_group: "Side",
    consistency: "dry",
    spice_level: "mild",
    ingredient_name: "Cabbage",
  });
  const spicySide = dish({
    id: 3,
    name: "Potato Masala",
    dish_group: "Side",
    consistency: "semi_liquid",
    spice_level: "spicy",
    ingredient_name: "Potato",
  });

  it("breaks ties on balance when taste scores are equal", () => {
    const equalTaste = () => 0;
    const cmp = compareTemplateSlotCandidates(
      mildSide,
      spicySide,
      [spicyAnchor],
      emptyTaste,
      0,
      equalTaste
    );
    expect(cmp).toBeLessThan(0);
  });
});

describe("resolveTemplateComboStaple", () => {
  const lemonRice = dish({
    id: 1,
    name: "Lemon Rice",
    dish_group: "Rice",
    consistency: "dry",
  });
  const sambar = dish({
    id: 2,
    name: "Sambar",
    dish_group: "Gravy",
    consistency: "liquid",
  });

  it("drops plain Rice staple when variety rice is in the combo", () => {
    expect(resolveTemplateComboStaple([lemonRice], "Rice")).toBeNull();
  });

  it("keeps template staple when no variety rice dish", () => {
    expect(resolveTemplateComboStaple([sambar], "Rice")).toBe("Rice");
  });
});
