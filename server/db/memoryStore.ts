import { normalizeIngredient } from "./ingredientSignature";
import type { DishRow } from "./catalog";
import type { TasteProfile, UserProfileRow } from "./users";
import {
  DaySettings,
  DEFAULT_DAY_SETTINGS,
  MealTemplate,
} from "../../shared/mealTemplates";
import type { FoodPlate } from "../../shared/foodPlates";
import {
  createMealLogId,
  sortMealsByTime,
  type CleanMealLogItem,
  type DishVariant,
  type MealLogEntry,
  type MealLogType,
} from "../../shared/mealLogs";
import { buildLoggedIngredientSignature } from "../../shared/loggedIngredients";
import { DEFAULT_PREFERENCES, PreferenceProfile } from "../../shared/preferences";
import { dishNameMatchesQuery, dishSearchRank } from "../../shared/staples";

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
  dishGroup?: string;
  dishCategory?: string;
  consistency?: string;
  baseTags?: string[];
  accompaniments?: string[];
  englishAlias?: string;
  nameAliases?: string[];
  youtubeUrl?: string;
  youtubeVideoId?: string;
  spiceLevel?: string;
  mainIngredients?: string[];
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
    dish_group: dish.dishGroup ?? null,
    dish_category: dish.dishCategory ?? null,
    consistency: dish.consistency ?? null,
    base_tags: dish.baseTags ?? [],
    accompaniments: dish.accompaniments ?? [],
    english_alias: dish.englishAlias ?? null,
    name_aliases: dish.nameAliases ?? [],
    youtube_url: dish.youtubeUrl ?? null,
    youtube_video_id: dish.youtubeVideoId ?? null,
    dish_type: null,
    spice_level: dish.spiceLevel ?? null,
    main_ingredients: dish.mainIngredients ?? [],
    pairs_with: null,
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

export function memorySearchDishes(queryText: string, limit = 10): DishRow[] {
  const q = queryText.toLowerCase().trim();
  if (!q) return [];
  const searchable = (d: DishRow) => ({
    name: d.name,
    name_aliases: Array.isArray(d.name_aliases) ? (d.name_aliases as string[]) : [],
  });

  return dishes
    .filter(
      (d) =>
        dishNameMatchesQuery(searchable(d), q) ||
        d.ingredient_name?.toLowerCase().includes(q) ||
        d.dish_group?.toLowerCase().includes(q) ||
        d.dish_category?.toLowerCase().includes(q) ||
        d.english_alias?.toLowerCase().includes(q)
    )
    .sort((a, b) => {
      const rank = dishSearchRank(searchable(a), q) - dishSearchRank(searchable(b), q);
      if (rank !== 0) return rank;
      return a.name.localeCompare(b.name);
    })
    .slice(0, limit);
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
    meal_templates: [],
    food_plates: [],
    day_settings: { ...DEFAULT_DAY_SETTINGS },
    preferences: { ...DEFAULT_PREFERENCES },
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

export function memoryGetMealTemplates(userId: string): MealTemplate[] {
  memoryEnsureUserProfile(userId, "Guest");
  return userProfiles.get(userId)!.meal_templates ?? [];
}

export function memorySaveMealTemplates(userId: string, templates: MealTemplate[]): void {
  memoryEnsureUserProfile(userId, "Guest");
  userProfiles.get(userId)!.meal_templates = templates;
}

export function memoryGetDaySettings(userId: string): DaySettings {
  memoryEnsureUserProfile(userId, "Guest");
  return userProfiles.get(userId)!.day_settings ?? { ...DEFAULT_DAY_SETTINGS };
}

export function memorySaveDaySettings(userId: string, settings: DaySettings): void {
  memoryEnsureUserProfile(userId, "Guest");
  userProfiles.get(userId)!.day_settings = settings;
}

export function memoryGetFoodPlates(userId: string): FoodPlate[] {
  memoryEnsureUserProfile(userId, "Guest");
  return userProfiles.get(userId)!.food_plates ?? [];
}

export function memorySaveFoodPlates(userId: string, plates: FoodPlate[]): void {
  memoryEnsureUserProfile(userId, "Guest");
  userProfiles.get(userId)!.food_plates = plates;
}

const mealLogs = new Map<string, MealLogEntry[]>();
let nextMealLogItemId = 1;

function userMealLogs(userId: string): MealLogEntry[] {
  const existing = mealLogs.get(userId);
  if (existing) return existing;
  const created: MealLogEntry[] = [];
  mealLogs.set(userId, created);
  return created;
}

export function memoryGetMealLogsForDate(userId: string, date: string): MealLogEntry[] {
  return sortMealsByTime(userMealLogs(userId).filter((m) => m.loggedOn === date));
}

export function memoryAddDishesToMeal(
  userId: string,
  date: string,
  mealType: MealLogType,
  items: CleanMealLogItem[]
): void {
  const logs = userMealLogs(userId);
  let meal = logs.find((m) => m.loggedOn === date && m.mealType === mealType);
  if (!meal) {
    meal = { id: createMealLogId(), loggedOn: date, mealType, items: [] };
    logs.push(meal);
  }
  for (const item of items) {
    meal.items.push({
      id: nextMealLogItemId++,
      dishName: item.name,
      dishId: item.dishId ?? null,
      ingredients: item.ingredients,
      calories: item.calories ?? null,
      carbs: item.carbs ?? null,
      protein: item.protein ?? null,
      fat: item.fat ?? null,
      imageUrl: item.imageUrl ?? null,
      review: item.review ?? null,
    });
  }
}

export function memoryDeleteMealLog(userId: string, mealLogId: string): void {
  mealLogs.set(
    userId,
    userMealLogs(userId).filter((m) => m.id !== mealLogId)
  );
}

export function memoryDeleteMealLogItem(
  userId: string,
  mealLogId: string,
  itemId: number
): void {
  const meal = userMealLogs(userId).find((m) => m.id === mealLogId);
  if (!meal) return;
  meal.items = meal.items.filter((i) => i.id !== itemId);
  if (meal.items.length === 0) memoryDeleteMealLog(userId, mealLogId);
}

export function memoryClearMealLogs(userId: string): void {
  mealLogs.set(userId, []);
}

/** Mirrors the SQL GROUP BY in getDishVariants so dev without a database behaves the same. */
export function memoryDishVariants(
  userId: string,
  dishName: string,
  limit: number
): DishVariant[] {
  const wanted = dishName.trim().toLowerCase();
  const bySignature = new Map<string, DishVariant>();

  for (const meal of userMealLogs(userId)) {
    for (const item of meal.items) {
      if (item.dishName.trim().toLowerCase() !== wanted) continue;
      if (item.ingredients.length === 0) continue;
      const signature = buildLoggedIngredientSignature(item.ingredients);
      const existing = bySignature.get(signature);
      if (!existing) {
        bySignature.set(signature, {
          dishName: item.dishName,
          ingredients: item.ingredients,
          signature,
          timesLogged: 1,
          lastLoggedOn: meal.loggedOn,
        });
        continue;
      }
      existing.timesLogged += 1;
      if (meal.loggedOn > existing.lastLoggedOn) {
        existing.lastLoggedOn = meal.loggedOn;
        existing.ingredients = item.ingredients;
      }
    }
  }

  return [...bySignature.values()]
    .sort(
      (a, b) =>
        b.timesLogged - a.timesLogged || b.lastLoggedOn.localeCompare(a.lastLoggedOn)
    )
    .slice(0, limit);
}

export function memoryGetPreferences(userId: string): PreferenceProfile {
  memoryEnsureUserProfile(userId, "Guest");
  return userProfiles.get(userId)!.preferences ?? { ...DEFAULT_PREFERENCES };
}

export function memorySavePreferences(userId: string, preferences: PreferenceProfile): void {
  memoryEnsureUserProfile(userId, "Guest");
  userProfiles.get(userId)!.preferences = preferences;
}
