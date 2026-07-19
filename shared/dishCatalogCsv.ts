/** Parse semicolon-separated CSV list fields into trimmed string arrays. */
export function parseSemicolonList(value: string | null | undefined): string[] {
  if (!value?.trim()) return [];
  return value
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
}

/** Parse JS Date string from CSV discovered_at column. */
export function parseDiscoveredAt(value: string | null | undefined): Date | null {
  if (!value?.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export interface CsvDishRow {
  id: string;
  dish_name: string;
  ingredient_id: string;
  ingredient_name: string;
  ingredient_catalog_slug: string;
  dish_group: string;
  dish_category: string;
  consistency: string;
  base_tags: string;
  accompaniments: string;
  english_alias: string;
  spice_level: string;
  main_ingredients: string;
  description: string;
  youtube_url: string;
  youtube_video_id: string;
  channel_name: string;
  source: string;
  discovered_at: string;
}

export interface ParsedCsvDish {
  id: number;
  name: string;
  ingredientId: number;
  dishGroup: string;
  dishCategory: string;
  consistency: string;
  baseTags: string[];
  accompaniments: string[];
  englishAlias: string | null;
  spiceLevel: string;
  mainIngredients: string[];
  description: string;
  youtubeUrl: string | null;
  youtubeVideoId: string | null;
  channelName: string | null;
  source: string;
  discoveredAt: Date | null;
}

export function parseCsvDishRow(row: CsvDishRow): ParsedCsvDish {
  return {
    id: Number(row.id),
    name: row.dish_name.trim(),
    ingredientId: Number(row.ingredient_id),
    dishGroup: row.dish_group.trim(),
    dishCategory: row.dish_category.trim(),
    consistency: row.consistency.trim(),
    baseTags: parseSemicolonList(row.base_tags),
    accompaniments: parseSemicolonList(row.accompaniments),
    englishAlias: row.english_alias?.trim() || null,
    spiceLevel: row.spice_level.trim(),
    mainIngredients: parseSemicolonList(row.main_ingredients),
    description: row.description.trim(),
    youtubeUrl: row.youtube_url?.trim() || null,
    youtubeVideoId: row.youtube_video_id?.trim() || null,
    channelName: row.channel_name?.trim() || null,
    source: row.source.trim(),
    discoveredAt: parseDiscoveredAt(row.discovered_at),
  };
}
