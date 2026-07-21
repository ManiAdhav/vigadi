import {
  DishRow,
  getDishesByIngredientNames,
  getTasteProfile,
  parseDishRow,
  TasteProfile,
} from "./db";
import { normalizeCatalogLabel } from "../shared/mealTemplates";
import { GEMINI_MODEL } from "./geminiConfig";
import { getGeminiClient } from "./discovery";
import { cleanAndParseJson } from "./jsonUtils";
import {
  allowsIngredientReuse,
  anchorSignature,
  buildBalanceRationale,
  getEligibleArchetypes,
  matchesArchetypeESide,
  scoreComboBalance,
  shouldSkipPlainRiceStaple,
  type BalanceArchetype,
  type ComboSignature,
} from "./comboBalance";

export const MIN_COMBOS = 3;
export const MAX_COMBOS = 5;
const GEMINI_BALANCE_THRESHOLD = 0;

export interface GeminiComboDraft {
  name?: string;
  dishIds: number[];
  subComponents?: string[];
  staple?: string;
  rationale?: string;
}

export interface BuiltCombo {
  id: string;
  name: string;
  dishIds: number[];
  subComponents: string[];
  dishes: ReturnType<typeof parseDishRow>[];
  staple: string;
  rationale: string;
  source: "global_pool" | "gemini" | "rule_engine";
  popularCount?: number;
  globalComboId?: number;
  mealLabel?: string;
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
  const group = normalizeCatalogLabel(dish.dish_group ?? "");
  if (group) return group === "gravy" || group === "curry";
  return GRAVY_TYPES.has((dish.dish_type ?? "").toLowerCase());
}

function isSide(dish: DishRow): boolean {
  const group = normalizeCatalogLabel(dish.dish_group ?? "");
  if (group) return group === "side";
  return SIDE_TYPES.has((dish.dish_type ?? "").toLowerCase());
}

export function scoreDishForTaste(dish: DishRow, taste: TasteProfile, ingredientName: string): number {
  let score = 0;
  const type = normalizeCatalogLabel(dish.dish_category ?? dish.dish_type ?? "");
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

function isRiceAnchor(dish: DishRow): boolean {
  return normalizeCatalogLabel(dish.dish_group ?? "") === "rice";
}

function signatureKey(signature: ComboSignature): string {
  return `${signature.consistencyBand}:${signature.spiceBand}`;
}

function tasteScore(dish: DishRow, taste: TasteProfile): number {
  return scoreDishForTaste(dish, taste, dish.ingredient_name ?? "");
}

function comboTotalScore(
  anchor: DishRow,
  extraGravies: DishRow[],
  sides: DishRow[],
  taste: TasteProfile
): number {
  const tasteTotal =
    tasteScore(anchor, taste) +
    extraGravies.reduce((sum, g) => sum + tasteScore(g, taste), 0) +
    sides.reduce((sum, side) => sum + tasteScore(side, taste), 0);
  return tasteTotal + scoreComboBalance(anchor, [...extraGravies, ...sides]);
}

function isComboIngredientValid(dishes: DishRow[]): boolean {
  for (let i = 0; i < dishes.length; i++) {
    for (let j = i + 1; j < dishes.length; j++) {
      if (!allowsIngredientReuse(dishes[i], dishes[j])) return false;
    }
  }
  return true;
}

function isAnchorCandidate(dish: DishRow, archetype: BalanceArchetype): boolean {
  if (archetype.id === "D") {
    return isRiceAnchor(dish) && archetype.matchesAnchor(dish);
  }
  return isGravy(dish) && archetype.matchesAnchor(dish);
}

function isSideCandidate(dish: DishRow, archetype: BalanceArchetype): boolean {
  if (archetype.id === "E") {
    return isSide(dish) || (isProteinSideForArchetypeE(dish));
  }
  return isSide(dish);
}

function isProteinSideForArchetypeE(dish: DishRow): boolean {
  const group = normalizeCatalogLabel(dish.dish_group ?? "");
  return group === "side" || group === "curry";
}

function sideMatchesSlot(
  dish: DishRow,
  archetype: BalanceArchetype,
  slotIndex: number,
  sideCount: number,
  anchor: DishRow
): boolean {
  if (archetype.id === "E") {
    return matchesArchetypeESide(dish, slotIndex, anchor, sideCount);
  }
  if (archetype.id === "D" && slotIndex > 0) {
    return isSide(dish);
  }
  return archetype.matchesSide(dish, slotIndex);
}

function pickSideCombinations(
  anchor: DishRow,
  sideCandidates: DishRow[],
  archetype: BalanceArchetype,
  sideCount: number,
  taste: TasteProfile
): DishRow[][] {
  const sorted = [...sideCandidates].sort((a, b) => tasteScore(b, taste) - tasteScore(a, taste));
  const results: DishRow[][] = [];

  function backtrack(slotIndex: number, picked: DishRow[], available: DishRow[]): void {
    if (slotIndex === sideCount) {
      results.push([...picked]);
      return;
    }
    for (const candidate of available) {
      if (!sideMatchesSlot(candidate, archetype, slotIndex, sideCount, anchor)) continue;
      const comboDishes = [anchor, ...picked, candidate];
      if (!isComboIngredientValid(comboDishes)) continue;
      const remaining = available.filter((d) => d.id !== candidate.id);
      backtrack(slotIndex + 1, [...picked, candidate], remaining);
    }
  }

  backtrack(0, [], sorted);
  return results;
}

/** When rules.gravyCount > 1, fill additional gravy/curry slots after the archetype anchor. */
function pickExtraGravies(
  anchor: DishRow,
  sides: DishRow[],
  gravyCandidates: DishRow[],
  count: number,
  taste: TasteProfile
): DishRow[][] {
  if (count <= 0) return [[]];

  const sorted = [...gravyCandidates]
    .filter((d) => d.id !== anchor.id && isGravy(d))
    .sort((a, b) => tasteScore(b, taste) - tasteScore(a, taste));

  const results: DishRow[][] = [];

  function backtrack(remaining: number, picked: DishRow[], available: DishRow[]): void {
    if (remaining === 0) {
      results.push([...picked]);
      return;
    }
    for (const candidate of available) {
      const comboDishes = [anchor, ...picked, candidate, ...sides];
      if (!isComboIngredientValid(comboDishes)) continue;
      backtrack(
        remaining - 1,
        [...picked, candidate],
        available.filter((d) => d.id !== candidate.id)
      );
    }
  }

  backtrack(count, [], sorted);
  return results.length > 0 ? results : [[]];
}

interface ScoredArchetypeCombo {
  anchor: DishRow;
  extraGravies: DishRow[];
  sides: DishRow[];
  archetypeId: BalanceArchetype["id"];
  score: number;
  signature: ComboSignature;
}

function findBestComboForArchetype(
  archetype: BalanceArchetype,
  dishes: DishRow[],
  rules: ComboRules,
  taste: TasteProfile,
  usedDishIds: Set<number>,
  usedSignatures: Set<string>
): ScoredArchetypeCombo | null {
  const available = dishes.filter((d) => !usedDishIds.has(d.id));
  const anchorCandidates = available
    .filter((d) => isAnchorCandidate(d, archetype))
    .sort((a, b) => tasteScore(b, taste) - tasteScore(a, taste))
    .slice(0, 12);
  const sideCandidates = available
    .filter((d) => isSideCandidate(d, archetype))
    .sort((a, b) => tasteScore(b, taste) - tasteScore(a, taste))
    .slice(0, 20);

  let best: ScoredArchetypeCombo | null = null;
  const gravyPool = available.filter((d) => isGravy(d));

  for (const anchor of anchorCandidates) {
    const slotsForAnchor =
      rules.gravyCount > 1 && isGravy(anchor) ? rules.gravyCount - 1 : 0;
    const sideCombos = pickSideCombinations(
      anchor,
      sideCandidates.filter((d) => d.id !== anchor.id),
      archetype,
      rules.sideCount,
      taste
    );
    for (const sides of sideCombos) {
      const extraGravyCombos =
        slotsForAnchor > 0
          ? pickExtraGravies(
              anchor,
              sides,
              gravyPool.filter((d) => d.id !== anchor.id),
              slotsForAnchor,
              taste
            )
          : [[]];

      for (const extraGravies of extraGravyCombos) {
        const totalDishes = 1 + extraGravies.length + sides.length;
        if (totalDishes > rules.gravyCount + rules.sideCount) continue;

        const signature = archetype.signature(anchor);
        const key = signatureKey(signature);
        if (usedSignatures.has(key)) continue;

        const score = comboTotalScore(anchor, extraGravies, sides, taste);
        if (!best || score > best.score) {
          best = {
            anchor,
            extraGravies,
            sides,
            archetypeId: archetype.id,
            score,
            signature,
          };
        }
      }
    }
  }

  return best;
}

function findBestAlternateCombo(
  archetypes: BalanceArchetype[],
  dishes: DishRow[],
  rules: ComboRules,
  taste: TasteProfile,
  usedDishIds: Set<number>,
  usedSignatures: Set<string>
): ScoredArchetypeCombo | null {
  let best: ScoredArchetypeCombo | null = null;

  for (const archetype of archetypes) {
    const candidate = findBestComboForArchetype(
      archetype,
      dishes,
      rules,
      taste,
      usedDishIds,
      usedSignatures
    );
    if (candidate && (!best || candidate.score > best.score)) {
      best = candidate;
    }
  }

  return best;
}

function scoredComboToBuiltCombo(
  combo: ScoredArchetypeCombo,
  rules: ComboRules,
  category: string,
  index: number
): BuiltCombo {
  const picked = [combo.anchor, ...combo.extraGravies, ...combo.sides];
  const parsed = picked.map(parseDishRow);
  const skipRiceStaple = shouldSkipPlainRiceStaple(combo.anchor);
  const addRice = category.toLowerCase() !== "breakfast" && !skipRiceStaple;
  const subComponents = [...parsed.map((d) => d.name)];
  if (addRice) subComponents.push("Rice");

  return {
    id: `combo-${Date.now()}-${index}`,
    name: buildComboName(picked),
    dishIds: picked.map((d) => d.id),
    subComponents,
    dishes: parsed,
    staple: addRice ? "Rice" : "",
    rationale: buildBalanceRationale(combo.anchor, [...combo.extraGravies, ...combo.sides]),
    source: "rule_engine",
  };
}

export function splitGeminiComboAnchorAndSides(
  dishes: DishRow[]
): { anchor: DishRow; sides: DishRow[] } | null {
  const anchorIndex = dishes.findIndex((d) => isGravy(d) || isRiceAnchor(d));
  if (anchorIndex < 0) return null;
  const anchor = dishes[anchorIndex];
  const sides = dishes.filter((_, i) => i !== anchorIndex);
  return { anchor, sides };
}

function buildGeminiComboOutput(
  draft: GeminiComboDraft,
  dishes: DishRow[],
  category: string,
  index: number
): BuiltCombo {
  const parsed = dishes.map(parseDishRow);
  const split = splitGeminiComboAnchorAndSides(dishes);
  const skipRiceStaple = split ? shouldSkipPlainRiceStaple(split.anchor) : false;
  const addRice = category.toLowerCase() !== "breakfast" && !skipRiceStaple;

  let subComponents = draft.subComponents ?? parsed.map((d) => d.name);
  if (skipRiceStaple || !addRice) {
    subComponents = subComponents.filter((c) => c !== "Rice");
  } else if (!subComponents.includes("Rice")) {
    subComponents = [...subComponents, "Rice"];
  }

  return {
    id: `combo-${Date.now()}-${index}`,
    name: draft.name || buildComboName(dishes),
    dishIds: dishes.map((d) => d.id),
    subComponents,
    dishes: parsed,
    staple: addRice ? "Rice" : "",
    rationale:
      draft.rationale ||
      (split ? buildBalanceRationale(split.anchor, split.sides) : ""),
    source: "gemini",
  };
}

export function validateAndRepairGeminiCombos(params: {
  geminiCombos: GeminiComboDraft[];
  catalogDishes: DishRow[];
  rules: ComboRules;
  taste: TasteProfile;
  ingredients: string[];
  category: string;
  maxCombos: number;
}): BuiltCombo[] {
  const {
    geminiCombos,
    catalogDishes,
    rules,
    taste,
    ingredients,
    category,
    maxCombos,
  } = params;
  const catalogMap = new Map(catalogDishes.map((d) => [d.id, d]));
  const kept: BuiltCombo[] = [];
  const usedIds = new Set<number>();
  const usedSignatures = new Set<string>();

  for (const draft of geminiCombos) {
    if (kept.length >= maxCombos) break;

    const dishes = (draft.dishIds ?? [])
      .map((id) => catalogMap.get(id))
      .filter(Boolean) as DishRow[];
    if (dishes.length === 0) continue;
    if (!isComboIngredientValid(dishes)) continue;

    const split = splitGeminiComboAnchorAndSides(dishes);
    if (!split) continue;

    const balanceScore = scoreComboBalance(split.anchor, split.sides);
    const key = signatureKey(anchorSignature(split.anchor));
    if (balanceScore < GEMINI_BALANCE_THRESHOLD) continue;
    if (usedSignatures.has(key)) continue;

    kept.push(buildGeminiComboOutput(draft, dishes, category, kept.length));
    dishes.forEach((d) => usedIds.add(d.id));
    usedSignatures.add(key);
  }

  if (kept.length < maxCombos) {
    const replacements = assembleRuleBasedCombos({
      dishes: catalogDishes,
      rules,
      taste,
      ingredients,
      category,
      maxCombos: maxCombos - kept.length,
      initialUsedIds: usedIds,
      initialUsedSignatures: usedSignatures,
    });
    kept.push(...replacements);
  }

  return kept.slice(0, maxCombos);
}

export function assembleRuleBasedCombos(params: {
  dishes: DishRow[];
  rules: ComboRules;
  taste: TasteProfile;
  ingredients: string[];
  category: string;
  maxCombos: number;
  initialUsedIds?: Set<number>;
  initialUsedSignatures?: Set<string>;
}): BuiltCombo[] {
  // rules.gravyCount bounds gravy slots: 1 anchor + (gravyCount-1) extra gravies when >1;
  // total dishes capped at gravyCount + sideCount. gravyCount===1 keeps single-anchor plates.
  const { dishes, rules, taste, ingredients, category, maxCombos } = params;
  const archetypes = getEligibleArchetypes(ingredients);
  const usedIds = new Set(params.initialUsedIds ?? []);
  const usedSignatures = new Set(params.initialUsedSignatures ?? []);
  const combos: BuiltCombo[] = [];

  for (const archetype of archetypes) {
    if (combos.length >= maxCombos) break;

    const best = findBestComboForArchetype(
      archetype,
      dishes,
      rules,
      taste,
      usedIds,
      usedSignatures
    );
    if (!best) continue;

    combos.push(scoredComboToBuiltCombo(best, rules, category, combos.length));
    usedIds.add(best.anchor.id);
    best.extraGravies.forEach((d) => usedIds.add(d.id));
    best.sides.forEach((d) => usedIds.add(d.id));
    usedSignatures.add(signatureKey(best.signature));
  }

  while (combos.length < maxCombos) {
    const alternate = findBestAlternateCombo(
      archetypes,
      dishes,
      rules,
      taste,
      usedIds,
      usedSignatures
    );
    if (!alternate) break;

    combos.push(scoredComboToBuiltCombo(alternate, rules, category, combos.length));
    usedIds.add(alternate.anchor.id);
    alternate.extraGravies.forEach((d) => usedIds.add(d.id));
    alternate.sides.forEach((d) => usedIds.add(d.id));
    usedSignatures.add(signatureKey(alternate.signature));
  }

  return combos;
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
  excludeDishIds?: number[];
  maxCombos?: number;
}): Promise<BuiltCombo[]> {
  const { ingredients, rules, category } = params;
  const comboRules = parseComboRules(rules);
  const taste = await getTasteProfile(params.userId);
  const maxCombos = params.maxCombos ?? MAX_COMBOS;
  const excludeIds = new Set(params.excludeDishIds ?? []);

  const catalogDishes = (await getDishesByIngredientNames(ingredients)).filter(
    (d) => !excludeIds.has(d.id)
  );
  if (catalogDishes.length === 0) {
    return [];
  }

  const client = getGeminiClient();
  if (client && catalogDishes.length >= 3) {
    try {
      const combos = await buildCombosWithGemini({
        dishes: catalogDishes,
        rules: comboRules,
        taste,
        category,
        ingredients,
        maxCombos,
      });
      return combos.slice(0, maxCombos);
    } catch (err) {
      console.error("Gemini combo builder failed, using rule engine:", err);
    }
  }

  return buildCombosRuleBased(
    catalogDishes,
    comboRules,
    taste,
    category,
    ingredients,
    maxCombos
  ).slice(0, maxCombos);
}

export function buildCombosRuleBased(
  catalogDishes: DishRow[],
  rules: ComboRules,
  taste: TasteProfile,
  category: string,
  ingredients: string[],
  maxCombos: number
): BuiltCombo[] {
  return assembleRuleBasedCombos({
    dishes: catalogDishes,
    rules,
    taste,
    ingredients,
    category,
    maxCombos,
  });
}

async function buildCombosWithGemini(params: {
  dishes: DishRow[];
  rules: ComboRules;
  taste: TasteProfile;
  category: string;
  ingredients: string[];
  maxCombos: number;
}): Promise<BuiltCombo[]> {
  const client = getGeminiClient()!;
  const dishCatalog = params.dishes.map((d) => ({
    id: d.id,
    ingredient: d.ingredient_name,
    name: d.name,
    type: d.dish_category ?? d.dish_type,
    spice: d.spice_level,
    consistency: d.consistency,
    dish_group: d.dish_group,
    youtube: d.youtube_url,
  }));

  const tasteHints = JSON.stringify(params.taste, null, 2);
  const isBreakfast = params.category.toLowerCase() === "breakfast";

  const prompt = `You are Vigadi's combo assembly engine.

Available dishes from YouTube catalog (ONLY use these dish ids):
${JSON.stringify(dishCatalog, null, 2)}

User ingredients: ${params.ingredients.join(", ")}
Meal slot: ${params.category}
Combo rules: ${params.rules.description} (${params.rules.gravyCount} gravy/kulambu/sambar + ${params.rules.sideCount} sides)
User taste profile: ${tasteHints}

Build EXACTLY ${params.maxCombos} different full meal combos. Each combo must:
- Follow the combo rules precisely
- Use dishes ONLY from the catalog above (by id)
- Use different dishes between combos where possible
${isBreakfast ? "- Do NOT add Rice staple (breakfast slot)" : "- Include Rice as staple unless the anchor dish is dish_group Rice (variety rice IS the staple — do not add plain Rice again)"}
- Respect user taste preferences (avoid disliked prep styles, prefer liked ones)

Balance rules (mandatory):
- B1 spice see-saw: spicy liquid gravies need mild/medium sides; mild anchors need at least one spicy side
- B2 wetness see-saw: crisp counts as dry; liquid/semi-liquid anchors need at least one dry/crisp side (prefer crisp for liquid anchors)
- B3 no repeated main ingredient across dishes except same-protein pairs (e.g. fish curry + fish fry OK; brinjal curry + brinjal poriyal NOT OK)
- Produce varied archetypes: each combo's anchor must have a unique (consistency band + spice band) pair across all ${params.maxCombos} combos

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
  const geminiCombos: GeminiComboDraft[] = (parsed?.combos ?? []).slice(0, params.maxCombos);

  return validateAndRepairGeminiCombos({
    geminiCombos,
    catalogDishes: params.dishes,
    rules: params.rules,
    taste: params.taste,
    ingredients: params.ingredients,
    category: params.category,
    maxCombos: params.maxCombos,
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
      popularCount:
        combo.source === "global_pool" && combo.popularCount
          ? `${combo.popularCount} picks`
          : "Catalog match",
      dishIds: combo.dishIds,
    };
  });
}
