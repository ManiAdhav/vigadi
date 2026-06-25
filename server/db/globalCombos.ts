import { query } from "./pool";

export interface GlobalComboRow {
  id: number;
  ingredientSignature: string;
  dishIds: number[];
  comboName: string;
  subComponents: string[];
  selectionCount: number;
  cityCode: string | null;
}

function rowToGlobalCombo(row: {
  id: number;
  ingredient_signature: string;
  dish_ids: number[];
  combo_name: string;
  sub_components: string[];
  selection_count: number;
  city_code: string | null;
}): GlobalComboRow {
  return {
    id: row.id,
    ingredientSignature: row.ingredient_signature,
    dishIds: row.dish_ids,
    comboName: row.combo_name,
    subComponents: row.sub_components,
    selectionCount: row.selection_count,
    cityCode: row.city_code,
  };
}

export async function upsertGlobalCombo(params: {
  ingredientSignature: string;
  dishIds: number[];
  comboName: string;
  subComponents: string[];
  cityCode: string | null;
}): Promise<number> {
  const sortedIds = [...params.dishIds].sort((a, b) => a - b);
  const cityKey = params.cityCode ?? "";

  const existing = await query<{ id: number }>(
    `SELECT id FROM global_combos
     WHERE ingredient_signature = $1
       AND dish_ids = $2::jsonb
       AND COALESCE(city_code, '') = $3`,
    [params.ingredientSignature, JSON.stringify(sortedIds), cityKey]
  );

  if (existing.rows[0]) {
    await query(
      `UPDATE global_combos
       SET selection_count = selection_count + 1, last_selected_at = NOW()
       WHERE id = $1`,
      [existing.rows[0].id]
    );
    return existing.rows[0].id;
  }

  const result = await query<{ id: number }>(
    `INSERT INTO global_combos
       (ingredient_signature, dish_ids, combo_name, sub_components, city_code, selection_count)
     VALUES ($1, $2::jsonb, $3, $4::jsonb, $5, 1)
     RETURNING id`,
    [
      params.ingredientSignature,
      JSON.stringify(sortedIds),
      params.comboName,
      JSON.stringify(params.subComponents),
      params.cityCode,
    ]
  );
  return result.rows[0].id;
}

export async function getPopularCombos(params: {
  ingredientSignature: string;
  cityCode: string | null;
  limit: number;
}): Promise<GlobalComboRow[]> {
  const result = await query<{
    id: number;
    ingredient_signature: string;
    dish_ids: number[];
    combo_name: string;
    sub_components: string[];
    selection_count: number;
    city_code: string | null;
  }>(
    `SELECT * FROM global_combos
     WHERE ingredient_signature = $1
       AND (city_code = $2 OR city_code IS NULL)
     ORDER BY
       CASE WHEN city_code IS NOT DISTINCT FROM $2 THEN 0 ELSE 1 END,
       selection_count DESC
     LIMIT $3`,
    [params.ingredientSignature, params.cityCode, params.limit]
  );
  return result.rows.map(rowToGlobalCombo);
}

export async function recordGlobalSelection(params: {
  ingredientSignature: string;
  dishIds: number[];
  comboName: string;
  subComponents: string[];
  cityCode: string | null;
}): Promise<number> {
  const globalId = await upsertGlobalCombo({ ...params, cityCode: null });
  if (params.cityCode) {
    await upsertGlobalCombo({ ...params, cityCode: params.cityCode });
  }
  return globalId;
}
