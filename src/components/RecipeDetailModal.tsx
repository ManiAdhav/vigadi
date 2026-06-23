import { motion, AnimatePresence } from "motion/react";
import { X, Clock, Award, Users, Star, Wheat, Beef, Sprout, Flame, Check, FlameKindling, ThumbsUp, ThumbsDown, Bookmark, Save, ChefHat, Youtube } from "lucide-react";
import { useState, useEffect } from "react";
import { Meal } from "../types";

interface RecipeDetailModalProps {
  meal: Meal | null;
  isOpen: boolean;
  onClose: () => void;
  onLogMeal: (meal: Meal) => void;
}

export default function RecipeDetailModal({ meal, isOpen, onClose, onLogMeal }: RecipeDetailModalProps) {
  const [activeTab, setActiveTab] = useState<"ingredients" | "steps" | "nutrition">("ingredients");
  const [checkedIngredients, setCheckedIngredients] = useState<Record<string, boolean>>({});
  const [isLoggedSuccessfully, setIsLoggedSuccessfully] = useState(false);

  // States for user interactions asked: save, like, dislike, add notes
  const [isSaved, setIsSaved] = useState(false);
  const [likeStatus, setLikeStatus] = useState<"up" | "down" | null>(null);
  const [notesText, setNotesText] = useState("");
  const [showAutoSaveText, setShowAutoSaveText] = useState(false);

  // Synchronise status when meal changes or modal loads
  useEffect(() => {
    if (meal && isOpen) {
      // 1. Saved status
      const saved = localStorage.getItem("vigadi_saved_combos");
      if (saved) {
        const parsed = JSON.parse(saved);
        setIsSaved(!!parsed[meal.id]);
      } else {
        setIsSaved(false);
      }

      // 2. Like or Dislike rating
      const likes = localStorage.getItem("vigadi_combo_likes");
      if (likes) {
        const parsed = JSON.parse(likes);
        setLikeStatus(parsed[meal.id] || null);
      } else {
        setLikeStatus(null);
      }

      // 3. User Notes
      const notes = localStorage.getItem("vigadi_combo_notes");
      if (notes) {
        const parsed = JSON.parse(notes);
        setNotesText(parsed[meal.id] || "");
      } else {
        setNotesText("");
      }
      setShowAutoSaveText(false);
    }
  }, [meal, isOpen]);

  if (!meal) return null;

  const toggleIngredient = (ing: string) => {
    setCheckedIngredients((prev) => ({
      ...prev,
      [ing]: !prev[ing],
    }));
  };

  const handleLogClick = () => {
    onLogMeal(meal);
    setIsLoggedSuccessfully(true);
    setTimeout(() => {
      setIsLoggedSuccessfully(false);
    }, 2500);
  };

  // Click handler actions
  const handleToggleSave = () => {
    const newVal = !isSaved;
    setIsSaved(newVal);
    const saved = localStorage.getItem("vigadi_saved_combos");
    const parsed = saved ? JSON.parse(saved) : {};
    parsed[meal.id] = newVal;
    localStorage.setItem("vigadi_saved_combos", JSON.stringify(parsed));
  };

  const handleRate = async (status: "up" | "down") => {
    const nextStatus = likeStatus === status ? null : status;
    setLikeStatus(nextStatus);

    const likes = localStorage.getItem("vigadi_combo_likes");
    const parsed = likes ? JSON.parse(likes) : {};
    if (nextStatus) {
      parsed[meal.id] = nextStatus;
    } else {
      delete parsed[meal.id];
    }
    localStorage.setItem("vigadi_combo_likes", JSON.stringify(parsed));

    // Async push rating feedback directly to backend endpoint so recommendation logs sync
    try {
      await fetch("/api/learning/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mealId: meal.id,
          thumb: nextStatus || "neutral"
        }),
      });
    } catch (e) {
      console.error("Failed to post rating feedback to recommendation server:", e);
    }
  };

  const handleNotesChange = (txt: string) => {
    setNotesText(txt);
    const notes = localStorage.getItem("vigadi_combo_notes");
    const parsed = notes ? JSON.parse(notes) : {};
    parsed[meal.id] = txt;
    localStorage.setItem("vigadi_combo_notes", JSON.stringify(parsed));
    
    // Briefly display "Saved" feedback text
    setShowAutoSaveText(true);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden flex items-stretch justify-stretch">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-espresso/60 backdrop-blur-xs"
          />

          {/* Drawer container */}
          <motion.div
            initial={{ y: "100%", opacity: 0.9 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0.9 }}
            transition={{ type: "spring", damping: 28, stiffness: 220 }}
            className="relative w-full h-full bg-cream overflow-hidden flex flex-col shadow-premium z-10"
            id="recipe-detail-drawer"
          >
            {/* Header: Roomy, elegant solid-colored display typography lockup, emphasizing recipe function */}
            <div className="bg-[#0A1812] px-6 py-6 border-b border-matcha/20 shrink-0 relative flex flex-col justify-end min-h-[140px] select-none">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 bg-[#23352C] hover:bg-[#2F443A] text-cream p-2 rounded-full shadow-md transition-transform active:scale-95 cursor-pointer flex items-center justify-center"
                aria-label="Close panel"
                id="close-recipe-btn"
              >
                <X className="w-4 h-4 stroke-[2.5]" />
              </button>

              <div className="space-y-1.5 max-w-[85%]">
                <span className="inline-block text-[10px] font-mono tracking-widest text-[#2E9D70] uppercase bg-[#182920] px-2.5 py-1 rounded-md font-bold">
                  {meal.tagline || "Plated combo"}
                </span>
                <h2 className="text-xl sm:text-2xl font-display font-bold text-cream tracking-tight leading-snug">
                  {meal.recipeName}
                </h2>
              </div>
            </div>

            {/* Quick stats ribbon */}
            <div className="bg-matcha/40 border-b border-matcha/20 py-2.5 px-6 flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-espresso shrink-0">
              <div className="flex items-center gap-1.5 font-semibold">
                <Clock className="w-3.5 h-3.5 text-bakedclay" />
                <span>{meal.prepTime}</span>
              </div>
              <div className="flex items-center gap-1.5 font-semibold font-mono">
                <Award className="w-3.5 h-3.5 text-sage" />
                <span>{meal.difficulty || "Easy"}</span>
              </div>
              <div className="flex items-center gap-1.5 font-semibold">
                <Users className="w-3.5 h-3.5 text-emerald-800" />
                <span>{meal.servings || 2} Servings</span>
              </div>
              <div className="flex items-center gap-1">
                <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                <span>{meal.rating || 4.8}</span>
              </div>
            </div>

            {/* Scrollable contents part */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              
              {/* PRIMARY COMBO FUNCTIONS CONSOLE: Save, Like, Dislike, Add Notes */}
              <div className="bg-white border border-[#E9EBE5] p-4 rounded-2xl space-y-4 shadow-xs">
                <h4 className="text-[10px] font-mono uppercase tracking-wider text-espresso/50 font-bold block">
                  Combo Interaction Controls
                </h4>
                
                {/* Save, Like, Dislike Button row - Icon alone in a single row */}
                <div className="grid grid-cols-3 gap-2.5">
                  <button
                    onClick={handleToggleSave}
                    className={`py-3 px-4 rounded-xl border text-xs font-bold transition-all flex items-center justify-center cursor-pointer ${
                      isSaved
                        ? "bg-amber-500 border-amber-500 text-white shadow-xs"
                        : "bg-cream border-matcha text-espresso hover:bg-[#F1F3ED]"
                    }`}
                    title={isSaved ? "Saved" : "Save Plate"}
                  >
                    <Bookmark className={`w-5 h-5 ${isSaved ? "fill-white" : ""}`} />
                  </button>

                  <button
                    onClick={() => handleRate("up")}
                    className={`py-3 px-4 rounded-xl border text-xs font-bold transition-all flex items-center justify-center cursor-pointer ${
                      likeStatus === "up"
                        ? "bg-[#2E9D70] border-[#2E9D70] text-white shadow-xs"
                        : "bg-cream border-matcha text-espresso hover:bg-[#F1F3ED]"
                    }`}
                    title="Love"
                  >
                    <ThumbsUp className="w-5 h-5" />
                  </button>

                  <button
                    onClick={() => handleRate("down")}
                    className={`py-3 px-4 rounded-xl border text-xs font-bold transition-all flex items-center justify-center cursor-pointer ${
                      likeStatus === "down"
                        ? "bg-red-500 border-red-500 text-white shadow-xs"
                        : "bg-cream border-matcha text-espresso hover:bg-[#F1F3ED]"
                    }`}
                    title="Dislike"
                  >
                    <ThumbsDown className="w-5 h-5" />
                  </button>
                </div>

                {/* Notes Input Section */}
                <div className="space-y-1.5 pt-1 border-t border-matcha/10">
                  <div className="flex justify-between items-center text-[10px] font-mono font-bold text-espresso/50 uppercase tracking-wider">
                    <span>Add Kitchen Custom Notes</span>
                    {showAutoSaveText && (
                      <span className="text-[#2E9D70] normal-case tracking-normal animate-pulse text-[10px]">
                        ✓ Saved to local device
                      </span>
                    )}
                  </div>
                  <textarea
                    value={notesText}
                    onChange={(e) => handleNotesChange(e.target.value)}
                    placeholder="e.g. Needs more cumin, substituted red rice, tasted delicious with ghee..."
                    className="w-full bg-[#F1F3ED] border border-matcha/30 p-2.5 rounded-xl text-xs text-espresso font-medium focus:ring-1 focus:ring-sage focus:outline-hidden leading-relaxed h-16 resize-none"
                  />
                </div>
              </div>

              {/* YouTube video tutorials guides */}
              {meal.subComponents && meal.subComponents.length > 0 && (
                <div className="bg-red-50/20 border border-red-500/15 p-4 rounded-2xl space-y-3.5 shadow-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
                    <h4 className="text-[10px] font-mono uppercase tracking-wider text-red-700 font-bold block">
                      Live Grounded Cooking Video References
                    </h4>
                  </div>
                  <div className="space-y-2">
                    {meal.subComponents.map((comp, idx) => {
                      const ytLink = meal.youtubeLinks && meal.youtubeLinks[comp] 
                        ? meal.youtubeLinks[comp] 
                        : `https://www.youtube.com/results?search_query=how+to+cook+${encodeURIComponent(comp)}`;
                      const isStarch = comp.toLowerCase().includes("rice") || comp.toLowerCase().includes("roti") || comp.toLowerCase().includes("staple");

                      return (
                        <div key={idx} className="flex items-center justify-between py-2 border-b border-red-200/5 last:border-0">
                          <div className="flex items-center gap-2 max-w-[65%]">
                            <ChefHat className="w-3.5 h-3.5 text-espresso/45 shrink-0" />
                            <span className="text-espresso font-semibold text-xs text-left truncate">
                              {comp}
                            </span>
                          </div>
                          {isStarch ? (
                            <span className="text-[9px] h-6 px-2.5 bg-matcha/10 text-espresso/60 rounded-md flex items-center justify-center font-mono shrink-0">staple carb</span>
                          ) : (
                            <a 
                              href={ytLink}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-cream text-[10px] font-mono font-bold rounded-lg flex items-center gap-1 shadow-md active:scale-95 transition-transform shrink-0"
                              id={`modal-yt-btn-${idx}`}
                            >
                              <Youtube className="w-3 h-3 fill-white text-red-600" />
                              <span>Recipe Video</span>
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tabs Switch */}
              <div className="flex border-b border-matcha/80 p-0.5 bg-matcha/10 rounded-lg">
                {(["ingredients", "steps", "nutrition"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-2 text-xs font-bold font-display rounded-md capitalize transition-all cursor-pointer ${
                      activeTab === tab
                        ? "bg-espresso text-cream shadow-sm"
                        : "text-espresso/60 hover:text-espresso"
                    }`}
                    id={`recipe-tab-${tab}`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Tab: Ingredients */}
              {activeTab === "ingredients" && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-2.5"
                >
                  <p className="text-[10px] text-espresso/60 font-mono uppercase tracking-wider mb-1">
                    Check off ingredients as you prepare:
                  </p>
                  <div className="space-y-2">
                    {meal.ingredients.map((ing, idx) => {
                      const isChecked = !!checkedIngredients[ing];
                      return (
                        <div
                          key={idx}
                          onClick={() => toggleIngredient(ing)}
                          className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                            isChecked
                              ? "bg-matcha/15 border-sage/30 text-espresso/55 line-through"
                              : "bg-white hover:bg-matcha/10 border-[#E9EBE5] text-espresso"
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded-md flex items-center justify-center border transition-all ${
                              isChecked
                                ? "bg-sage border-sage text-cream"
                                : "border-espresso/30 bg-white"
                            }`}
                          >
                            {isChecked && <Check className="w-3.5 h-3.5 stroke-[3] text-cream" />}
                          </div>
                          <span className="text-xs font-semibold">{ing}</span>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* Tab: Steps */}
              {activeTab === "steps" && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3"
                >
                  {meal.steps.map((step, idx) => (
                    <div key={idx} className="flex gap-3 p-3 bg-white rounded-xl border border-[#E9EBE5]">
                      <div className="w-6 h-6 rounded-full bg-bakedclay/20 text-bakedclay font-mono text-[11px] font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-espresso font-medium leading-relaxed">
                          {step}
                        </p>
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}

              {/* Tab: Nutrition */}
              {activeTab === "nutrition" && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-5"
                >
                  {/* Soft Macro Badges (Earthy, Elegant) */}
                  <div className="grid grid-cols-4 gap-2">
                    <div className="bg-amber-50/50 border border-amber-200/60 p-2 text-center rounded-2xl shadow-xs">
                      <Wheat className="w-4 h-4 text-amber-700 mx-auto mb-1" />
                      <div className="text-xs font-bold text-espresso">
                        {meal.macros.carbs}g
                      </div>
                      <div className="text-[9px] font-mono uppercase tracking-wider text-espresso/50">
                        Carbs
                      </div>
                    </div>

                    <div className="bg-red-50/50 border border-red-200/60 p-2 text-center rounded-2xl shadow-xs">
                      <Beef className="w-4 h-4 text-red-700 mx-auto mb-1" />
                      <div className="text-xs font-bold text-espresso">
                        {meal.macros.protein}g
                      </div>
                      <div className="text-[9px] font-mono uppercase tracking-wider text-espresso/50">
                        Protein
                      </div>
                    </div>

                    <div className="bg-emerald-50/50 border border-emerald-200/60 p-2 text-center rounded-2xl shadow-xs">
                      <Sprout className="w-4 h-4 text-emerald-700 mx-auto mb-1" />
                      <div className="text-xs font-bold text-espresso">
                        {meal.macros.fat}g
                      </div>
                      <div className="text-[9px] font-mono uppercase tracking-wider text-espresso/50">
                        Fats
                      </div>
                    </div>

                    <div className="bg-orange-50/50 border border-orange-200/60 p-2 text-center rounded-2xl shadow-xs">
                      <Flame className="w-4 h-4 text-orange-700 mx-auto mb-1" />
                      <div className="text-xs font-bold text-espresso">
                        {meal.macros.calories}
                      </div>
                      <div className="text-[9px] font-mono uppercase tracking-wider text-espresso/50">
                        Calories
                      </div>
                    </div>
                  </div>

                  {/* Non-judgmental system tone description */}
                  <div className="bg-matcha/20 border border-matcha/40 p-3.5 rounded-xl text-espresso space-y-1.5">
                    <h4 className="text-[10px] font-mono uppercase tracking-wider font-bold text-sage flex items-center gap-1.5">
                      <FlameKindling className="w-3.5 h-3.5 text-[#2E9D70]" /> Vígadi Mindful Insights
                    </h4>
                    <p className="text-xs font-medium leading-relaxed italic text-espresso/80">
                      "{meal.nutritionFact || "Every food serves a dynamic purpose for your spirit. Enjoy each bite to keep your mind balanced and body replenished."}"
                    </p>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Sticky Action Footer */}
            <div className="p-4 bg-cream border-t border-matcha/30 flex gap-3 shrink-0">
              <button
                onClick={handleLogClick}
                className={`flex-1 py-3 rounded-xl font-display font-semibold text-xs transition-all shadow-md active:scale-98 cursor-pointer ${
                  isLoggedSuccessfully
                    ? "bg-[#2E9D70] text-cream"
                    : "bg-bakedclay hover:bg-bakedclay/95 text-cream"
                }`}
                id="log-recipe-action-btn"
              >
                {isLoggedSuccessfully ? "✓ Logged into Today's Diary!" : "Log this plate today"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
