import { useState, FormEvent, useEffect } from "react";
import {
  Plus,
  X,
  ChefHat,
  Clock,
  Youtube,
  Search,
  ThumbsUp,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { BuiltComboOption, Meal } from "../types";

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
  const [inputValue, setInputValue] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<"Breakfast" | "Lunch" | "Dinner">("Lunch");
  const [customRules, setCustomRules] = useState(
    () => localStorage.getItem("vigadi_custom_rules") || "Tamil Nadu rules: 1 Kulambu, 2 Sides"
  );

  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);
  const [buildError, setBuildError] = useState<string | null>(null);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [builtCombos, setBuiltCombos] = useState<BuiltComboOption[]>([]);
  const [selectedComboId, setSelectedComboId] = useState<string | null>(null);
  const [tasteSummaries, setTasteSummaries] = useState<string[]>([]);

  const activeTags = tags.filter((t) => t.toLowerCase() !== "rice");

  const applyCatalogResponse = (data: {
    totalDishes?: number;
  }) => {
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
  }, []);

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

  const handleAddTag = (e: FormEvent) => {
    e.preventDefault();
    const cleanVal = inputValue.trim();
    if (!cleanVal || cleanVal.toLowerCase() === "rice") return;
    const formatted = cleanVal.charAt(0).toUpperCase() + cleanVal.slice(1);
    if (!tags.includes(formatted)) setTags([...tags, formatted]);
    setInputValue("");
  };

  const handleRemoveTag = (tag: string) => setTags(tags.filter((t) => t !== tag));

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
          category: selectedSlot,
          rules: customRules,
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
      if (!res.ok) throw new Error("Discovery failed. Check server connection.");
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
      category: selectedSlot,
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

        <form onSubmit={handleAddTag} className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Fish, potato, green jaal..."
            className="flex-1 bg-cream border border-matcha py-2.5 px-3.5 rounded-xl text-espresso text-xs focus:outline-hidden focus:ring-1 focus:ring-sage/60"
          />
          <button type="submit" className="bg-espresso text-cream px-3.5 rounded-xl cursor-pointer">
            <Plus className="w-4 h-4" />
          </button>
        </form>

        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-cream border border-matcha text-[11px] font-semibold">
              {tag}
              <button type="button" onClick={() => handleRemoveTag(tag)} className="text-espresso/40 hover:text-red-500 cursor-pointer">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          <span className="inline-flex items-center px-2.5 py-1.5 rounded-lg bg-[#E0E7DC] border border-matcha text-[11px] font-bold text-espresso/80">
            Rice (staple)
          </span>
        </div>

        <div className="space-y-1.5 pt-1 border-t border-matcha/10">
          <label className="text-[10px] font-mono uppercase tracking-wider text-espresso/50 font-bold">Meal slot</label>
          <div className="grid grid-cols-3 gap-2 bg-[#F1F3ED] p-1 rounded-xl border border-matcha/20">
            {(["Breakfast", "Lunch", "Dinner"] as const).map((slot) => (
              <button
                key={slot}
                type="button"
                onClick={() => setSelectedSlot(slot)}
                className={`py-2 rounded-lg text-xs font-bold cursor-pointer ${
                  selectedSlot === slot ? "bg-espresso text-cream" : "text-espresso/70"
                }`}
              >
                {slot}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-mono uppercase tracking-wider text-espresso/50 font-bold">Combo rules</label>
          <select
            value={customRules}
            onChange={(e) => {
              setCustomRules(e.target.value);
              localStorage.setItem("vigadi_custom_rules", e.target.value);
            }}
            className="w-full bg-[#F1F3ED] border border-matcha/30 px-3 py-2.5 rounded-xl text-xs font-semibold text-espresso cursor-pointer"
          >
            <option value="Tamil Nadu rules: 1 Kulambu, 2 Sides">1 Kulambu + 2 Sides (Tamil Nadu)</option>
            <option value="Kerala style: 1 Thoran, 1 Curry">1 Curry + 1 Thoran (Kerala)</option>
            <option value="Classic homestyle: 1 Gravy, 1 Dry fry">1 Gravy + 1 Dry fry</option>
            <option value="High protein: 1 main source, 1 boiled starch, minimal oil">High protein plate</option>
          </select>
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
            {builtCombos.map((combo, idx) => {
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
                        {combo.source === "global_pool" && combo.popularCount != null && combo.popularCount > 0 && (
                          <span className="text-[9px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-semibold">
                            Popular · {combo.popularCount} picks
                          </span>
                        )}
                      </div>
                      <h4 className="font-display font-bold text-espresso text-md">{combo.name}</h4>
                      <p className="text-[11px] text-espresso/60 mt-0.5">{combo.rationale}</p>
                    </div>
                    {isSelected && <CheckCircle2 className="w-5 h-5 text-[#2E9D70] shrink-0" />}
                  </div>

                  <div className="space-y-1.5">
                    {combo.dishes.map((dish) => (
                      <div key={dish.id} className="flex items-center justify-between py-1.5 border-b border-matcha/10 last:border-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#2E9D70] shrink-0" />
                          <span className="text-xs font-medium text-espresso truncate">{dish.name}</span>
                          <span className="text-[9px] text-espresso/40 font-mono shrink-0">({dish.dishType})</span>
                        </div>
                        {dish.youtubeUrl && (
                          <a href={dish.youtubeUrl} target="_blank" rel="noreferrer" className="text-red-600 shrink-0">
                            <Youtube className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    ))}
                    <div className="flex items-center gap-2 text-[10px] text-espresso/50 font-mono pt-1">
                      <Clock className="w-3 h-3" /> ~45 min · + {combo.staple}
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
        )}
      </div>

      {/* Taste profile learned */}
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
    </div>
  );
}
