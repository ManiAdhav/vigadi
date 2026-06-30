import fs from "fs";
import path from "path";
import { execSync } from "child_process";

export interface DishSeed {
  name: string;
  youtubeUrl: string;
  dishType: string;
  spiceLevel: string;
  mainIngredients: string[];
  pairsWith: string[];
  description: string;
  channelName?: string;
}

export interface IngredientDishBlock {
  ingredientId: string;
  ingredientCanonical: string;
  dishes: DishSeed[];
}

const DISHES_DIR = path.resolve(process.cwd(), "../Vigadi_Dishes");
const OUTPUT_PATH = path.join(process.cwd(), "data/dishes.json");

/** Map Gemini batch ids → catalog ids in data/ingredients.json */
export const INGREDIENT_ID_MAP: Record<string, string> = {
  "beans-french": "french-beans",
  "black-chickpeas": "black-chickpea",
  "brinjal-long": "brinjal",
  "brinjal-small": "brinjal",
  chickpeas: "white-chickpea",
  "chow-chow": "chayote",
  colocasia: "taro-root",
  coriander: "coriander-leaves",
  cowpeas: "black-eyed-peas",
  "green-gram": "whole-green-gram",
  "green-peas": "dried-peas",
  "kidney-beans": "rajma",
  manathakkali: "manathakkali-keerai",
  mint: "mint-leaves",
  "onion-big": "onion",
  "plantain-raw": "raw-banana",
  prawn: "prawns",
  "pumpkin-yellow": "pumpkin",
  sirukeerai: "siru-keerai",
  "yam-elephant": "elephant-foot-yam",
};

const SKIP_IDS = new Set(["beef", "black-gram", "double-beans", "soya-chunks"]);

function rtfToText(filePath: string): string {
  return execSync(`textutil -convert txt -stdout ${JSON.stringify(filePath)}`, {
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
  });
}

function extractJsonArray(text: string): IngredientDishBlock[] {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start < 0 || end < 0) {
    throw new Error("No JSON array found in file");
  }
  return JSON.parse(text.slice(start, end + 1)) as IngredientDishBlock[];
}

export function resolveIngredientId(rawId: string): string | null {
  if (SKIP_IDS.has(rawId)) return null;
  return INGREDIENT_ID_MAP[rawId] ?? rawId;
}

function main() {
  if (!fs.existsSync(DISHES_DIR)) {
    console.error(`Dishes folder not found: ${DISHES_DIR}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(DISHES_DIR)
    .filter((f) => f.toLowerCase().endsWith(".rtf"))
    .sort();

  const merged = new Map<string, IngredientDishBlock>();

  for (const file of files) {
    const filePath = path.join(DISHES_DIR, file);
    const text = rtfToText(filePath);
    const blocks = extractJsonArray(text);

    for (const block of blocks) {
      const catalogId = resolveIngredientId(block.ingredientId);
      if (!catalogId) {
        console.warn(`Skipping unknown/unmapped ingredient: ${block.ingredientId} (${file})`);
        continue;
      }

      const existing = merged.get(catalogId);
      if (!existing) {
        merged.set(catalogId, {
          ingredientId: catalogId,
          ingredientCanonical: block.ingredientCanonical,
          dishes: [...block.dishes],
        });
        continue;
      }

      const seen = new Set(existing.dishes.map((d) => d.name.toLowerCase()));
      for (const dish of block.dishes) {
        const key = dish.name.toLowerCase();
        if (!seen.has(key)) {
          existing.dishes.push(dish);
          seen.add(key);
        }
      }
    }
    console.log(`Parsed ${file}: ${blocks.length} ingredient blocks`);
  }

  const output = [...merged.values()].sort((a, b) => a.ingredientId.localeCompare(b.ingredientId));
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));

  const dishCount = output.reduce((n, b) => n + b.dishes.length, 0);
  console.log(`Wrote ${output.length} ingredients / ${dishCount} dishes → ${OUTPUT_PATH}`);
}

const isDirectRun = process.argv[1]?.endsWith("parse-dish-rtf.ts");
if (isDirectRun) main();
