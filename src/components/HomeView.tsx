import { useState } from "react";
import { Search, Play, Star, Clock, ChefHat, ArrowRight, Heart } from "lucide-react";
import { Meal } from "../types";

interface HomeViewProps {
  meals: Meal[];
  onSelectMeal: (meal: Meal) => void;
  onNavigateToTab: (tab: "kitchen" | "logs" | "profile") => void;
}

export default function HomeView({ meals, onSelectMeal, onNavigateToTab }: HomeViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Filter recipes based on category & search query
  const filteredMeals = meals.filter((meal) => {
    const matchesSearch = meal.recipeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          meal.tagline.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          meal.ingredients.some(ing => ing.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory ? meal.category === selectedCategory : true;
    return matchesSearch && matchesCategory;
  });

  const categories = [
    { name: "Breakfast", icon: "🍳" },
    { name: "Lunch", icon: "🥗" },
    { name: "Dinner", icon: "🍲" },
    { name: "Desserts", icon: "🧁" },
    { name: "Vegan", icon: "🌱" }
  ];

  // Pick up where you left off card meal
  const currentLeftOffMeal = meals.find(m => m.id === "combo-2") || meals[0];

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Top Banner with matcha background tint */}
      <div className="relative overflow-hidden bg-gradient-to-br from-matcha via-matcha/40 to-cream p-6 rounded-3xl border border-matcha/60 shadow-warm">
        <div className="max-w-md space-y-3">
          <h1 className="text-4xl sm:text-5xl font-display font-bold text-espresso leading-tight tracking-tight">
            Good food,<br />
            <span className="text-bakedclay">Made Simple</span>
          </h1>
          <p className="text-sm text-espresso/70 font-medium">
            Delicious recipes, easy steps, happy you. Designed to match your biological rhythm perfectly.
          </p>
        </div>
        
        {/* Absolute floating food leaf for high-end feel */}
        <div className="absolute right-4 bottom-4 w-28 h-28 opacity-10 pointer-events-none">
          <ChefHat className="w-full h-full text-espresso" />
        </div>
      </div>

      {/* Modern Search bar */}
      <div className="relative">
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
          <Search className="w-5 h-5 text-espresso/40" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search recipes, ingredients..."
          className="w-full bg-cream border border-matcha py-3.5 pl-12 pr-4 rounded-2xl text-espresso font-medium shadow-warm focus:outline-hidden focus:ring-2 focus:ring-sage/60 text-sm transition-all"
          id="recipes-search-input"
        />
      </div>

      {/* Pick up where you left off */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-mono uppercase tracking-widest text-espresso/80">
            Pick up where you left off
          </h2>
          <button 
            onClick={() => onNavigateToTab("logs")}
            className="text-xs font-semibold text-bakedclay flex items-center gap-1 hover:underline"
          >
            Review diary <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div 
          onClick={() => onSelectMeal(currentLeftOffMeal)}
          className="group cursor-pointer bg-sage/90 text-cream p-4 rounded-3xl flex items-center gap-4 hover:bg-sage transition-all shadow-warm relative overflow-hidden"
          id="left-off-resume-card"
        >
          {/* Background subtle leaf vector */}
          <div className="absolute -right-4 -bottom-4 w-32 h-32 opacity-10 bg-cream rounded-full pointer-events-none" />

          <img
            src={currentLeftOffMeal.image}
            alt={currentLeftOffMeal.recipeName}
            className="w-20 h-20 rounded-2xl object-cover shadow-warm group-hover:scale-104 transition-transform shrink-0 animate-fade-in"
            referrerPolicy="no-referrer"
          />

          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[8px] tracking-widest font-mono font-bold bg-cream text-sage px-1.5 py-0.5 rounded-sm uppercase">COMBO PLATE</span>
            </div>
            <h3 className="font-display font-medium text-cream text-md truncate pr-4">
              {currentLeftOffMeal.recipeName}
            </h3>
            
            {/* Combo components preview tags */}
            <div className="flex flex-wrap gap-1 pt-0.5">
              {currentLeftOffMeal.subComponents.slice(0, 3).map((comp, idx) => (
                <span key={idx} className="text-[9px] bg-cream/15 text-cream border border-cream/10 px-1.5 py-0.5 rounded-sm">
                  + {comp}
                </span>
              ))}
              {currentLeftOffMeal.subComponents.length > 3 && (
                <span className="text-[9px] bg-cream/15 text-cream px-1.5 py-0.5 rounded-sm">...</span>
              )}
            </div>

            <p className="text-[10px] text-matcha/90 mt-1 font-mono">
              {currentLeftOffMeal.prepTime} • Easy cooking
            </p>
          </div>

          <button className="w-10 h-10 rounded-full bg-cream text-bakedclay flex items-center justify-center shrink-0 shadow-md group-hover:bg-matcha transition-colors">
            <Play className="w-4 h-4 fill-bakedclay text-bakedclay ml-0.5" />
          </button>
        </div>
      </div>

      {/* Popular Categories */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-mono uppercase tracking-widest text-espresso/80">
            Popular Categories
          </h2>
          {selectedCategory && (
            <button
              onClick={() => setSelectedCategory(null)}
              className="text-xs font-semibold text-bakedclay hover:underline"
            >
              Clear filter
            </button>
          )}
        </div>

        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none snap-x snap-mandatory">
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.name;
            return (
              <button
                key={cat.name}
                onClick={() => setSelectedCategory(isSelected ? null : cat.name)}
                className={`snap-start shrink-0 flex flex-col items-center gap-2 p-3.5 w-20 rounded-2xl border transition-all ${
                  isSelected
                    ? "bg-bakedclay border-bakedclay text-cream shadow-warm transform -translate-y-1"
                    : "bg-cream hover:bg-matcha/20 border-matcha text-espresso"
                }`}
                id={`category-${cat.name}`}
              >
                <span className="text-2xl">{cat.icon}</span>
                <span className="text-[10px] font-bold uppercase tracking-wider">{cat.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Recipes Stream Grid */}
      <div className="space-y-4">
        <h2 className="text-xs font-mono uppercase tracking-widest text-espresso/80">
          {selectedCategory ? `${selectedCategory} Recipes` : "All Delicious Combos"} ({filteredMeals.length})
        </h2>

        {filteredMeals.length === 0 ? (
          <div className="text-center py-12 p-6 bg-cream/50 rounded-3xl border border-dashed border-matcha space-y-2">
            <span className="text-3xl">🍲</span>
            <p className="text-sm font-medium text-espresso/60">No matched dishes found. Try listing ingredients in the Kitchen tab instead!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {filteredMeals.map((meal) => (
              <div
                key={meal.id}
                onClick={() => onSelectMeal(meal)}
                className="group cursor-pointer bg-cream border border-matcha/40 hover:border-matcha rounded-[22px] overflow-hidden shadow-warm hover:shadow-premium transition-all"
                id={`meal-card-${meal.id}`}
              >
                {/* Food photocard */}
                <div className="relative h-44 overflow-hidden">
                  <img
                    src={meal.image}
                    alt={meal.recipeName}
                    className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-espresso/60 via-transparent to-transparent" />
                  
                  {/* Category and time badges */}
                  <div className="absolute top-3 left-3 flex gap-1.5">
                    <span className="text-[10px] uppercase font-mono font-bold bg-cream/95 text-espresso px-2 py-0.5 rounded-md shadow-xs">
                      {meal.category}
                    </span>
                  </div>

                  <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-cream/90 text-espresso text-[11px] font-mono px-2 py-0.5 rounded-md shadow-xs font-bold">
                    <Clock className="w-3.5 h-3.5 text-bakedclay" />
                    <span>{meal.prepTime}</span>
                  </div>
                </div>

                {/* Card Description Footer */}
                <div className="p-4 space-y-2">
                  <div className="flex justify-between items-start">
                    <h3 className="font-display font-semibold text-espresso text-md group-hover:text-bakedclay transition-colors leading-tight truncate pr-2">
                      {meal.recipeName}
                    </h3>
                    <div className="flex items-center gap-0.5 text-xs font-bold font-mono">
                      <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                      <span>{meal.rating || 4.8}</span>
                    </div>
                  </div>

                  {/* Dynamic Combo Ingredients / Dishes Breakdown */}
                  <div className="flex flex-wrap gap-1 pt-1 pb-1">
                    {meal.subComponents && meal.subComponents.map((comp, i) => (
                      <span key={i} className="text-[9px] font-medium bg-matcha/30 hover:bg-matcha/40 text-espresso/90 px-1.5 py-0.5 rounded-md border border-matcha/40 transition-colors">
                        + {comp}
                      </span>
                    ))}
                  </div>

                  <p className="text-[11px] text-espresso/60 line-clamp-2">
                    {meal.tagline || meal.nutritionFact}
                  </p>

                  {/* Soft Macro summary pill badges */}
                  <div className="flex gap-2 pt-1 border-t border-matcha/20">
                    <span className="text-[10px] font-mono text-espresso/60 flex items-center gap-1">
                      Carbs <strong className="text-espresso">{meal.macros.carbs}g</strong>
                    </span>
                    <span className="text-[10px] font-mono text-espresso/60 flex items-center gap-1 border-l border-matcha/40 pl-2">
                      Protein <strong className="text-espresso">{meal.macros.protein}g</strong>
                    </span>
                    <span className="text-[10px] font-mono text-espresso/60 flex items-center gap-1 border-l border-matcha/40 pl-2">
                      Fat <strong className="text-espresso">{meal.macros.fat}g</strong>
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
