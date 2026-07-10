import { useState, useEffect, useCallback, useMemo } from "react";
import {
  X,
  ChefHat,
  Clock,
  Youtube,
  Search,
  ThumbsUp,
  CheckCircle2,
  RefreshCw,
  Settings2,
  Sparkles,
  Trash2,
  Pencil,
} from "lucide-react";
import { BuiltComboOption, Meal, MealTemplate } from "../types";
import {
  formatTemplatePreview,
  inferDefaultMealSlot,
  mealSlotFromUi,
  normalizeTemplate,
  pickAutoTemplate,
  templateHasMealSlot,
  templateMealsLabel,
  templatePrimaryMealSlot,
  uiSlotFromMealSlot,
  formatMealSlotLabel,
  prepareTemplateForSave,
  templateMealSlots,
} from "../../shared/mealTemplates";
import IngredientAutocomplete from "./IngredientAutocomplete";
import TemplateBuilder from "./TemplateBuilder";

interface KitchenViewProps {
  onSelectMeal: (meal: Meal) => void;
  onSelectCreatedMeals: (meals: Meal[]) => void;
}

const USER_ID_KEY = "vigadi_user_id";
const USERNAME_KEY = "vigadi_username";

function getUserId() {
  let id = localStorage.getItem(USER_ID_KEY);
  if (!id) {
    id = `user-${Date.now()}`;
    localStorage.setItem(USER_ID_KEY, id);
  }
  return id;
}

function getUsername() {
  return localStorage.getItem(USERNAME_KEY) || "Guest";
}

export default function KitchenView({ onSelectMeal, onSelectCreatedMeals }: KitchenViewProps) {
  const [tags, setTags] = useState<string[]>(["Potato", "Fish", "Chicken", "Tomato"]);

  const [templates, setTemplates] = useState<MealTemplate[]>([]);
  const [matchingTemplates, setMatchingTemplates] = useState<MealTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [autoTemplateId, setAutoTemplateId] = useState<string | null>(null);
  const [activeMealSlot, setActiveMealSlot] = useState<"Breakfast" | "Lunch" | "Dinner">(
    uiSlotFromMealSlot(inferDefaultMealSlot())
  );
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [templateToEdit, setTemplateToEdit] = useState<MealTemplate | null>(null);
  const [generationScope, setGenerationScope] = useState<"full_day" | "single_meal">("full_day");

  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);
  const [buildError, setBuildError] = useState<string | null>(null);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [builtCombos, setBuiltCombos] = useState<BuiltComboOption[]>([]);
  const [selectedComboId, setSelectedComboId] = useState<string | null>(null);
  const [tasteSummaries, setTasteSummaries] = useState<string[]>([]);

  const activeTags = tags.filter((t) => t.toLowerCase() !== "rice");
  const includesRice = tags.some((t) => t.toLowerCase() === "rice");
  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);
  const templateMeals = selectedTemplate ? templateMealSlots(normalizeTemplate(selectedTemplate)) : [];
  const effectiveSlot =
    selectedTemplate && templateHasMealSlot(selectedTemplate, mealSlotFromUi(activeMealSlot))
      ? activeMealSlot
      : selectedTemplate
        ? uiSlotFromMealSlot(templatePrimaryMealSlot(selectedTemplate))
        : activeMealSlot;

  const loadTemplates = useCallback(async () => {
    try {
      const res = await fetch(`/api/templates/${getUserId()}`);
      if (!res.ok) return;
      const data = await res.json();
      const all = data.templates || [];
      setTemplates(all);
      setMatchingTemplates(all);

      if (all.length === 0) {
        setSelectedTemplateId(null);
        setAutoTemplateId(null);
        return;
      }

      const defaultSlot = inferDefaultMealSlot();
      const auto =
        all.find((t: MealTemplate) => templateHasMealSlot(t, defaultSlot)) ?? all[0];

      if (auto?.id) {
        setAutoTemplateId(auto.id);
        setSelectedTemplateId((prev) => {
          if (prev && all.some((t: MealTemplate) => t.id === prev)) return prev;
          return auto.id;
        });
      }
    } catch {
      /* ignore */
    }
  }, []);

  const applyCatalogResponse = (data: { totalDishes?: number }) => {
    setCatalogTotal(data.totalDishes || 0);
  };

  const loadCatalogFromDb = async (ingredientList: string[]) => {
    if (ingredientList.length === 0) return;
    try {
      const res = await fetch(
        `/api/catalog/dishes?ingredients=${encodeURIComponent(ingredientList.join(","))}`
      );
      if (!res.ok) return;
      const data = await res.json();
      if ((data.totalDishes || 0) > 0) {
        applyCatalogResponse({ ...data, fromCache: true });
      }
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    fetchTasteProfile();
    loadCatalogFromDb(activeTags);
    loadTemplates();
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const fetchTasteProfile = async () => {
    try {
      const res = await fetch(`/api/taste/${getUserId()}`);
      if (res.ok) {
        const data = await res.json();
        setTasteSummaries(data.summaries || []);
      }
    } catch {
      /* ignore */
    }
  };

  const handleAddIngredient = (canonical: string) => {
    if (!canonical) return;
    const normalized = canonical.trim();
    if (!normalized) return;
    const exists = tags.some((t) => t.toLowerCase() === normalized.toLowerCase());
    if (!exists) setTags([...tags, normalized.charAt(0).toUpperCase() + normalized.slice(1)]);
  };

  const handleRemoveTag = (tag: string) => setTags(tags.filter((t) => t !== tag));

  const saveTemplate = async (template: MealTemplate): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await fetch(`/api/templates/${getUserId()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { ok: false, error: err.error || `Save failed (${res.status})` };
      }
      const data = await res.json();
      setTemplates(data.templates || []);
      setMatchingTemplates((prev) => {
        const exists = prev.some((t) => t.id === template.id);
        if (exists) return prev.map((t) => (t.id === template.id ? template : t));
        return [...prev, template];
      });
      setSelectedTemplateId(template.id);
      setAutoTemplateId(null);
      await loadTemplates();
      return { ok: true };
    } catch {
      return { ok: false, error: "Network error — check your connection." };
    }
  };

  const duplicateTemplate = async (templateId: string) => {
    const res = await fetch(`/api/templates/${getUserId()}/${templateId}/duplicate`, {
      method: "POST",
    });
    if (res.ok) {
      const data = await res.json();
      setTemplates(data.templates || []);
    }
  };

  const deleteTemplate = async (templateId: string) => {
    const res = await fetch(`/api/templates/${getUserId()}/${templateId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      const data = await res.json();
      setTemplates(data.templates || []);
      if (selectedTemplateId === templateId) {
        setSelectedTemplateId(null);
        setAutoTemplateId(null);
      }
      await loadTemplates();
      return true;
    }
    return false;
  };

  const handleDeleteSelectedTemplate = async () => {
    if (!selectedTemplateId || !selectedTemplate) return;
    const confirmed = window.confirm(`Delete "${selectedTemplate.name}"? This cannot be undone.`);
    if (!confirmed) return;
    await deleteTemplate(selectedTemplateId);
  };

  const handleSelectTemplate = (tpl: MealTemplate) => {
    setSelectedTemplateId(tpl.id);
    setAutoTemplateId(null);
    const meals = templateMealSlots(normalizeTemplate(tpl));
    if (meals.length > 1) setGenerationScope("full_day");
    const preferred = mealSlotFromUi(activeMealSlot);
    if (!meals.includes(preferred) && meals.length > 0) {
      setActiveMealSlot(uiSlotFromMealSlot(meals[0]));
    }
  };

  const buildCombosFromCatalog = async () => {
    setIsBuilding(true);
    setBuildError(null);
    setBuiltCombos([]);
    setSelectedComboId(null);
    try {
      const res = await fetch("/api/combos/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ingredients: activeTags,
          category: effectiveSlot,
          templateId: selectedTemplateId,
          includesRice,
          generateAllTemplateMeals:
            generationScope === "full_day" && !!selectedTemplate && templateMeals.length > 1,
          userId: getUserId(),
          username: getUsername(),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Combo build failed.");
      }
      const data = await res.json();
      setBuiltCombos(data.combos || []);
      if (data.template?.id) setSelectedTemplateId(data.template.id);
      if (data.meals?.length) onSelectCreatedMeals(data.meals);
    } catch (err: any) {
      setBuildError(err.message || "Could not build combos from catalog.");
    } finally {
      setIsBuilding(false);
    }
  };

  const handleDiscoverDishes = async (forceRefresh = false) => {
    setIsDiscovering(true);
    setDiscoveryError(null);
    setBuildError(null);
    if (forceRefresh) setCatalogTotal(0);
    setBuiltCombos([]);
    setSelectedComboId(null);
    try {
      const res = await fetch("/api/catalog/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ingredients: activeTags,
          userId: getUserId(),
          username: getUsername(),
          forceRefresh,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Discovery failed. Check server connection.");
      }
      const data = await res.json();
      applyCatalogResponse(data);
      if ((data.totalDishes || 0) > 0) {
        await buildCombosFromCatalog();
      } else {
        setBuildError("No dishes found for your ingredients. Try different items.");
      }
    } catch (err: any) {
      setDiscoveryError(err.message || "Could not discover YouTube dishes.");
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleSelectCombo = async (combo: BuiltComboOption) => {
    const rejected = builtCombos.find((c) => c.id !== combo.id);
    setSelectedComboId(combo.id);

    try {
      await fetch("/api/combos/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: getUserId(),
          username: getUsername(),
          selectedComboId: combo.id,
          selectedDishIds: combo.dishIds,
          comboName: combo.name,
          rejectedComboId: rejected?.id,
          rejectedDishIds: rejected?.dishIds,
        }),
      });
      await fetchTasteProfile();
    } catch {
      /* selection still shown locally */
    }

    const meal: Meal = {
      id: combo.id,
      recipeName: combo.name,
      prepTime: "45 min",
      category: effectiveSlot,
      macros: { carbs: 54, protein: 32, fat: 14, calories: 480 },
      rating: 4.8,
      difficulty: "Medium",
      servings: 2,
      image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80",
      tagline: combo.rationale,
      subComponents: combo.subComponents,
      ingredients: combo.dishes.flatMap((d) => d.mainIngredients),
      steps: combo.dishes.map((d) => `Cook ${d.name} using the YouTube tutorial.`),
      nutritionFact: combo.rationale,
      matchedIngredients: combo.dishes.map((d) => d.ingredientName).filter(Boolean) as string[],
      youtubeLinks: Object.fromEntries(
        combo.dishes.filter((d) => d.youtubeUrl).map((d) => [d.name, d.youtubeUrl!])
      ),
      videoCount: combo.dishes.length,
    };
    onSelectMeal(meal);
  };

  const isWorking = isDiscovering || isBuilding;
  const chipsToShow = matchingTemplates.length > 0 ? matchingTemplates : templates;
  const comboGroups = useMemo(() => {
    const hasMealLabels = builtCombos.some((combo) => combo.mealLabel);
    if (!hasMealLabels) return [{ label: null as string | null, combos: builtCombos }];
    const groups = new Map<string, BuiltComboOption[]>();
    for (const combo of builtCombos) {
      const label = combo.mealLabel || "Menu";
      const current = groups.get(label) ?? [];
      current.push(combo);
      groups.set(label, current);
    }
    return [...groups.entries()].map(([label, combos]) => ({ label, combos }));
  }, [builtCombos]);

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="space-y-1">
        <h1 className="text-3xl font-display font-bold text-espresso tracking-tight leading-tight">
          Vígadi<br />Kitchen Hub
        </h1>
      </div>

      <div className="bg-cream border border-matcha p-5 rounded-[28px] space-y-4 shadow-xs">
        <h3 className="text-xs font-mono uppercase tracking-wider text-espresso font-bold">
          Your ingredients
        </h3>

        <div className="flex gap-2">
          <IngredientAutocomplete
            onSelect={handleAddIngredient}
            placeholder="kathirikai, brinjal, sorakkai…"
            disabled={isWorking}
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-cream border border-matcha text-[11px] font-semibold">
              {tag}
              <button type="button" onClick={() => handleRemoveTag(tag)} className="text-espresso/40 hover:text-red-500 cursor-pointer">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          {!includesRice && (
            <button
              type="button"
              onClick={() => handleAddIngredient("Rice")}
              disabled={isWorking}
              className="inline-flex items-center px-2.5 py-1.5 rounded-lg border border-dashed border-matcha/50 text-[11px] font-bold text-espresso/50 hover:border-[#2E9D70] hover:text-[#2E9D70] cursor-pointer disabled:opacity-50"
            >
              + Rice
            </button>
          )}
        </div>

        <div className="space-y-2 pt-1 border-t border-matcha/10">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-mono uppercase tracking-wider text-espresso/50 font-bold">
              Meal template
            </label>
            <div className="flex items-center gap-2">
              {selectedTemplate && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setTemplateToEdit(selectedTemplate);
                      setShowTemplateManager(true);
                    }}
                    className="text-[10px] font-mono uppercase text-bakedclay font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Pencil className="w-3 h-3" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteSelectedTemplate}
                    className="text-[10px] font-mono uppercase text-red-500 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    Delete
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => {
                  setTemplateToEdit(null);
                  setShowTemplateManager(true);
                }}
                className="text-[10px] font-mono uppercase text-bakedclay font-bold flex items-center gap-1 cursor-pointer"
              >
                <Settings2 className="w-3 h-3" />
                Manage
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {chipsToShow.length === 0 ? (
              <p className="text-[11px] text-espresso/60 italic">
                No templates yet — tap Manage to create your first one.
              </p>
            ) : (
              chipsToShow.map((tpl) => {
              const isSelected = selectedTemplateId === tpl.id;
              const isAuto = autoTemplateId === tpl.id;
              const slotLabel = templateMealsLabel(tpl);
              return (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => handleSelectTemplate(tpl)}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold cursor-pointer border ${
                    isSelected
                      ? "bg-espresso text-cream border-espresso"
                      : "bg-[#F1F3ED] text-espresso/80 border-matcha/20"
                  }`}
                >
                  {isAuto && isSelected && (
                    <span className="inline-flex items-center gap-0.5 text-[8px] font-mono uppercase bg-[#2E9D70] text-white px-1.5 py-0.5 rounded-full">
                      <Sparkles className="w-2.5 h-2.5" />
                      Auto
                    </span>
                  )}
                  <span>{tpl.name}</span>
                  <span className={`text-[8px] font-mono uppercase ${isSelected ? "text-cream/70" : "text-espresso/40"}`}>
                    {slotLabel}
                  </span>
                </button>
              );
            })
            )}
          </div>

          {selectedTemplate && (
            <div className="space-y-2">
              {templateMeals.length > 1 && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-espresso/50 font-bold">
                    Generate
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setGenerationScope("full_day")}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer ${
                        generationScope === "full_day"
                          ? "bg-espresso text-cream"
                          : "bg-[#F1F3ED] text-espresso/70 border border-matcha/20"
                      }`}
                    >
                      Full day
                    </button>
                    <button
                      type="button"
                      onClick={() => setGenerationScope("single_meal")}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer ${
                        generationScope === "single_meal"
                          ? "bg-espresso text-cream"
                          : "bg-[#F1F3ED] text-espresso/70 border border-matcha/20"
                      }`}
                    >
                      Just one meal
                    </button>
                  </div>
                  {generationScope === "single_meal" && (
                    <>
                      <label className="text-[10px] font-mono uppercase tracking-wider text-espresso/50 font-bold">
                        Cooking now
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {templateMeals.map((ms) => {
                          const label = formatMealSlotLabel(ms);
                          const isActive = effectiveSlot === label;
                          return (
                            <button
                              key={ms}
                              type="button"
                              onClick={() => setActiveMealSlot(label)}
                              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer ${
                                isActive
                                  ? "bg-espresso text-cream"
                                  : "bg-[#F1F3ED] text-espresso/70 border border-matcha/20"
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                  <p className="text-[10px] text-espresso/50">
                    {generationScope === "full_day"
                      ? `Discover builds breakfast and lunch together from your template.`
                      : `Generating for ${effectiveSlot} only.`}
                  </p>
                </div>
              )}
              <p className="text-[11px] text-espresso/60 bg-[#F1F3ED] rounded-lg px-3 py-2">
                {formatTemplatePreview(selectedTemplate)}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white border border-matcha p-5 rounded-[28px] space-y-4 shadow-xs">
        <h3 className="text-xs font-mono uppercase tracking-wider text-espresso font-bold">
          Discover dishes on YouTube
        </h3>

        {discoveryError && (
          <div className="bg-red-50 border border-red-200 text-xs text-red-700 p-3 rounded-xl">{discoveryError}</div>
        )}

        {buildError && (
          <div className="bg-red-50 border border-red-200 text-xs text-red-700 p-3 rounded-xl">{buildError}</div>
        )}

        {builtCombos.length === 0 && (
          <div className="flex gap-2">
            <button
              onClick={() => handleDiscoverDishes(false)}
              disabled={isWorking || activeTags.length === 0}
              className="flex-1 bg-[#2E9D70] hover:bg-[#208359] text-white py-3 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isWorking ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {isDiscovering ? "Discovering dishes..." : "Building your menu..."}
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  Discover dishes
                </>
              )}
            </button>
            {catalogTotal > 0 && (
              <button
                onClick={() => handleDiscoverDishes(true)}
                disabled={isWorking}
                title="Force refresh from YouTube"
                className="bg-cream border border-matcha text-espresso px-3 rounded-xl hover:bg-matcha/20 disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {builtCombos.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-mono uppercase tracking-wider text-espresso font-bold">
                Your menu
              </h3>
              <button
                onClick={() => handleDiscoverDishes(false)}
                disabled={isWorking}
                title="Discover again"
                className="text-[10px] font-mono uppercase text-espresso/50 hover:text-espresso flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className="w-3 h-3" />
                Rediscover
              </button>
            </div>
            <p className="text-[10px] font-mono uppercase text-espresso/50 font-bold">Pick your plate — feedback updates your taste profile</p>
            {comboGroups.map((group) => (
              <div key={group.label ?? "menu"} className="space-y-3">
                {group.label && (
                  <h4 className="text-[10px] font-mono uppercase tracking-wider text-bakedclay font-bold">
                    {group.label}
                  </h4>
                )}
                {group.combos.map((combo, idx) => {
              const isSelected = selectedComboId === combo.id;
              return (
                <div
                  key={combo.id}
                  className={`border-2 rounded-[22px] p-4 space-y-3 transition-all ${
                    isSelected ? "border-[#2E9D70] bg-[#2E9D70]/5" : "border-matcha/30 bg-cream"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[9px] font-mono font-bold text-bakedclay uppercase">Option {idx + 1}</span>
                        {combo.mealLabel && (
                          <span className="text-[9px] bg-espresso/10 text-espresso/70 px-2 py-0.5 rounded-full font-mono">
                            {combo.mealLabel}
                          </span>
                        )}
                        {combo.source === "global_pool" && combo.popularCount != null && combo.popularCount > 0 && (
                          <span className="text-[9px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-semibold">
                            Popular · {combo.popularCount} picks
                          </span>
                        )}
                        {combo.templatePreview && (
                          <span className="text-[9px] bg-matcha/30 text-espresso/70 px-2 py-0.5 rounded-full font-mono">
                            {combo.templatePreview}
                          </span>
                        )}
                      </div>
                      <h4 className="font-display font-bold text-espresso text-md">{combo.name}</h4>
                      <p className="text-[11px] text-espresso/60 mt-0.5">{combo.rationale}</p>
                    </div>
                    {isSelected && <CheckCircle2 className="w-5 h-5 text-[#2E9D70] shrink-0" />}
                  </div>

                  {combo.unfilledSlots && combo.unfilledSlots.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 space-y-1">
                      <p className="text-[9px] font-mono uppercase text-amber-800 font-bold">Unfilled slots</p>
                      {combo.unfilledSlots.map((slot, i) => (
                        <p key={i} className="text-[11px] text-amber-900">
                          {slot.suggestion || `Need more ${slot.category} dishes`}
                        </p>
                      ))}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    {combo.dishes.map((dish) => (
                      <div key={dish.id} className="flex items-center justify-between py-1.5 border-b border-matcha/10 last:border-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#2E9D70] shrink-0" />
                          <span className="text-xs font-medium text-espresso truncate">{dish.name}</span>
                          <span className="text-[9px] text-espresso/40 font-mono shrink-0">
                            ({dish.dishCategory || dish.dishType})
                          </span>
                        </div>
                        {dish.youtubeUrl && (
                          <a href={dish.youtubeUrl} target="_blank" rel="noreferrer" className="text-red-600 shrink-0">
                            <Youtube className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    ))}
                    <div className="flex items-center gap-2 text-[10px] text-espresso/50 font-mono pt-1">
                      <Clock className="w-3 h-3" /> ~45 min
                      {combo.staple ? ` · + ${combo.staple}` : ""}
                    </div>
                  </div>

                  <button
                    onClick={() => handleSelectCombo(combo)}
                    className={`w-full py-2.5 rounded-xl text-xs font-bold cursor-pointer flex items-center justify-center gap-2 ${
                      isSelected
                        ? "bg-[#2E9D70] text-white"
                        : "bg-espresso text-cream hover:bg-espresso/90"
                    }`}
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                    {isSelected ? "Selected — taste profile updated" : "Choose this combo"}
                  </button>
                </div>
              );
            })}
              </div>
            ))}
          </div>
        )}
      </div>

      {tasteSummaries.length > 0 && (
        <div className="bg-sage/20 border border-sage/40 p-4 rounded-2xl space-y-2">
          <h4 className="text-[10px] font-mono uppercase text-sage font-bold">Your learned taste</h4>
          <ul className="space-y-1">
            {tasteSummaries.map((s, i) => (
              <li key={i} className="text-[11px] text-espresso/80">• {s}</li>
            ))}
          </ul>
        </div>
      )}

      {builtCombos.length === 0 && catalogTotal === 0 && !isWorking && (
        <div className="bg-[#F8F9FA] border border-dashed border-matcha/40 py-10 px-4 rounded-[22px] text-center">
          <ChefHat className="w-8 h-8 text-espresso/30 mx-auto mb-2" />
          <p className="text-xs font-medium text-espresso/70">Add ingredients and tap Discover dishes to get your menu.</p>
        </div>
      )}

      {showTemplateManager && (
        <TemplateBuilder
          templates={templates}
          editing={templateToEdit}
          onSave={saveTemplate}
          onDuplicate={duplicateTemplate}
          onDelete={deleteTemplate}
          onClose={() => {
            setShowTemplateManager(false);
            setTemplateToEdit(null);
            loadTemplates();
          }}
        />
      )}
    </div>
  );
}
