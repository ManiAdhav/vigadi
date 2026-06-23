import { useState, FormEvent, useEffect } from "react";
import { Plus, X, Sparkles, ChefHat, Clock, Youtube, BookOpen } from "lucide-react";
import { Meal } from "../types";

interface KitchenViewProps {
  meals: Meal[];
  onSelectMeal: (meal: Meal) => void;
  onSelectCreatedMeals: (meals: Meal[]) => void;
}

export default function KitchenView({ meals, onSelectMeal, onSelectCreatedMeals }: KitchenViewProps) {
  // Main ingredient tag list variables
  const [tags, setTags] = useState<string[]>([
    "Potato",
    "Brinjal",
    "Egg",
    "Beans",
    "Chicken"
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Settings & slot controls
  const [selectedSlot, setSelectedSlot] = useState<"Breakfast" | "Lunch" | "Dinner">("Lunch");
  const [customRules, setCustomRules] = useState(() => {
    return localStorage.getItem("vigadi_custom_rules") || "Tamil Nadu rules: 1 Kulambu, 2 Sides";
  });
  const [customRulesInput, setCustomRulesInput] = useState("");
  const [isCustomEditing, setIsCustomEditing] = useState(false);

  // Accordion controller state: holds the single expanded combo ID. Default to null for compact mode.
  const [expandedComboId, setExpandedComboId] = useState<string | null>(null);

  // Feedback synchronization values for ratings
  const [feedbackLogs, setFeedbackLogs] = useState<any[]>([]);
  const [feedbackRating, setFeedbackRating] = useState<Record<string, "up" | "down">>({});

  const REGIONAL_RULES_PRESETS = [
    { name: "Tamil Nadu Customs", rule: "Tamil Nadu rules: 1 Kulambu, 2 Sides" },
    { name: "Kerala Customs", rule: "Kerala style: 1 Thoran, 1 Curry" },
    { name: "Classic Comfort", rule: "Classic homestyle: 1 Gravy, 1 Dry fry" },
    { name: "Samoa Tiffin", rule: "High protein: 1 main source, 1 boiled starch, minimal oil" }
  ];

  const fetchFeedbacks = async () => {
    try {
      const res = await fetch("/api/learning/feedback");
      if (res.ok) {
        const data = await res.json();
        setFeedbackLogs(data.feedback || []);
        const ratingsMap: Record<string, "up" | "down"> = {};
        data.feedback?.forEach((item: any) => {
          ratingsMap[item.mealId] = item.thumb;
        });
        setFeedbackRating(ratingsMap);
      }
    } catch (e) {
      console.error("Failed to load backend ratings feedback logs:", e);
    }
  };

  useEffect(() => {
    fetchFeedbacks();
    // Synchronize current rules immediately when mounting / loading
    const savedRules = localStorage.getItem("vigadi_custom_rules");
    if (savedRules) {
      setCustomRules(savedRules);
    }
  }, []);

  const activeTags = [...tags, "Rice"];

  // Tag creation methods
  const handleAddTag = (e: FormEvent) => {
    e.preventDefault();
    const cleanVal = inputValue.trim();
    if (!cleanVal) return;
    
    if (cleanVal.toLowerCase() === "rice") {
      setInputValue("");
      return;
    }

    const formattedVal = cleanVal.charAt(0).toUpperCase() + cleanVal.slice(1);
    if (!tags.includes(formattedVal)) {
      setTags([...tags, formattedVal]);
    }
    setInputValue("");
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const mealsInSlot = meals.filter(
    meal => meal.category?.toLowerCase() === selectedSlot.toLowerCase()
  );

  const sortedMatches = mealsInSlot
    .map(meal => {
      const mealIngs = meal.matchedIngredients || [];
      const matchedCount = mealIngs.filter(ing => 
        activeTags.some(tag => tag.toLowerCase() === ing.toLowerCase())
      ).length;
      return { meal, score: matchedCount };
    })
    .sort((a, b) => b.score - a.score || (b.meal.rating || 0) - (a.meal.rating || 0));

  const actualMatchCount = sortedMatches.filter(item => item.score > 0).length;

  // Handle slot changes cleanly, keeping combos collapsed in compact feed view by default
  const handleSelectSlotChange = (slot: "Breakfast" | "Lunch" | "Dinner") => {
    setSelectedSlot(slot);
    setExpandedComboId(null);
  };

  // Trigger combo custom recipe generation
  const handleGenerateCustomAICombo = async () => {
    setIsGenerating(true);
    setGenerationError(null);
    try {
      const response = await fetch("/api/combos/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ingredients: activeTags,
          category: selectedSlot,
          rules: customRules
        })
      });
      if (!response.ok) {
        throw new Error("Generative server returned an error compiling custom plates.");
      }
      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }
      
      if (data.combos && Array.isArray(data.combos)) {
        onSelectCreatedMeals(data.combos);
        if (data.combos.length > 0) {
          setExpandedComboId(data.combos[0].id);
        }
      } else {
        onSelectCreatedMeals([data]);
        setExpandedComboId(data.id);
      }
      fetchFeedbacks();
    } catch (err: any) {
      console.error(err);
      setGenerationError(err.message || "Failed to access combination suggestions. Verify connection.");
    } finally {
      setIsGenerating(false);
    }
  };

  const currentLikedCount = feedbackLogs.filter(f => f.thumb === "up").length;
  const currentDislikedCount = feedbackLogs.filter(f => f.thumb === "down").length;

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Title Header without "engines" jargon */}
      <div className="space-y-2">
        <h1 className="text-3xl font-display font-bold text-espresso tracking-tight leading-tight">
          Vígadi<br />Kitchen Hub
        </h1>
      </div>

      {/* CUSTOM PLAYER RULES & INGREDIENT PICKERS */}
      <div className="bg-cream border border-matcha p-5 rounded-[28px] space-y-5 shadow-xs relative">
        <div className="space-y-1">
          <h3 className="text-xs font-mono uppercase tracking-wider text-espresso font-bold">
            Recipe Guidelines & Ingredients
          </h3>
        </div>

        {/* 1. First Ingredients Add section */}
        <div className="space-y-3 pt-1">
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono uppercase tracking-wider text-espresso/50 font-bold block">
              1. Include Vegetable/Ingredient Tags
            </label>
            <form onSubmit={handleAddTag} className="relative flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="e.g. Potato, Onion, Beans..."
                className="flex-1 bg-cream border border-matcha py-2.5 px-3.5 rounded-xl text-espresso font-medium text-xs focus:outline-hidden focus:ring-1 focus:ring-sage/60 transition-all"
                id="kitchen-add-input"
              />
              <button
                type="submit"
                className="bg-espresso text-cream px-3.5 rounded-xl hover:bg-espresso/90 active:scale-95 transition-all shadow-xs cursor-pointer"
                id="add-tag-action-btn"
              >
                <Plus className="w-4 h-4" />
              </button>
            </form>
          </div>

          {/* Selected tag pills block */}
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-cream border border-matcha text-[11px] font-semibold text-espresso shadow-xs hover:bg-[#E05C38]/10 hover:border-red-200 transition-colors"
              >
                <span className="w-1 h-1 rounded-full bg-[#2E9D70]" />
                {tag}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className="text-espresso/40 hover:text-[#E05C38] rounded-full focus:outline-hidden transition-colors cursor-pointer"
                >
                  <X className="w-3 h-3 stroke-[2.5]" />
                </button>
              </span>
            ))}

            <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#E0E7DC] border border-matcha text-[11px] font-bold text-espresso/80">
              <span className="w-1 h-1 rounded-full bg-amber-500" />
              Rice (Staple)
            </span>
          </div>
        </div>

        {/* 2. Next: Meal category slots selection */}
        <div className="space-y-1.5 pt-1 border-t border-matcha/10">
          <label className="text-[10px] font-mono uppercase tracking-wider text-espresso/50 font-bold block">
            2. Meal Slot Category
          </label>
          <div className="grid grid-cols-3 gap-2 bg-[#F1F3ED] p-1 rounded-xl border border-matcha/20">
            {(["Breakfast", "Lunch", "Dinner"] as const).map((slot) => {
              const isActive = selectedSlot === slot;
              return (
                <button
                  key={slot}
                  type="button"
                  onClick={() => handleSelectSlotChange(slot)}
                  className={`py-2 px-1 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer ${
                    isActive
                      ? "bg-espresso text-cream shadow-sm"
                      : "text-espresso/70 hover:text-espresso hover:bg-matcha/10"
                  }`}
                >
                  {slot === "Breakfast" ? "🍳 Breakfast" : slot === "Lunch" ? "🥗 Lunch" : "🍲 Dinner"}
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Third: Regional guidelines selection dropdown list */}
        <div className="space-y-2 pt-1 border-t border-matcha/10">
          <label className="text-[10px] font-mono uppercase tracking-wider text-espresso/50 font-bold block">
            3. Regional Guidelines & Cooking Rules
          </label>

          <div className="relative">
            <select
              value={customRules}
              onChange={(e) => {
                const val = e.target.value;
                setCustomRules(val);
                localStorage.setItem("vigadi_custom_rules", val);
              }}
              className="w-full bg-[#F1F3ED] border border-matcha/30 px-3 py-2.5 rounded-xl text-xs font-semibold text-espresso focus:outline-hidden focus:ring-1 focus:ring-sage/60 cursor-pointer appearance-none pr-8"
              id="regional-rules-select-dropdown"
            >
              <option value="Tamil Nadu rules: 1 Kulambu, 2 Sides">Tamil Nadu Customs (1 Kulambu, 2 Sides)</option>
              <option value="Kerala style: 1 Thoran, 1 Curry">Kerala Customs (1 Thoran, 1 Curry)</option>
              <option value="Classic homestyle: 1 Gravy, 1 Dry fry">Classic Comfort (1 Gravy, 1 Dry fry)</option>
              <option value="High protein: 1 main source, 1 boiled starch, minimal oil">Samoa Tiffin (High Protein, Low Oil)</option>
              {/* Fallback to show current custom rule if it isn't listed above */}
              {!REGIONAL_RULES_PRESETS.some((preset) => preset.rule === customRules) && (
                <option value={customRules}>Custom: "{customRules.length > 30 ? customRules.substring(0, 30) + "..." : customRules}"</option>
              )}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-espresso/40">
              <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
              </svg>
            </div>
          </div>
        </div>

        {/* CTA generation trigger */}
        <div className="pt-2 border-t border-matcha/25 space-y-2">
          {generationError && (
            <div className="bg-red-50 border border-red-200 text-xs text-red-700 p-3 rounded-xl font-medium">
              {generationError}
            </div>
          )}

          <button
            onClick={handleGenerateCustomAICombo}
            disabled={isGenerating}
            className="w-full bg-[#2E9D70] hover:bg-[#208359] text-white py-3 rounded-xl font-display font-semibold text-xs transition-all shadow-sm active:scale-98 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            id="craft-ai-combo-btn"
          >
            {isGenerating ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Synthesizing regional recipes...</span>
              </>
            ) : (
              <>
                <ChefHat className="w-4 h-4 text-cream" />
                <span>Generate Custom Plate Combos</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* PLATE SUGGESTIONS FEED LIST */}
      <div className="space-y-4 pt-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#2E9D70]" />
            <h2 className="text-xs font-mono uppercase tracking-widest text-espresso/50 font-bold">
              Plated Combinations
            </h2>
          </div>
          <span className="text-xs font-mono text-espresso/60 font-bold bg-[#F1F3ED] px-2.5 py-1 rounded-md border border-matcha/10 shadow-3xs">
            {mealsInSlot.length} choices • {actualMatchCount} matching
          </span>
        </div>

        {sortedMatches.length > 0 ? (
          <div className="space-y-4">
            {sortedMatches.map(({ meal, score }) => {
              const hasRated = feedbackRating[meal.id];
              const isExpanded = meal.id === expandedComboId;

              // IF EXPANDED: RENDER POWERFUL HERO PHOTO VIEW MATCHING SECOND ATTACHED DESIGN EXACTLY
              if (isExpanded) {
                return (
                  <div
                    key={meal.id}
                    className="bg-white border-2 border-[#2E9D70] rounded-[28px] overflow-hidden shadow-md flex flex-col transition-all duration-300"
                  >
                    {/* Clean compact header without image */}
                    <div className="bg-[#F1F3ED] border-b border-matcha/20 px-5 py-4 flex items-center justify-between relative select-none">
                      <div className="flex items-center gap-2">
                        <span className="bg-[#0A1812] text-white text-[9px] uppercase font-mono font-bold tracking-wider px-2 py-1 rounded-md">
                          Most Cooked
                        </span>
                        <div className="bg-white text-espresso px-2.5 py-1.5 rounded-full text-[10px] font-bold border border-matcha/25 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-espresso/60" />
                          <span>{meal.prepTime || "50 min"}</span>
                        </div>
                      </div>

                      {/* Collapse/Close button on top right of the hero card to go back to compact */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedComboId(null);
                        }}
                        className="bg-cream text-espresso py-1 px-2.5 rounded-lg hover:bg-cream/90 transition-all z-10 font-bold text-xs flex items-center gap-1 cursor-pointer border border-matcha/30"
                        title="Collapse to compact view"
                      >
                        <X className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span className="font-sans pr-0.5">Close</span>
                      </button>
                    </div>

                    {/* Header Title & Items info */}
                    <div className="p-5 space-y-4">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-xl font-display font-bold text-espresso tracking-tight leading-snug">
                          {meal.recipeName}
                        </h3>
                        {hasRated && (
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-mono font-bold ${
                            hasRated === "up" ? "bg-[#2E9D70]/10 text-[#2E9D70]" : "bg-red-50 text-red-600"
                          }`}>
                            {hasRated === "up" ? "👍 LOVED" : "👎 DISLIKED"}
                          </span>
                        )}
                      </div>

                      {/* Divider line */}
                      <div className="border-t border-[#F1F3ED]" />

                      {/* List of subComponents */}
                      <div className="space-y-2">
                        {meal.subComponents && meal.subComponents.map((comp, idx) => {
                          // Decide bullet colors matching standard mocks
                          let bulletColor = "bg-[#2E9D70]";
                          if (idx === 0) {
                            bulletColor = "bg-[#E05C38]"; // redish-orange
                          } else if (comp.toLowerCase().includes("rice") || comp.toLowerCase().includes("roti") || comp.toLowerCase().includes("staple")) {
                            bulletColor = "bg-amber-400"; // yellow
                          }

                          const isStarch = comp.toLowerCase().includes("rice") || comp.toLowerCase().includes("roti") || comp.toLowerCase().includes("staple");
                          const ytLink = meal.youtubeLinks && meal.youtubeLinks[comp] 
                            ? meal.youtubeLinks[comp] 
                            : `https://www.youtube.com/results?search_query=how+to+cook+${encodeURIComponent(comp)}`;

                          return (
                            <div key={idx} className="flex items-center justify-between py-2 border-b border-[#F5F6F3] last:border-0">
                              <div className="flex items-center gap-3">
                                <span className={`w-2 h-2 rounded-full ${bulletColor} shrink-0`} />
                                <span className="text-espresso font-medium text-xs">
                                  {comp}
                                </span>
                              </div>
                              
                              {isStarch ? (
                                <span className="text-[10px] font-mono text-espresso/45">staple</span>
                              ) : (
                                <a 
                                  href={ytLink}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-7 h-7 bg-red-600 text-white rounded-lg flex items-center justify-center hover:bg-red-700 hover:scale-105 active:scale-95 transition-all shadow-xs"
                                  title={`Watch instructions for ${comp}`}
                                >
                                  <Youtube className="w-3.5 h-3.5 fill-white text-red-600" />
                                </a>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Primary filled Action Button to open Modal detailed view */}
                      <div className="pt-1">
                        <button
                          onClick={() => onSelectMeal(meal)}
                          className="w-full bg-[#2E9D70] hover:bg-[#208359] text-white py-3 px-4 rounded-[16px] text-xs font-bold shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <span>View this combo</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }

              // IF NOT EXPANDED: RENDER STANDARD COMPACT VIEW CARD THAT TRIGGERS EXPAND ACCORDION
              return (
                <div
                  key={meal.id}
                  onClick={() => setExpandedComboId(meal.id)}
                  className="bg-white border border-[#E9EBE5] hover:border-[#2E9D70]/40 p-5 rounded-[22px] flex items-center justify-between transition-all cursor-pointer shadow-xs hover:shadow-sm group"
                >
                  <div className="space-y-1.5 pr-4 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4 className="font-display font-semibold text-espresso text-[16px] group-hover:text-[#2E9D70] transition-colors leading-snug">
                        {meal.recipeName}
                      </h4>
                      {hasRated && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-mono font-bold ${
                          hasRated === "up" ? "bg-[#2E9D70]/10 text-[#2E9D70]" : "bg-red-50 text-red-600"
                        }`}>
                          {hasRated === "up" ? "👍 LOVED" : "👎 DISLIKED"}
                        </span>
                      )}
                      {meal.offline && (
                        <span className="bg-amber-100/60 text-amber-800 text-[8px] font-mono font-bold px-1 rounded">
                          OFFLINE
                        </span>
                      )}
                    </div>
                    
                    <p className="text-espresso/60 text-[11px] font-medium leading-relaxed">
                      {meal.subComponents && meal.subComponents.join(" · ")}
                    </p>
                    
                    <div className="flex flex-wrap items-center gap-2 text-[10px] text-espresso/45 font-mono tracking-wide mt-2 font-bold uppercase">
                      <span>{meal.prepTime}</span>
                      <span>·</span>
                      <span className="text-[#2E9D70] font-bold">
                        {score > 0 ? `${score} matched` : "1 matched"}
                      </span>
                      <span>·</span>
                      <span>{meal.popularCount || "1,240 chose this"}</span>
                      <span>·</span>
                      <div className="flex items-center gap-1 bg-red-50 text-red-600 px-1.5 py-0.5 rounded-md text-[9px] font-bold border border-red-100">
                        <Youtube className="w-3" />
                        <span>{meal.videoCount || 3} videos</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-espresso/20 group-hover:text-[#2E9D70] group-hover:translate-x-0.5 transition-all shrink-0">
                    <svg className="w-5 h-5 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-[#F8F9FA] border border-dashed border-matcha/40 py-10 px-4 rounded-[22px] text-center">
            <ChefHat className="w-8 h-8 text-espresso/30 mx-auto mb-2" />
            <p className="text-xs font-medium text-espresso/70">No combos loaded for {selectedSlot} yet.</p>
            <p className="text-[11px] text-espresso/50 mt-1">Try to customize the regional customs prompt or add another ingredient.</p>
          </div>
        )}
      </div>
    </div>
  );
}
