import { query, isDatabaseConfigured } from "./pool";
import {
  createMealLogId,
  DishVariant,
  MealLogEntry,
  MealLogItem,
  MealLogItemInput,
  MealLogType,
  cleanMealLogItems,
  sortMealsByTime,
} from "../../shared/mealLogs";
import {
  buildLoggedIngredientSignature,
  parseLoggedIngredients,
} from "../../shared/loggedIngredients";
import {
  memoryAddDishesToMeal,
  memoryClearMealLogs,
  memoryDeleteMealLog,
  memoryDeleteMealLogItem,
  memoryDishVariants,
  memoryGetMealLogsForDate,
} from "./memoryStore";

interface MealLogRow {
  id: string;
  logged_on: string | Date;
  meal_type: string;
}

interface MealLogItemRow {
  id: string | number;
  meal_log_id: string;
  dish_name: string;
  dish_id: number | null;
  ingredients: unknown;
  calories: number | null;
  carbs: number | null;
  protein: number | null;
  fat: number | null;
  image_url: string | null;
  review: string | null;
}


/**
 * pg returns a DATE column as a Date built in the server's timezone, which can
 * print as the previous day. Reading the local parts back keeps the day the
 * user picked.
 */
function rowDateToIso(value: string | Date): string {
  if (typeof value === "string") return value.slice(0, 10);
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${value.getFullYear()}-${month}-${day}`;
}

function toItem(row: MealLogItemRow): MealLogItem {
  return {
    id: Number(row.id),
    dishName: row.dish_name,
    dishId: row.dish_id,
    ingredients: parseLoggedIngredients(row.ingredients),
    calories: row.calories,
    carbs: row.carbs,
    protein: row.protein,
    fat: row.fat,
    imageUrl: row.image_url,
    review: row.review,
  };
}

async function loadMeals(rows: MealLogRow[]): Promise<MealLogEntry[]> {
  if (rows.length === 0) return [];
  const itemRows = await query<MealLogItemRow>(
    `SELECT * FROM meal_log_items WHERE meal_log_id = ANY($1::text[]) ORDER BY position, id`,
    [rows.map((r) => r.id)]
  );
  const byMeal = new Map<string, MealLogItem[]>();
  for (const row of itemRows.rows) {
    const list = byMeal.get(row.meal_log_id) ?? [];
    list.push(toItem(row));
    byMeal.set(row.meal_log_id, list);
  }
  return sortMealsByTime(
    rows.map((row) => ({
      id: row.id,
      loggedOn: rowDateToIso(row.logged_on),
      mealType: row.meal_type as MealLogType,
      items: byMeal.get(row.id) ?? [],
    }))
  );
}

export async function getMealLogsForDate(
  userId: string,
  date: string
): Promise<MealLogEntry[]> {
  if (!isDatabaseConfigured()) return memoryGetMealLogsForDate(userId, date);
  const result = await query<MealLogRow>(
    `SELECT id, logged_on, meal_type FROM meal_logs WHERE user_id = $1 AND logged_on = $2::date`,
    [userId, date]
  );
  return loadMeals(result.rows);
}

/**
 * Adds dishes to the meal for that day and slot, creating it on first use.
 * Logging lunch twice on the same day appends to the same lunch rather than
 * leaving two lunch cards on the diary.
 */
export async function addDishesToMeal(
  userId: string,
  date: string,
  mealType: MealLogType,
  items: MealLogItemInput[]
): Promise<MealLogEntry[]> {
  const clean = cleanMealLogItems(items);
  if (clean.length === 0) return getMealLogsForDate(userId, date);

  if (!isDatabaseConfigured()) {
    memoryAddDishesToMeal(userId, date, mealType, clean);
    return memoryGetMealLogsForDate(userId, date);
  }

  const upsert = await query<{ id: string }>(
    `INSERT INTO meal_logs (id, user_id, logged_on, meal_type)
     VALUES ($1, $2, $3::date, $4)
     ON CONFLICT (user_id, logged_on, meal_type)
     DO UPDATE SET meal_type = EXCLUDED.meal_type
     RETURNING id`,
    [createMealLogId(), userId, date, mealType]
  );
  const mealLogId = upsert.rows[0].id;

  const next = await query<{ next: number }>(
    `SELECT COALESCE(MAX(position), -1) + 1 AS next FROM meal_log_items WHERE meal_log_id = $1`,
    [mealLogId]
  );
  let position = Number(next.rows[0]?.next ?? 0);

  for (const item of clean) {
    await query(
      `INSERT INTO meal_log_items
         (meal_log_id, dish_name, dish_id, position, ingredients, ingredient_signature,
          calories, carbs, protein, fat, image_url, review)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11, $12)`,
      [
        mealLogId,
        item.name,
        item.dishId ?? null,
        position++,
        JSON.stringify(item.ingredients),
        item.ingredients.length ? buildLoggedIngredientSignature(item.ingredients) : null,
        item.calories ?? null,
        item.carbs ?? null,
        item.protein ?? null,
        item.fat ?? null,
        item.imageUrl ?? null,
        item.review ?? null,
      ]
    );
  }

  return getMealLogsForDate(userId, date);
}

/**
 * Her own past versions of a dish, most-used first, then most recent.
 *
 * Matching is on the dish name she is typing now, so "sambar" brings back every
 * sambar she has recorded ingredients for — one tap to reuse, then free to edit.
 * Versions with no ingredients are skipped: they have nothing to offer back.
 */
export async function getDishVariants(
  userId: string,
  dishName: string,
  limit = 3
): Promise<DishVariant[]> {
  const name = dishName.trim();
  if (!name) return [];
  if (!isDatabaseConfigured()) return memoryDishVariants(userId, name, limit);

  const result = await query<{
    dish_name: string;
    ingredients: unknown;
    ingredient_signature: string;
    times_logged: string | number;
    last_logged_on: string | Date;
  }>(
    `SELECT MIN(i.dish_name) AS dish_name,
            (ARRAY_AGG(i.ingredients ORDER BY l.logged_on DESC, i.id DESC))[1] AS ingredients,
            i.ingredient_signature,
            COUNT(*) AS times_logged,
            MAX(l.logged_on) AS last_logged_on
       FROM meal_log_items i
       JOIN meal_logs l ON l.id = i.meal_log_id
      WHERE l.user_id = $1
        AND LOWER(i.dish_name) = LOWER($2)
        AND i.ingredient_signature IS NOT NULL
      GROUP BY i.ingredient_signature
      ORDER BY times_logged DESC, last_logged_on DESC
      LIMIT $3`,
    [userId, name, limit]
  );

  return result.rows.map((row) => ({
    dishName: row.dish_name,
    ingredients: parseLoggedIngredients(row.ingredients),
    signature: row.ingredient_signature,
    timesLogged: Number(row.times_logged),
    lastLoggedOn: rowDateToIso(row.last_logged_on),
  }));
}

export async function deleteMealLog(userId: string, mealLogId: string): Promise<void> {
  if (!isDatabaseConfigured()) {
    memoryDeleteMealLog(userId, mealLogId);
    return;
  }
  await query(`DELETE FROM meal_logs WHERE id = $1 AND user_id = $2`, [mealLogId, userId]);
}

/**
 * Removes one dish, and the meal with it once the last dish is gone — an empty
 * "Lunch" card with nothing in it is noise on the diary.
 */
export async function deleteMealLogItem(
  userId: string,
  mealLogId: string,
  itemId: number
): Promise<void> {
  if (!isDatabaseConfigured()) {
    memoryDeleteMealLogItem(userId, mealLogId, itemId);
    return;
  }
  await query(
    `DELETE FROM meal_log_items
      WHERE id = $1
        AND meal_log_id = $2
        AND EXISTS (SELECT 1 FROM meal_logs WHERE id = $2 AND user_id = $3)`,
    [itemId, mealLogId, userId]
  );
  await query(
    `DELETE FROM meal_logs
      WHERE id = $1
        AND user_id = $2
        AND NOT EXISTS (SELECT 1 FROM meal_log_items WHERE meal_log_id = $1)`,
    [mealLogId, userId]
  );
}

export async function clearMealLogs(userId: string): Promise<void> {
  if (!isDatabaseConfigured()) {
    memoryClearMealLogs(userId);
    return;
  }
  await query(`DELETE FROM meal_logs WHERE user_id = $1`, [userId]);
}
