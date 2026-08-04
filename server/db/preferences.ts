import { query, isDatabaseConfigured } from "./pool";
import { DEFAULT_PREFERENCES, parsePreferences, PreferenceProfile } from "../../shared/preferences";
import { memoryGetPreferences, memorySavePreferences } from "./memoryStore";

export async function getPreferences(userId: string): Promise<PreferenceProfile> {
  if (!isDatabaseConfigured()) return memoryGetPreferences(userId);
  const result = await query<{ preferences: unknown }>(
    `SELECT preferences FROM user_profiles WHERE id = $1`,
    [userId]
  );
  if (!result.rows[0]) return { ...DEFAULT_PREFERENCES };
  return parsePreferences(result.rows[0].preferences);
}

export async function savePreferences(userId: string, preferences: PreferenceProfile): Promise<void> {
  if (!isDatabaseConfigured()) {
    memorySavePreferences(userId, preferences);
    return;
  }
  await query(
    `UPDATE user_profiles SET preferences = $1::jsonb, updated_at = NOW() WHERE id = $2`,
    [JSON.stringify(preferences), userId]
  );
}
