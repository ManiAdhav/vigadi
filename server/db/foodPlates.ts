import { query, isDatabaseConfigured } from "./pool";
import { FoodPlate, prepareFoodPlateForSave } from "../../shared/foodPlates";
import { memoryGetFoodPlates, memorySaveFoodPlates } from "./memoryStore";

function parseFoodPlates(raw: unknown): FoodPlate[] {
  if (!Array.isArray(raw)) return [];
  return raw as FoodPlate[];
}

export async function getFoodPlates(userId: string): Promise<FoodPlate[]> {
  if (!isDatabaseConfigured()) return memoryGetFoodPlates(userId);
  const result = await query<{ food_plates: unknown }>(
    `SELECT food_plates FROM user_profiles WHERE id = $1`,
    [userId]
  );
  return parseFoodPlates(result.rows[0]?.food_plates);
}

export async function saveFoodPlates(userId: string, plates: FoodPlate[]): Promise<void> {
  if (!isDatabaseConfigured()) {
    memorySaveFoodPlates(userId, plates);
    return;
  }
  await query(
    `UPDATE user_profiles SET food_plates = $1::jsonb, updated_at = NOW() WHERE id = $2`,
    [JSON.stringify(plates), userId]
  );
}

export async function upsertFoodPlate(userId: string, plate: FoodPlate): Promise<FoodPlate[]> {
  const prepared = prepareFoodPlateForSave(plate);
  let plates = await getFoodPlates(userId);
  const idx = plates.findIndex((p) => p.id === prepared.id);
  if (idx >= 0) {
    plates[idx] = prepared;
  } else {
    plates = [...plates, prepared];
  }
  await saveFoodPlates(userId, plates);
  return plates;
}

export async function deleteFoodPlate(userId: string, plateId: string): Promise<FoodPlate[]> {
  const plates = (await getFoodPlates(userId)).filter((p) => p.id !== plateId);
  await saveFoodPlates(userId, plates);
  return plates;
}

export async function duplicateFoodPlate(userId: string, plateId: string): Promise<FoodPlate[]> {
  const plates = await getFoodPlates(userId);
  const source = plates.find((p) => p.id === plateId);
  if (!source) return plates;
  const copy: FoodPlate = {
    ...source,
    id: `plate-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: `${source.name} (copy)`,
    slots: source.slots.map((s) => ({
      ...s,
      options: s.options ? [...s.options] : undefined,
    })),
    weekdays: [...source.weekdays],
  };
  plates.push(copy);
  await saveFoodPlates(userId, plates);
  return plates;
}
