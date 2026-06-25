import {
  ensureUserProfile,
  getDishById,
  getDishesByIds,
  getTasteProfile,
  getUserProfile,
  insertFeedback,
  saveTasteProfile,
  TasteProfile,
  updateComboStatus,
  DishRow,
} from "./db";
import { buildIngredientSignature } from "./db/ingredientSignature";
import { recordGlobalSelection } from "./db/globalCombos";
import { insertSelectionEvent, insertUserPreferredCombo } from "./db/events";

function bumpCounter(record: Record<string, number>, key: string, amount = 1) {
  record[key] = (record[key] ?? 0) + amount;
}

function extractPrepStyle(dishName: string): string {
  const lower = dishName.toLowerCase();
  if (lower.includes("fry") || lower.includes("varuval")) return "fry";
  if (lower.includes("sambar")) return "sambar";
  if (lower.includes("poriyal")) return "poriyal";
  if (lower.includes("kulambu") || lower.includes("kuzhambu")) return "kulambu";
  if (lower.includes("roast")) return "roast";
  if (lower.includes("curry")) return "curry";
  if (lower.includes("chutney")) return "chutney";
  return "other";
}

export async function recordDishFeedback(params: {
  userId: string;
  username: string;
  dishId: number;
  thumb: "up" | "down";
  notes?: string;
}): Promise<TasteProfile> {
  await ensureUserProfile(params.userId, params.username);
  const dish = await getDishById(params.dishId);
  if (!dish) return getTasteProfile(params.userId);

  await insertFeedback({
    id: `fb-${Date.now()}`,
    userId: params.userId,
    dishId: params.dishId,
    thumb: params.thumb,
    feedbackType: "dish_format",
    notes: params.notes,
    metadata: { dishName: dish.name, dishType: dish.dish_type, ingredient: dish.ingredient_name },
  });

  return updateTasteFromDish(params.userId, dish, params.thumb);
}

export async function recordComboSelection(params: {
  userId: string;
  username: string;
  comboId: string;
  comboName: string;
  dishIds: number[];
  rejectedComboId?: string;
  rejectedDishIds?: number[];
}): Promise<TasteProfile> {
  await ensureUserProfile(params.userId, params.username);
  await updateComboStatus(params.comboId, "selected");
  if (params.rejectedComboId) await updateComboStatus(params.rejectedComboId, "rejected");

  await insertFeedback({
    id: `fb-sel-${Date.now()}`,
    userId: params.userId,
    comboId: params.comboId,
    thumb: "up",
    feedbackType: "combo_selection",
    metadata: { comboName: params.comboName, dishIds: params.dishIds },
  });

  if (params.rejectedComboId) {
    await insertFeedback({
      id: `fb-rej-${Date.now()}`,
      userId: params.userId,
      comboId: params.rejectedComboId,
      thumb: "down",
      feedbackType: "combo_rejection",
      metadata: { rejectedDishIds: params.rejectedDishIds },
    });
  }

  const dishes = await getDishesByIds(params.dishIds);
  const ingredientNames = [...new Set(dishes.map((d) => d.ingredient_name ?? "").filter(Boolean))];
  const ingredientSignature = buildIngredientSignature(ingredientNames);

  const profile = await getUserProfile(params.userId);
  const globalComboId = await recordGlobalSelection({
    ingredientSignature,
    dishIds: params.dishIds,
    comboName: params.comboName,
    subComponents: [...dishes.map((d) => d.name), "Rice"],
    cityCode: profile?.city_code ?? null,
  });

  await insertSelectionEvent({
    id: `sel-${Date.now()}`,
    userId: params.userId,
    selectedComboId: params.comboId,
    rejectedComboId: params.rejectedComboId,
    dishIds: params.dishIds,
    rejectedDishIds: params.rejectedDishIds,
    globalComboId,
  });

  await insertUserPreferredCombo({
    id: `pref-${Date.now()}`,
    userId: params.userId,
    globalComboId,
    dishIds: params.dishIds,
    name: params.comboName,
    ingredientSignature,
  });

  let taste = await getTasteProfile(params.userId);
  taste.liked_combos.push(params.comboName);

  for (const dishId of params.dishIds) {
    const dish = await getDishById(dishId);
    if (dish) taste = await updateTasteFromDish(params.userId, dish, "up", taste);
  }

  if (params.rejectedDishIds) {
    for (const dishId of params.rejectedDishIds) {
      const dish = await getDishById(dishId);
      if (dish) taste = await updateTasteFromDish(params.userId, dish, "down", taste);
    }
  }

  await saveTasteProfile(params.userId, taste);
  return taste;
}

async function updateTasteFromDish(
  userId: string,
  dish: DishRow,
  thumb: "up" | "down",
  existing?: TasteProfile
): Promise<TasteProfile> {
  const taste = existing ?? (await getTasteProfile(userId));
  const type = (dish.dish_type ?? "other").toLowerCase();
  const ingredient = (dish.ingredient_name ?? "unknown").toLowerCase();
  const prepStyle = extractPrepStyle(dish.name);

  if (thumb === "up") {
    bumpCounter(taste.liked_dish_types, type);
    if (!taste.liked_prep_styles[ingredient]) taste.liked_prep_styles[ingredient] = [];
    if (!taste.liked_prep_styles[ingredient].includes(prepStyle)) {
      taste.liked_prep_styles[ingredient].push(prepStyle);
    }
    if (!taste.ingredient_preferences[ingredient]) {
      taste.ingredient_preferences[ingredient] = { preferred: [], avoided: [] };
    }
    if (!taste.ingredient_preferences[ingredient].preferred.includes(prepStyle)) {
      taste.ingredient_preferences[ingredient].preferred.push(prepStyle);
    }
    if (dish.spice_level) taste.preferred_spice = dish.spice_level;
  } else {
    bumpCounter(taste.disliked_dish_types, type);
    if (!taste.disliked_prep_styles[ingredient]) taste.disliked_prep_styles[ingredient] = [];
    if (!taste.disliked_prep_styles[ingredient].includes(prepStyle)) {
      taste.disliked_prep_styles[ingredient].push(prepStyle);
    }
    if (!taste.ingredient_preferences[ingredient]) {
      taste.ingredient_preferences[ingredient] = { preferred: [], avoided: [] };
    }
    if (!taste.ingredient_preferences[ingredient].avoided.includes(prepStyle)) {
      taste.ingredient_preferences[ingredient].avoided.push(prepStyle);
    }
    taste.disliked_combos.push(dish.name);
  }

  await saveTasteProfile(userId, taste);
  return taste;
}

export async function getTasteSummary(userId: string) {
  const taste = await getTasteProfile(userId);
  const summaries: string[] = [];

  for (const [ing, prefs] of Object.entries(taste.ingredient_preferences)) {
    if (prefs.preferred.length > 0) {
      summaries.push(`Prefers ${ing} as ${prefs.preferred.join(" or ")}`);
    }
    if (prefs.avoided.length > 0) {
      summaries.push(`Avoids ${ing} as ${prefs.avoided.join(" or ")}`);
    }
  }

  if (taste.preferred_spice) {
    summaries.push(`Preferred spice level: ${taste.preferred_spice}`);
  }

  return { taste, summaries };
}
