import {
  DishRow,
  getDishesByIngredientNames,
  getTasteProfile,
  parseDishRow,
  TasteProfile,
} from "./db";
import { GEMINI_MODEL } from "./geminiConfig";
import { getGeminiClient } from "./discovery";
import { cleanAndParseJson } from "./jsonUtils";

export interface BuiltCombo {
  id: string;
  name: string;
  dishIds: number[];
  subComponents: string[];
  dishes: ReturnType<typeof parseDishRow>[];
  staple: string;
  rationale: string;
}

const GRAVY_TYPES = new Set(["gravy", "kulambu", "sambar", "curry", "kuzhambu", "rasam"]);
const SIDE_TYPES = new Set(["side", "fry", "poriyal", "roast", "chutney", "pachadi"]);

export interface ComboRules {
  gravyCount: number;
  sideCount: number;
  description: string;
}

export function parseComboRules(rulesText: string): ComboRules {
  const lower = rulesText.toLowerCase();
  let gravyCount = 1;
  let sideCount = 2;

  const gravyMatch = lower.match(/(\d+)\s*(kulambu|gravy|curry|sambar)/);
  const sideMatch = lower.match(/(\d+)\s*(side|poriyal|fry|roast)/);

  if (gravyMatch) gravyCount = parseInt(gravyMatch[1], 10);
  if (sideMatch) sideCount = parseInt(sideMatch[1], 10);

  return { gravyCount, sideCount, description: rulesText };
}

function isGravy(dish: DishRow): boolean {
  return GRAVY_TYPES.has((dish.dish_type ?? "").toLowerCase());
}

function isSide(dish: DishRow): boolean {
  return SIDE_TYPES.has((dish.dish_type ?? "").toLowerCase());
}

function scoreDishForTaste(dish: DishRow, taste: TasteProfile, ingredientName: string): number {
  let score = 0;
  const type = (dish.dish_type ?? "").toLowerCase();
  const name = dish.name.toLowerCase();

  score += taste.liked_dish_types[type] ?? 0;
  score -= (taste.disliked_dish_types[type] ?? 0) * 2;

  const ingPrefs = taste.ingredient_preferences[ingredientName.toLowerCase()];
  if (ingPrefs) {
    for (const pref of ingPrefs.preferred) {
      if (name.includes(pref.toLowerCase())) score += 3;
    }
    for (const avoid of ingPrefs.avoided) {
      if (name.includes(avoid.toLowerCase())) score -= 5;
    }
  }

  for (const styles of Object.values(taste.liked_prep_styles)) {
    for (const s of styles) {
      if (name.includes(s.toLowerCase())) score += 2;
    }
  }
  for (const styles of Object.values(taste.disliked_prep_styles)) {
    for (const s of styles) {
      if (name.includes(s.toLowerCase())) score -= 3;
    }
  }

  if (taste.preferred_spice && dish.spice_level === taste.preferred_spice) score += 1;

  return score;
}

function pickDishesForCombo(
  allDishes: DishRow[],
  rules: ComboRules,
  taste: TasteProfile,
  usedDishIds: Set<number>,
  variant: number
): DishRow[] {
  const gravies = allDishes.filter((d) => isGravy(d) && !usedDishIds.has(d.id));
  const sides = allDishes.filter((d) => isSide(d) && !usedDishIds.has(d.id));

  gravies.sort(
    (a, b) =>
      scoreDishForTaste(b, taste, b.ingredient_name ?? "") -
        scoreDishForTaste(a, taste, a.ingredient_name ?? "") +
      variant * (a.id % 3)
  );
  sides.sort(
    (a, b) =>
      scoreDishForTaste(b, taste, b.ingredient_name ?? "") -
        scoreDishForTaste(a, taste, a.ingredient_name ?? "") +
      variant * (b.id % 5)
  );

  const picked: DishRow[] = [];
  const usedIngredients = new Set<string>();

  for (const g of gravies) {
    if (picked.filter(isGravy).length >= rules.gravyCount) break;
    const ing = (g.ingredient_name ?? "").toLowerCase();
    if (!usedIngredients.has(ing)) {
      picked.push(g);
      usedIngredients.add(ing);
    }
  }

  for (const s of sides) {
    if (picked.filter(isSide).length >= rules.sideCount) break;
    const ing = (s.ingredient_name ?? "").toLowerCase();
    if (!usedIngredients.has(ing)) {
      picked.push(s);
      usedIngredients.add(ing);
    }
  }

  // Fill remaining slots allowing ingredient reuse with different prep style
  if (picked.filter(isGravy).length < rules.gravyCount) {
    for (const g of gravies) {
      if (picked.length >= rules.gravyCount + rules.sideCount) break;
      if (!picked.find((p) => p.id === g.id)) picked.push(g);
    }
  }
  if (picked.filter(isSide).length < rules.sideCount) {
    for (const s of sides) {
      if (picked.length >= rules.gravyCount + rules.sideCount) break;
      if (!picked.find((p) => p.id === s.id)) picked.push(s);
    }
  }

  return picked.slice(0, rules.gravyCount + rules.sideCount);
}

function buildComboName(dishes: DishRow[]): string {
  const names = dishes.map((d) => d.name.split(" ")[0]).slice(0, 3);
  return `${names.join(" + ")} Plate`;
}

export async function buildCombosFromCatalog(params: {
  userId: string;
  ingredients: string[];
  rules: string;
  category: string;
}): Promise<BuiltCombo[]> {
  const { ingredients, rules, category } = params;
  const comboRules = parseComboRules(rules);
  const taste = await getTasteProfile(params.userId);

  const catalogDishes = await getDishesByIngredientNames(ingredients);
  if (catalogDishes.length === 0) {
    return [];
  }

  const client = getGeminiClient();
  if (client && catalogDishes.length >= 3) {
    try {
      return await buildCombosWithGemini({
        dishes: catalogDishes,
        rules: comboRules,
        taste,
        category,
        ingredients,
      });
    } catch (err) {
      console.error("Gemini combo builder failed, using rule engine:", err);
    }
  }

  return buildCombosRuleBased(catalogDishes, comboRules, taste, category);
}

function buildCombosRuleBased(
  catalogDishes: DishRow[],
  rules: ComboRules,
  taste: TasteProfile,
  category: string
): BuiltCombo[] {
  const usedIds = new Set<number>();
  const combos: BuiltCombo[] = [];

  for (let variant = 0; variant < 2; variant++) {
    const picked = pickDishesForCombo(catalogDishes, rules, taste, usedIds, variant);
    picked.forEach((d) => usedIds.add(d.id));

    if (picked.length === 0) continue;

    const parsed = picked.map(parseDishRow);
    combos.push({
      id: `combo-${Date.now()}-${variant}`,
      name: buildComboName(picked),
      dishIds: picked.map((d) => d.id),
      subComponents: [...parsed.map((d) => d.name), "Rice"],
      dishes: parsed,
      staple: "Rice",
      rationale: `Balanced ${rules.gravyCount} gravy + ${rules.sideCount} sides from your ingredient catalog.`,
    });
  }

  return combos;
}

async function buildCombosWithGemini(params: {
  dishes: DishRow[];
  rules: ComboRules;
  taste: TasteProfile;
  category: string;
  ingredients: string[];
}): Promise<BuiltCombo[]> {
  const client = getGeminiClient()!;
  const dishCatalog = params.dishes.map((d) => ({
    id: d.id,
    ingredient: d.ingredient_name,
    name: d.name,
    type: d.dish_type,
    spice: d.spice_level,
    youtube: d.youtube_url,
  }));

  const tasteHints = JSON.stringify(params.taste, null, 2);

  const prompt = `You are Vigadi's combo assembly engine.

Available dishes from YouTube catalog (ONLY use these dish ids):
${JSON.stringify(dishCatalog, null, 2)}

User ingredients: ${params.ingredients.join(", ")}
Meal slot: ${params.category}
Combo rules: ${params.rules.description} (${params.rules.gravyCount} gravy/kulambu/sambar + ${params.rules.sideCount} sides)
User taste profile: ${tasteHints}

Build EXACTLY 2 different full meal combos. Each combo must:
- Follow the combo rules precisely
- Use dishes ONLY from the catalog above (by id)
- Use different dishes between combo 1 and combo 2 where possible
- Include Rice as staple
- Respect user taste preferences (avoid disliked prep styles, prefer liked ones)

Return JSON:
{
  "combos": [
    {
      "name": "Regional plate name",
      "dishIds": [1, 2, 3],
      "subComponents": ["Dish A", "Dish B", "Dish C", "Rice"],
      "staple": "Rice",
      "rationale": "Why this combo suits the user"
    }
  ]
}`;

  const response = await client.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: { responseMimeType: "application/json" },
  });

  const parsed = cleanAndParseJson(response.text || '{"combos":[]}');
  const catalogMap = new Map(params.dishes.map((d) => [d.id, d]));

  return (parsed?.combos ?? []).slice(0, 2).map((c: any, i: number) => {
    const dishIds: number[] = c.dishIds ?? [];
    const dishes = dishIds.map((id) => catalogMap.get(id)).filter(Boolean) as DishRow[];
    return {
      id: `combo-${Date.now()}-${i}`,
      name: c.name || buildComboName(dishes),
      dishIds,
      subComponents: c.subComponents ?? [...dishes.map((d) => d.name), "Rice"],
      dishes: dishes.map(parseDishRow),
      staple: c.staple || "Rice",
      rationale: c.rationale || "",
    };
  });
}

export function combosToMeals(combos: BuiltCombo[], category: string) {
  return combos.map((combo) => {
    const youtubeLinks: Record<string, string> = {};
    combo.dishes.forEach((d) => {
      if (d.youtubeUrl) youtubeLinks[d.name] = d.youtubeUrl;
    });

    const totalMacros = combo.dishes.reduce(
      (acc, d) => {
        const spice = d.spiceLevel;
        const base = spice === "very_spicy" ? 12 : spice === "spicy" ? 10 : 8;
        return {
          carbs: acc.carbs + 15,
          protein: acc.protein + base,
          fat: acc.fat + 6,
          calories: acc.calories + 120,
        };
      },
      { carbs: 45, protein: 10, fat: 8, calories: 200 }
    );

    return {
      id: combo.id,
      recipeName: combo.name,
      prepTime: "45 min",
      category,
      macros: totalMacros,
      rating: 4.7,
      difficulty: "Medium",
      servings: 2,
      image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80",
      tagline: combo.rationale,
      subComponents: combo.subComponents,
      ingredients: combo.dishes.flatMap((d) => d.mainIngredients),
      steps: combo.dishes.map((d) => `Prepare ${d.name} using the linked YouTube tutorial.`),
      nutritionFact: combo.rationale,
      matchedIngredients: combo.dishes.map((d) => d.ingredientName).filter(Boolean),
      youtubeLinks,
      videoCount: combo.dishes.length,
      popularCount: "Catalog match",
      dishIds: combo.dishIds,
    };
  });
}
