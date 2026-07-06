import { query, isDatabaseConfigured } from "./pool";
import {
  DaySettings,
  DEFAULT_DAY_SETTINGS,
  MealTemplate,
  normalizeTemplate,
} from "../../shared/mealTemplates";
import {
  memoryGetDaySettings,
  memoryGetMealTemplates,
  memorySaveDaySettings,
  memorySaveMealTemplates,
} from "./memoryStore";

function parseTemplates(raw: unknown): MealTemplate[] {
  if (!Array.isArray(raw)) return [];
  return raw as MealTemplate[];
}

function parseDaySettings(raw: unknown): DaySettings {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_DAY_SETTINGS };
  const obj = raw as Partial<DaySettings>;
  return {
    school_weekdays: obj.school_weekdays ?? DEFAULT_DAY_SETTINGS.school_weekdays,
    holiday_override: obj.holiday_override ?? null,
  };
}

export async function getMealTemplates(userId: string): Promise<MealTemplate[]> {
  if (!isDatabaseConfigured()) return memoryGetMealTemplates(userId);
  const result = await query<{ meal_templates: unknown }>(
    `SELECT meal_templates FROM user_profiles WHERE id = $1`,
    [userId]
  );
  return parseTemplates(result.rows[0]?.meal_templates);
}

export async function saveMealTemplates(userId: string, templates: MealTemplate[]): Promise<void> {
  if (!isDatabaseConfigured()) {
    memorySaveMealTemplates(userId, templates);
    return;
  }
  await query(
    `UPDATE user_profiles SET meal_templates = $1::jsonb, updated_at = NOW() WHERE id = $2`,
    [JSON.stringify(templates), userId]
  );
}

export async function getDaySettings(userId: string): Promise<DaySettings> {
  if (!isDatabaseConfigured()) return memoryGetDaySettings(userId);
  const result = await query<{ day_settings: unknown }>(
    `SELECT day_settings FROM user_profiles WHERE id = $1`,
    [userId]
  );
  return parseDaySettings(result.rows[0]?.day_settings);
}

export async function saveDaySettings(userId: string, settings: DaySettings): Promise<DaySettings> {
  if (!isDatabaseConfigured()) {
    memorySaveDaySettings(userId, settings);
    return settings;
  }
  await query(
    `UPDATE user_profiles SET day_settings = $1::jsonb, updated_at = NOW() WHERE id = $2`,
    [JSON.stringify(settings), userId]
  );
  return settings;
}

export async function upsertMealTemplate(userId: string, template: MealTemplate): Promise<MealTemplate[]> {
  let templates = await getMealTemplates(userId);
  const idx = templates.findIndex((t) => t.id === template.id);
  if (idx >= 0) {
    templates[idx] = template;
  } else {
    templates = [...templates, template];
  }
  await saveMealTemplates(userId, templates);
  return templates;
}

export async function deleteMealTemplate(userId: string, templateId: string): Promise<MealTemplate[]> {
  const templates = (await getMealTemplates(userId)).filter((t) => t.id !== templateId);
  await saveMealTemplates(userId, templates);
  return templates;
}

export async function duplicateMealTemplate(userId: string, templateId: string): Promise<MealTemplate[]> {
  const templates = await getMealTemplates(userId);
  const source = templates.find((t) => t.id === templateId);
  if (!source) return templates;
  const copy: MealTemplate = {
    ...normalizeTemplate(source),
    id: `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: `${source.name} (copy)`,
  };
  templates.push(copy);
  await saveMealTemplates(userId, templates);
  return templates;
}

export async function resetMealTemplatesToPresets(userId: string): Promise<MealTemplate[]> {
  const { REGION_PRESET_TEMPLATES } = await import("../../shared/mealTemplates");
  const presets = [...REGION_PRESET_TEMPLATES];
  await saveMealTemplates(userId, presets);
  return presets;
}
