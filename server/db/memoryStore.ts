import { normalizeIngredient } from "./ingredientSignature";
import type { DishRow } from "./catalog";
import type { TasteProfile, UserProfileRow } from "./users";

const DEFAULT_TASTE: TasteProfile = {
  liked_dish_types: {},
  disliked_dish_types: {},
  liked_prep_styles: {},
  disliked_prep_styles: {},
  preferred_spice: null,
  liked_combos: [],
  disliked_combos: [],
  ingredient_preferences: {},
};

const ingredientsByNormalized = new Map<string, { id: number; name: string }>();
const dishes: DishRow[] = [];
const userProfiles = new Map<string, UserProfileRow>();

let nextIngredientId = 1;
let nextDishId = 1;

export function memoryUpsertIngredient(name: string): number {
  const normalized = normalizeIngredient(name);
  const display = name.trim().charAt(0).toUpperCase() + name.trim().slice(1);
  const existing = ingredientsByNormalized.get(normalized);
  if (existing) return existing.id;

  const id = nextIngredientId++;
  ingredientsByNormalized.set(normalized, { id, name: display });
  return id;
}

export function memoryInsertDish(dish: {
  ingredientId: number;
  name: string;
  youtubeUrl?: string;
  youtubeVideoId?: string;
  dishType?: string;
  spiceLevel?: string;
  mainIngredients?: string[];
  pairsWith?: string[];
  description?: string;
  channelName?: string;
  source?: string;
}): number | null {
  const ingredient = [...ingredientsByNormalized.values()].find((i) => i.id === dish.ingredientId);
  const duplicate = dishes.find(
    (d) => d.ingredient_id === dish.ingredientId && d.name.toLowerCase() === dish.name.toLowerCase()
  );
  if (duplicate) return duplicate.id;

  const id = nextDishId++;
  dishes.push({
    id,
    ingredient_id: dish.ingredientId,
    name: dish.name,
    youtube_url: dish.youtubeUrl ?? null,
    youtube_video_id: dish.youtubeVideoId ?? null,
    dish_type: dish.dishType ?? null,
    spice_level: dish.spiceLevel ?? null,
    main_ingredients: dish.mainIngredients ?? [],
    pairs_with: dish.pairsWith ?? ["Rice"],
    description: dish.description ?? null,
    channel_name: dish.channelName ?? null,
    discovered_at: new Date().toISOString(),
    source: dish.source ?? "offline_template",
    ingredient_name: ingredient?.name,
  });
  return id;
}

export function memoryGetDishesByIngredientNames(names: string[]): DishRow[] {
  const normalized = new Set(names.map(normalizeIngredient));
  return dishes.filter((d) => {
    const ing = [...ingredientsByNormalized.entries()].find(([, v]) => v.id === d.ingredient_id);
    return ing ? normalized.has(ing[0]) : false;
  });
}

export function memoryGetDishesForIngredient(ingredientName: string): DishRow[] {
  const normalized = normalizeIngredient(ingredientName);
  const ing = ingredientsByNormalized.get(normalized);
  if (!ing) return [];
  return dishes.filter((d) => d.ingredient_id === ing.id);
}

export function memoryGetDishCountForIngredient(ingredientName: string): number {
  return memoryGetDishesForIngredient(ingredientName).length;
}

export function memoryGetDishesByIds(ids: number[]): DishRow[] {
  const idSet = new Set(ids);
  return dishes.filter((d) => idSet.has(d.id));
}

export function memoryGetIngredientByName(name: string): { id: number; name: string } | undefined {
  const normalized = normalizeIngredient(name);
  return ingredientsByNormalized.get(normalized);
}

export function memoryGetDishById(id: number): DishRow | undefined {
  return dishes.find((d) => d.id === id);
}

export function memoryEnsureUserProfile(userId: string, username: string): void {
  const existing = userProfiles.get(userId);
  if (existing) {
    existing.username = username;
    return;
  }
  userProfiles.set(userId, {
    id: userId,
    username,
    combo_rules: "Tamil Nadu rules: 1 Kulambu, 2 Sides",
    taste_profile: { ...DEFAULT_TASTE },
    city_code: null,
  });
}

export function memoryGetUserProfile(userId: string): UserProfileRow | undefined {
  return userProfiles.get(userId);
}

export function memoryUpdateUserComboRules(userId: string, rules: string): void {
  memoryEnsureUserProfile(userId, "Guest");
  const profile = userProfiles.get(userId)!;
  profile.combo_rules = rules;
}

export function memoryGetTasteProfile(userId: string): TasteProfile {
  const profile = userProfiles.get(userId);
  if (!profile) return { ...DEFAULT_TASTE };
  if (typeof profile.taste_profile === "object") {
    return { ...DEFAULT_TASTE, ...profile.taste_profile };
  }
  return { ...DEFAULT_TASTE };
}

export function memorySaveTasteProfile(userId: string, taste: TasteProfile): void {
  memoryEnsureUserProfile(userId, "Guest");
  userProfiles.get(userId)!.taste_profile = taste;
}
