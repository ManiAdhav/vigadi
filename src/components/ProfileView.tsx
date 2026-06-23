import { Heart, Flame, Plus, Sparkles, BookOpen, Bookmark, Layers, Clock, Check, Camera as CameraIcon, MapPin } from "lucide-react";
import { useState } from "react";
import { Meal } from "../types";

interface ProfileViewProps {
  onSelectMealById: (id: string) => void;
}

export default function ProfileView({ onSelectMealById }: ProfileViewProps) {
  // Load location and custom macronutrient ratio from storage
  const [userLocation, setUserLocation] = useState(() => {
    return localStorage.getItem("vigadi_user_location") || "Tamil Nadu, Chennai";
  });
  const [mealRules, setMealRules] = useState(() => {
    return localStorage.getItem("vigadi_custom_rules") || "Tamil Nadu rules: 1 Kulambu, 2 Sides";
  });
  const [carbPct, setCarbPct] = useState(50);
  const [proteinPct, setProteinPct] = useState(30);
  const [fatPct, setFatPct] = useState(20);
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [locationInput, setLocationInput] = useState(userLocation);
  const [isEditingRules, setIsEditingRules] = useState(false);
  const [customRulesInput, setCustomRulesInput] = useState(mealRules);

  // Mock statistics matching the screenshot
  const stats = [
    { label: "Favorites", value: "24", sub: "recipes", icon: <Heart className="w-4 h-4 text-bakedclay fill-bakedclay" /> },
    { label: "My Recipes", value: "8", sub: "recipes", icon: <BookOpen className="w-4 h-4 text-emerald-700" /> },
    { label: "Collections", value: "5", sub: "collections", icon: <Layers className="w-4 h-4 text-indigo-700" /> },
    { label: "Saved", value: "17", sub: "recipes", icon: <Bookmark className="w-4 h-4 text-orange-600 fill-orange-500" /> }
  ];

  // Cooking Streak weekdays matching Emma's screen
  const weekdays = [
    { day: "M", checked: true },
    { day: "T", checked: true },
    { day: "W", checked: true },
    { day: "T", checked: true },
    { day: "F", checked: true },
    { day: "S", checked: true },
    { day: "S", checked: false }
  ];

  // Recently Viewed meals matching screenshots
  const recentlyViewed = [
    {
      id: "combo-3",
      name: "Avocado Toast & Egg Combo",
      time: "10 min",
      img: "https://images.unsplash.com/photo-1541532713592-79a0317b6b77?auto=format&fit=crop&w=400&q=80"
    },
    {
      id: "combo-4",
      name: "Quinoa Salad & Potato Combo",
      time: "30 min",
      img: "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=400&q=80"
    },
    {
      id: "combo-5",
      name: "Pancakes & Berries Combo",
      time: "15 min",
      img: "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?auto=format&fit=crop&w=400&q=80"
    }
  ];

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Welcome Banner Emma style */}
      <div className="flex items-center gap-4 bg-cream/10 p-2">
        {/* Profile photo container with camera overlay */}
        <div className="relative">
          <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-matcha shadow-warm shrink-0 bg-matcha/40">
            <img
              src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=300&q=80"
              alt="Emma"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          {/* Green camera circle badge */}
          <div className="absolute -bottom-1 -right-1 bg-sage text-cream p-1.5 rounded-full border border-cream shadow-xs">
            <CameraIcon className="w-3.5 h-3.5" />
          </div>
        </div>

        <div className="space-y-0.5">
          <h1 className="text-3xl font-display font-bold text-espresso tracking-tight">
            Welcome back,<br />
            Emma <span className="inline-block text-sage">🌱</span>
          </h1>
          <p className="text-xs text-espresso/60 font-medium">
            Let's cook something amazing today!
          </p>
        </div>
      </div>

      {/* Cooking streak card matching screenshot */}
      <div className="bg-sage text-cream p-5 rounded-[22px] shadow-warm space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-matcha">
            Cooking Streak
          </span>
        </div>

        <div className="flex justify-between items-center">
          {/* Fire indicator badge */}
          <div className="flex items-center gap-2">
            <span className="p-2.5 rounded-full bg-cream/10 text-cream flex items-center justify-center">
              <Flame className="w-6 h-6 fill-amber-500 text-amber-500 animate-pulse" />
            </span>
            <div>
              <span className="text-3xl font-display font-extrabold leading-none">
                12
              </span>
              <span className="text-xs font-semibold text-matcha/90 ml-1">days</span>
            </div>
          </div>

          {/* Schedulers checkmarks (M, T, W, T, F, S, S) */}
          <div className="flex gap-1.5">
            {weekdays.map((day, idx) => (
              <div key={idx} className="flex flex-col items-center gap-1">
                <span className="text-[10px] font-mono text-matcha/80 uppercase font-semibold">
                  {day.day}
                </span>
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center border transition-all ${
                    day.checked
                      ? "bg-cream text-sage border-cream"
                      : "border-cream/30 bg-cream/10"
                  }`}
                >
                  {day.checked ? (
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  ) : (
                    <span className="w-1 h-1 bg-cream/30 rounded-full" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Stats Grid matches Emma's boxes */}
      <div className="grid grid-cols-2 gap-4">
        {stats.map((item, idx) => (
          <div
            key={idx}
            className="bg-cream border border-matcha/60 hover:border-matcha p-4 rounded-2xl shadow-warm flex flex-row items-center gap-3 transition-colors hover:shadow-md"
          >
            <div className="p-2.5 rounded-xl bg-matcha/40 shrink-0">
              {item.icon}
            </div>
            <div>
              <p className="text-2xl font-display font-extrabold text-espresso tracking-tight">
                {item.value}
              </p>
              <span className="text-[10px] font-mono uppercase tracking-wider text-espresso/60 font-semibold block">
                {item.label}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Region & Diet Profile Card with location & eating style proportion */}
      <div className="bg-cream border border-matcha p-5 rounded-[22px] shadow-warm space-y-4">
        <div className="flex items-center gap-2 border-b border-matcha/20 pb-3">
          <div className="p-1.5 bg-[#2E9D70]/10 text-[#2E9D70] rounded-lg">
            <MapPin className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-mono uppercase tracking-widest text-[#2E9D70] font-bold">
              Region & Eating Style settings
            </h3>
            <p className="text-[10px] text-espresso/60 font-semibold">
              Tailored dietary location and macro splits
            </p>
          </div>
        </div>

        {/* Location Selector Setting */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-mono uppercase tracking-wider text-espresso/50 font-bold block">
            Primary Location
          </label>
          
          {isEditingLocation ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={locationInput}
                onChange={(e) => setLocationInput(e.target.value)}
                className="bg-white border border-matcha/40 px-3 py-1.5 rounded-lg text-xs font-medium text-espresso flex-1 focus:ring-1 focus:ring-[#2E9D70]/40 focus:outline-hidden"
                placeholder="e.g. Tamil Nadu, India"
              />
              <button
                onClick={() => {
                  const loc = locationInput.trim() || "Tamil Nadu, Chennai";
                  setUserLocation(loc);
                  localStorage.setItem("vigadi_user_location", loc);
                  setIsEditingLocation(false);
                }}
                className="bg-espresso text-cream hover:bg-espresso/90 text-xs px-3 py-1.5 rounded-lg font-bold cursor-pointer"
              >
                Save
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between bg-[#F1F3ED] px-4 py-2.5 rounded-xl border border-matcha/10">
              <div className="flex items-center gap-2">
                <span className="text-sm">📍</span>
                <span className="text-xs font-semibold text-espresso">{userLocation}</span>
              </div>
              <button
                onClick={() => {
                  setLocationInput(userLocation);
                  setIsEditingLocation(true);
                }}
                className="text-[10px] uppercase font-mono font-bold text-[#2E9D70] hover:underline cursor-pointer"
              >
                Change
              </button>
            </div>
          )}
        </div>

        {/* Eating Style Split 50/30/20 proportions bar */}
        <div className="space-y-3 pt-1">
          <div className="flex justify-between items-center">
            <label className="text-[10px] font-mono uppercase tracking-wider text-espresso/50 font-bold block">
              Eating Style Split Ratio
            </label>
            <span className="bg-[#2E9D70]/10 text-[#2E9D70] text-[10px] font-mono font-bold tracking-wider px-2 py-0.5 rounded-md">
              {carbPct}/{proteinPct}/{fatPct} Protocol
            </span>
          </div>

          {/* Graphical Split Segment */}
          <div className="h-6 rounded-full overflow-hidden flex font-mono text-[9px] font-bold text-white shadow-3xs cursor-pointer select-none">
            <div 
              style={{ width: `${carbPct}%` }}
              className="bg-[#2E9D70] flex items-center justify-center transition-all duration-300"
              title="Carbohydrates"
            >
              <span>🍞 {carbPct}%</span>
            </div>
            <div 
              style={{ width: `${proteinPct}%` }}
              className="bg-[#E05C38] flex items-center justify-center transition-all duration-300 border-l border-white/20"
              title="Protein"
            >
              <span>🍗 {proteinPct}%</span>
            </div>
            <div 
              style={{ width: `${fatPct}%` }}
              className="bg-amber-400 text-espresso flex items-center justify-center transition-all duration-300 border-l border-white/20"
              title="Healthy Fats"
            >
              <span>🥑 {fatPct}%</span>
            </div>
          </div>

          {/* Quick Predefined splits */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            <button 
              onClick={() => { setCarbPct(50); setProteinPct(30); setFatPct(20); }}
              className={`px-2.5 py-1 rounded-md text-[10px] font-semibold border transition-all cursor-pointer ${
                carbPct === 50 
                  ? "border-[#2E9D70] bg-[#2E9D70]/5 text-[#2E9D70]" 
                  : "border-matcha/20 bg-[#F1F3ED] text-espresso/70 hover:bg-matcha/10"
              }`}
            >
              50/30/20 Standard (Emma)
            </button>
            <button 
              onClick={() => { setCarbPct(40); setProteinPct(40); setFatPct(20); }}
              className={`px-2.5 py-1 rounded-md text-[10px] font-semibold border transition-all cursor-pointer ${
                carbPct === 40 
                  ? "border-[#E05C38] bg-[#E05C38]/5 text-[#E05C38]" 
                  : "border-matcha/20 bg-[#F1F3ED] text-espresso/70 hover:bg-matcha/10"
              }`}
            >
              40/40/20 Premium Active
            </button>
            <button 
              onClick={() => { setCarbPct(33); setProteinPct(33); setFatPct(34); }}
              className={`px-2.5 py-1 rounded-md text-[10px] font-semibold border transition-all cursor-pointer ${
                carbPct === 33 
                  ? "border-amber-500 bg-amber-500/5 text-amber-600" 
                  : "border-matcha/20 bg-[#F1F3ED] text-espresso/70 hover:bg-matcha/10"
              }`}
            >
              33/33/34 Balance Zone
            </button>
          </div>
          
          <p className="text-[10px] text-espresso/50 leading-relaxed font-mono">
            * Calibrated with active lifestyle variables. Vígadi maps your stews exactly to match this split.
          </p>
        </div>

        {/* Regional Guidelines & Meal Cooking Rules */}
        <div className="space-y-1.5 pt-4 border-t border-matcha/20">
          <label className="text-[10px] font-mono uppercase tracking-wider text-espresso/50 font-bold block">
            Regional Guidelines & Cooking Rules
          </label>
          
          {isEditingRules ? (
            <div className="space-y-2">
              <textarea
                value={customRulesInput}
                onChange={(e) => setCustomRulesInput(e.target.value)}
                className="w-full bg-white border border-matcha/40 p-2.5 rounded-xl text-xs text-espresso font-medium focus:ring-1 focus:ring-[#2E9D70]/45 focus:outline-hidden leading-relaxed h-16 resize-none"
                placeholder="Describe rules, e.g. 1 hot curry stew, 2 baked sides, no dairy..."
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const rule = customRulesInput.trim() || "Tamil Nadu rules: 1 Kulambu, 2 Sides";
                    setMealRules(rule);
                    localStorage.setItem("vigadi_custom_rules", rule);
                    setIsEditingRules(false);
                  }}
                  className="bg-[#2E9D70] text-white hover:bg-[#208359] text-xs px-3 py-1.5 rounded-lg font-bold cursor-pointer"
                >
                  Save Rules
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCustomRulesInput(mealRules);
                    setIsEditingRules(false);
                  }}
                  className="bg-zinc-200 text-espresso text-xs px-3 py-1.5 rounded-lg font-bold cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="bg-[#F1F3ED] border border-matcha/10 p-2.5 rounded-xl flex items-start justify-between gap-2">
                <div className="text-[11px] font-mono font-medium text-espresso/80 leading-relaxed">
                  "{mealRules}"
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCustomRulesInput(mealRules);
                    setIsEditingRules(true);
                  }}
                  className="text-[10px] uppercase font-mono font-bold text-[#2E9D70] hover:underline cursor-pointer shrink-0"
                >
                  Edit
                </button>
              </div>
              
              {/* Quick Select Buttons */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                  { name: "Tamil Nadu Customs", rule: "Tamil Nadu rules: 1 Kulambu, 2 Sides" },
                  { name: "Kerala Customs", rule: "Kerala style: 1 Thoran, 1 Curry" },
                  { name: "Classic Comfort", rule: "Classic homestyle: 1 Gravy, 1 Dry fry" },
                  { name: "Samoa Tiffin", rule: "High protein: 1 main source, 1 boiled starch, minimal oil" }
                ].map((preset) => {
                  const isActive = mealRules === preset.rule;
                  return (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => {
                        setMealRules(preset.rule);
                        setCustomRulesInput(preset.rule);
                        localStorage.setItem("vigadi_custom_rules", preset.rule);
                      }}
                      className={`px-2 py-1 rounded-md text-[9.5px] font-semibold border transition-all cursor-pointer ${
                        isActive
                          ? "bg-[#2E9D70] border-[#2E9D70] text-white shadow-xs"
                          : "bg-[#F1F3ED] border-matcha/20 text-espresso/70 hover:bg-matcha/10"
                      }`}
                    >
                      {preset.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recently Viewed meals list row */}
      <div className="space-y-3.5">
        <div className="flex justify-between items-center">
          <h2 className="text-xs font-mono uppercase tracking-widest text-espresso/80 font-bold">
            Recently Viewed
          </h2>
          <button className="text-xs font-semibold text-bakedclay hover:underline">
            View all
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {recentlyViewed.map((item) => (
            <div
              key={item.id}
              onClick={() => onSelectMealById(item.id)}
              className="bg-cream border border-matcha/40 rounded-xl overflow-hidden shadow-xs cursor-pointer hover:shadow-warm transition-shadow group flex flex-col"
            >
              <div className="relative h-20 overflow-hidden bg-matcha shrink-0">
                <img
                  src={item.img}
                  alt={item.name}
                  className="w-full h-full object-cover group-hover:scale-104 transition-transform duration-300"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="p-2 flex-1 flex flex-col justify-between">
                <h4 className="font-display font-semibold text-xs text-espresso leading-snug line-clamp-1 group-hover:text-bakedclay transition-colors">
                  {item.name}
                </h4>
                <span className="text-[9px] font-mono text-espresso/50 flex items-center gap-0.5 mt-0.5">
                  <Clock className="w-2.5 h-2.5" /> {item.time}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
