import { query } from "./pool";

export async function insertGenerationSession(session: {
  id: string;
  userId: string;
  ingredientSignature: string;
  ingredients: string[];
  comboRules: string;
  category: string;
  slotsRequested: number;
  slotsFromGlobal: number;
  slotsGenerated: number;
}): Promise<void> {
  await query(
    `INSERT INTO generation_sessions
       (id, user_id, ingredient_signature, ingredients, combo_rules, category,
        slots_requested, slots_from_global, slots_generated)
     VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9)`,
    [
      session.id,
      session.userId,
      session.ingredientSignature,
      JSON.stringify(session.ingredients),
      session.comboRules,
      session.category,
      session.slotsRequested,
      session.slotsFromGlobal,
      session.slotsGenerated,
    ]
  );
}

export async function insertComboCandidate(candidate: {
  id: string;
  sessionId: string;
  comboName: string;
  dishIds: number[];
  source: "global_pool" | "gemini" | "rule_engine";
  globalComboId?: number;
  score?: number;
  rank: number;
  rationale?: string;
}): Promise<void> {
  await query(
    `INSERT INTO combo_candidates
       (id, session_id, combo_name, dish_ids, source, global_combo_id, score, rank, rationale)
     VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9)`,
    [
      candidate.id,
      candidate.sessionId,
      candidate.comboName,
      JSON.stringify(candidate.dishIds),
      candidate.source,
      candidate.globalComboId ?? null,
      candidate.score ?? null,
      candidate.rank,
      candidate.rationale ?? null,
    ]
  );
}

export async function insertSelectionEvent(event: {
  id: string;
  sessionId?: string;
  userId: string;
  selectedComboId: string;
  rejectedComboId?: string;
  dishIds: number[];
  rejectedDishIds?: number[];
  globalComboId?: number;
}): Promise<void> {
  await query(
    `INSERT INTO selection_events
       (id, session_id, user_id, selected_combo_id, rejected_combo_id,
        dish_ids, rejected_dish_ids, global_combo_id)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8)`,
    [
      event.id,
      event.sessionId ?? null,
      event.userId,
      event.selectedComboId,
      event.rejectedComboId ?? null,
      JSON.stringify(event.dishIds),
      event.rejectedDishIds ? JSON.stringify(event.rejectedDishIds) : null,
      event.globalComboId ?? null,
    ]
  );
}

export async function insertUserPreferredCombo(combo: {
  id: string;
  userId: string;
  globalComboId?: number;
  dishIds: number[];
  name: string;
  ingredientSignature: string;
}): Promise<void> {
  await query(
    `INSERT INTO user_preferred_combos
       (id, user_id, global_combo_id, dish_ids, name, ingredient_signature)
     VALUES ($1,$2,$3,$4::jsonb,$5,$6)`,
    [
      combo.id,
      combo.userId,
      combo.globalComboId ?? null,
      JSON.stringify(combo.dishIds),
      combo.name,
      combo.ingredientSignature,
    ]
  );
}
