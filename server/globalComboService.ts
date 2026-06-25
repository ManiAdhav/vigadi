import { buildIngredientSignature } from "./db/ingredientSignature";
import { getPopularCombos } from "./db/globalCombos";
import { getDishesByIds, getTasteProfile, getUserProfile, parseDishRow } from "./db";
import { buildCombosFromCatalog, BuiltCombo, scoreDishForTaste } from "./comboBuilder";
import { insertGenerationSession, insertComboCandidate } from "./db/events";

const SLOTS_REQUESTED = 2;
const MIN_TASTE_SCORE = -5;

export async function buildCombosGlobalFirst(params: {
  userId: string;
  ingredients: string[];
  rules: string;
  category: string;
}): Promise<{ combos: BuiltCombo[]; sessionId: string }> {
  const signature = buildIngredientSignature(params.ingredients);
  const profile = await getUserProfile(params.userId);
  const cityCode = profile?.city_code ?? null;
  const taste = await getTasteProfile(params.userId);
  const sessionId = `session-${Date.now()}`;

  const globalHits = await getPopularCombos({
    ingredientSignature: signature,
    cityCode,
    limit: SLOTS_REQUESTED,
  });

  const globalCombos: BuiltCombo[] = [];
  const usedDishIds = new Set<number>();

  for (const hit of globalHits) {
    const dishes = await getDishesByIds(hit.dishIds);
    if (dishes.length !== hit.dishIds.length) continue;

    const tasteScore = dishes.reduce(
      (sum, d) => sum + scoreDishForTaste(d, taste, d.ingredient_name ?? ""),
      0
    );
    if (tasteScore < MIN_TASTE_SCORE) continue;

    hit.dishIds.forEach((id) => usedDishIds.add(id));
    globalCombos.push({
      id: `combo-global-${hit.id}`,
      name: hit.comboName,
      dishIds: hit.dishIds,
      subComponents: hit.subComponents,
      dishes: dishes.map(parseDishRow),
      staple: "Rice",
      rationale: `Popular combo — picked ${hit.selectionCount} times`,
      source: "global_pool",
      popularCount: hit.selectionCount,
      globalComboId: hit.id,
    });
  }

  const slotsNeeded = SLOTS_REQUESTED - globalCombos.length;
  let generated: BuiltCombo[] = [];

  if (slotsNeeded > 0) {
    generated = await buildCombosFromCatalog({
      ...params,
      excludeDishIds: [...usedDishIds],
      maxCombos: slotsNeeded,
    });
  }

  const combos = [...globalCombos, ...generated].slice(0, SLOTS_REQUESTED);

  await insertGenerationSession({
    id: sessionId,
    userId: params.userId,
    ingredientSignature: signature,
    ingredients: params.ingredients,
    comboRules: params.rules,
    category: params.category,
    slotsRequested: SLOTS_REQUESTED,
    slotsFromGlobal: globalCombos.length,
    slotsGenerated: generated.length,
  });

  for (let i = 0; i < combos.length; i++) {
    await insertComboCandidate({
      id: `cand-${sessionId}-${i}`,
      sessionId,
      comboName: combos[i].name,
      dishIds: combos[i].dishIds,
      source: combos[i].source,
      globalComboId: combos[i].globalComboId,
      rank: i + 1,
      rationale: combos[i].rationale,
    });
  }

  return { combos, sessionId };
}
