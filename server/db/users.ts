import { query, isDatabaseConfigured } from "./pool";
import {
  memoryEnsureUserProfile,
  memoryGetUserProfile,
  memoryUpdateUserComboRules,
  memoryGetTasteProfile,
  memorySaveTasteProfile,
} from "./memoryStore";

export interface TasteProfile {
  liked_dish_types: Record<string, number>;
  disliked_dish_types: Record<string, number>;
  liked_prep_styles: Record<string, string[]>;
  disliked_prep_styles: Record<string, string[]>;
  preferred_spice: string | null;
  liked_combos: string[];
  disliked_combos: string[];
  ingredient_preferences: Record<string, { preferred: string[]; avoided: string[] }>;
}

export interface UserProfileRow {
  id: string;
  username: string;
  combo_rules: string;
  taste_profile: TasteProfile | string;
  city_code: string | null;
}

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

function parseTasteProfile(raw: TasteProfile | string | null | undefined): TasteProfile {
  if (!raw) return { ...DEFAULT_TASTE };
  if (typeof raw === "object") return { ...DEFAULT_TASTE, ...raw };
  try {
    const parsed = JSON.parse(raw) as Partial<TasteProfile>;
    return { ...DEFAULT_TASTE, ...parsed };
  } catch {
    return { ...DEFAULT_TASTE };
  }
}

export async function ensureUserProfile(userId: string, username: string): Promise<void> {
  if (!isDatabaseConfigured()) {
    memoryEnsureUserProfile(userId, username);
    return;
  }
  await query(
    `INSERT INTO user_profiles (id, username) VALUES ($1, $2)
     ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username, updated_at = NOW()`,
    [userId, username]
  );
}

export async function getUserProfile(userId: string): Promise<UserProfileRow | undefined> {
  if (!isDatabaseConfigured()) return memoryGetUserProfile(userId);
  const result = await query<UserProfileRow>(
    `SELECT id, username, combo_rules, taste_profile, city_code FROM user_profiles WHERE id = $1`,
    [userId]
  );
  return result.rows[0];
}

export async function updateUserComboRules(userId: string, rules: string): Promise<void> {
  if (!isDatabaseConfigured()) {
    memoryUpdateUserComboRules(userId, rules);
    return;
  }
  await query(
    `UPDATE user_profiles SET combo_rules = $1, updated_at = NOW() WHERE id = $2`,
    [rules, userId]
  );
}

export async function updateUserCity(userId: string, cityCode: string | null): Promise<void> {
  if (!isDatabaseConfigured()) {
    memoryEnsureUserProfile(userId, "Guest");
    const profile = memoryGetUserProfile(userId);
    if (profile) profile.city_code = cityCode?.trim().toLowerCase() || null;
    return;
  }
  await query(
    `UPDATE user_profiles SET city_code = $1, updated_at = NOW() WHERE id = $2`,
    [cityCode?.trim().toLowerCase() || null, userId]
  );
}

export async function getTasteProfile(userId: string): Promise<TasteProfile> {
  if (!isDatabaseConfigured()) return memoryGetTasteProfile(userId);
  const profile = await getUserProfile(userId);
  if (!profile) return { ...DEFAULT_TASTE };
  return parseTasteProfile(profile.taste_profile);
}

export async function saveTasteProfile(userId: string, taste: TasteProfile): Promise<void> {
  if (!isDatabaseConfigured()) {
    memorySaveTasteProfile(userId, taste);
    return;
  }
  await query(
    `UPDATE user_profiles SET taste_profile = $1::jsonb, updated_at = NOW() WHERE id = $2`,
    [JSON.stringify(taste), userId]
  );
}

export async function insertCombo(combo: {
  id: string;
  userId: string;
  name: string;
  dishIds: number[];
  subComponents: string[];
  category?: string;
  status?: string;
  source?: string;
  globalComboId?: number;
}): Promise<void> {
  if (!isDatabaseConfigured()) return;
  await query(
    `INSERT INTO combos (id, user_id, name, dish_ids, sub_components, category, status, source, global_combo_id)
     VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7, $8, $9)`,
    [
      combo.id,
      combo.userId,
      combo.name,
      JSON.stringify(combo.dishIds),
      JSON.stringify(combo.subComponents),
      combo.category ?? "Lunch",
      combo.status ?? "suggested",
      combo.source ?? "generated",
      combo.globalComboId ?? null,
    ]
  );
}

export async function updateComboStatus(comboId: string, status: string): Promise<void> {
  if (!isDatabaseConfigured()) return;
  await query(`UPDATE combos SET status = $1 WHERE id = $2`, [status, comboId]);
}

export async function insertFeedback(feedback: {
  id: string;
  userId: string;
  dishId?: number;
  comboId?: string;
  thumb: string;
  feedbackType?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  if (!isDatabaseConfigured()) return;
  await query(
    `INSERT INTO feedback (id, user_id, dish_id, combo_id, thumb, feedback_type, notes, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
    [
      feedback.id,
      feedback.userId,
      feedback.dishId ?? null,
      feedback.comboId ?? null,
      feedback.thumb,
      feedback.feedbackType ?? null,
      feedback.notes ?? null,
      feedback.metadata ? JSON.stringify(feedback.metadata) : null,
    ]
  );
}

export async function getFeedbackForUser(userId: string) {
  if (!isDatabaseConfigured()) return [];
  const result = await query(`SELECT * FROM feedback WHERE user_id = $1 ORDER BY created_at DESC`, [
    userId,
  ]);
  return result.rows;
}
