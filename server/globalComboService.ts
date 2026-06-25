import { buildIngredientSignature } from "./db/ingredientSignature";
import { getPopularCombos } from "./db/globalCombos";
import { getDishesByIds, getTasteProfile, getUserProfile, parseDishRow } from "./db";
import { buildCombosFromCatalog, BuiltCombo, scoreDishForTaste, MIN_COMBOS, MAX_COMBOS } from "./comboBuilder";
import { insertGenerationSession, insertComboCandidate } from "./db/events";

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
    limit: MAX_COMBOS,
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

  let combos = [...globalCombos];

  if (combos.length < MAX_COMBOS) {
    const generated = await buildCombosFromCatalog({
      ...params,
      excludeDishIds: [...usedDishIds],
      maxCombos: MAX_COMBOS - combos.length,
    });
    for (const combo of generated) {
      combo.dishIds.forEach((id) => usedDishIds.add(id));
    }
    combos.push(...generated);
  }

  if (combos.length < MIN_COMBOS) {
    const extra = await buildCombosFromCatalog({
      ...params,
      excludeDishIds: [],
      maxCombos: MIN_COMBOS - combos.length,
    });
    combos.push(...extra);
  }

  combos = combos.slice(0, MAX_COMBOS);

  await insertGenerationSession({
    id: sessionId,
    userId: params.userId,
    ingredientSignature: signature,
    ingredients: params.ingredients,
    comboRules: params.rules,
    category: params.category,
    slotsRequested: MAX_COMBOS,
    slotsFromGlobal: globalCombos.length,
    slotsGenerated: combos.length - globalCombos.length,
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
