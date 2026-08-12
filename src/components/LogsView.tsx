import { useRef, useState, ChangeEvent } from "react";
import {
  Camera,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Wheat,
  Beef,
  Sprout,
  Upload,
  AlertCircle,
  RefreshCw,
  X,
  UtensilsCrossed,
} from "lucide-react";
import ManualMealEntry from "./ManualMealEntry";
import {
  MealLogEntry,
  MealLogItemInput,
  MealLogType,
  formatLogDateLabel,
  formatMealTypeLabel,
  shiftIsoDate,
  sumMacros,
  todayIso,
} from "../../shared/mealLogs";
import { formatLoggedIngredients } from "../../shared/loggedIngredients";

interface LogsViewProps {
  date: string;
  meals: MealLogEntry[];
  userId: string;
  onDateChange: (date: string) => void;
  onSaveMeal: (
    mealType: MealLogType,
    dishes: MealLogItemInput[]
  ) => Promise<{ ok: boolean; error?: string }>;
  onDeleteMeal: (mealId: string) => void;
  onDeleteItem: (mealId: string, itemId: number) => void;
  onResetLogs: () => void;
}

export default function LogsView({
  date,
  meals,
  userId,
  onDateChange,
  onSaveMeal,
  onDeleteMeal,
  onDeleteItem,
  onResetLogs,
}: LogsViewProps) {
  const [mealType, setMealType] = useState<MealLogType>("lunch");
  const [showPhotoScan, setShowPhotoScan] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const today = todayIso();
  const totals = sumMacros(meals);
  const dishCount = meals.reduce((sum, meal) => sum + meal.items.length, 0);

  // Daily budget targets
  const targetCalories = 1800;
  const targetCarbs = 200;
  const targetProtein = 110;
  const targetFat = 65;

  const pct = (value: number, target: number) =>
    Math.min(Math.round((value / target) * 100), 100);

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsParsing(true);
    setParseError(null);

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = async () => {
      try {
        const parseRes = await fetch("/api/logs/parse-photo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageBase64: reader.result as string,
            mimeType: file.type || "image/jpeg",
          }),
        });
        if (!parseRes.ok) throw new Error("Server failed to scan the uploaded photo.");
        const data = await parseRes.json();
        const macros = data.macros ?? {};
        // A scanned plate is one dish on the meal, carrying the macros the
        // hand-typed dishes never have.
        const result = await onSaveMeal(mealType, [
          {
            name: data.recipeName || file.name.split(".")[0],
            calories: Number(macros.calories) || null,
            carbs: Number(macros.carbs) || null,
            protein: Number(macros.protein) || null,
            fat: Number(macros.fat) || null,
            imageUrl: URL.createObjectURL(file),
            review: data.review || null,
          },
        ]);
        if (!result.ok) setParseError(result.error ?? "Could not save the scanned plate.");
      } catch (err: any) {
        console.error(err);
        setParseError(err.message || "Could not analyze that photo. Try logging it by hand instead.");
      } finally {
        setIsParsing(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Date navigator */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => onDateChange(shiftIsoDate(date, -1))}
          className="p-2 rounded-xl border border-matcha bg-cream text-espresso/70 hover:text-bakedclay hover:border-bakedclay/40 transition-colors cursor-pointer"
          aria-label="Previous day"
          id="prev-day"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="text-center">
          <h1 className="text-2xl font-display font-medium text-espresso tracking-tight">
            {formatLogDateLabel(date, today)}
          </h1>
          <p className="text-[10px] text-espresso/60 font-mono uppercase tracking-wider">
            {dishCount} {dishCount === 1 ? "dish" : "dishes"} logged
          </p>
        </div>

        <button
          onClick={() => onDateChange(shiftIsoDate(date, 1))}
          disabled={date >= today}
          className="p-2 rounded-xl border border-matcha bg-cream text-espresso/70 hover:text-bakedclay hover:border-bakedclay/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
          aria-label="Next day"
          id="next-day"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Manual entry — the primary way to log a home-cooked meal */}
      <ManualMealEntry
        date={date}
        mealType={mealType}
        userId={userId}
        onDateChange={onDateChange}
        onMealTypeChange={setMealType}
        onSave={(dishes) => onSaveMeal(mealType, dishes)}
      />

      {/* Macro budget — only when something logged today actually has numbers */}
      {totals.hasAny && (
        <div className="bg-cream border border-matcha/80 p-5 rounded-3xl shadow-warm space-y-5">
          <div className="flex items-center gap-5">
            <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-matcha stroke-current"
                  strokeWidth="3.5"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-bakedclay stroke-current"
                  strokeWidth="3.5"
                  strokeDasharray={`${pct(totals.calories, targetCalories)}, 100`}
                  strokeLinecap="round"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute text-center">
                <span className="text-md font-display font-bold text-espresso">{totals.calories}</span>
                <p className="text-[8px] font-mono uppercase tracking-wider text-espresso/60">kcal</p>
              </div>
            </div>

            <div className="space-y-1">
              <h3 className="font-display font-semibold text-espresso text-md leading-tight">
                Scanned plates only
              </h3>
              <p className="text-xs text-espresso/70 font-medium">
                <strong className="text-bakedclay">{totals.calories} kcal</strong> from photo-scanned
                dishes. Hand-typed dishes are logged without macros, so they are not counted here.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 pt-3 border-t border-matcha/30">
            {[
              { label: "Carbs", Icon: Wheat, tone: "text-amber-600", bar: "bg-amber-400", value: totals.carbs, target: targetCarbs },
              { label: "Protein", Icon: Beef, tone: "text-red-600", bar: "bg-red-400", value: totals.protein, target: targetProtein },
              { label: "Fats", Icon: Sprout, tone: "text-emerald-600", bar: "bg-emerald-500", value: totals.fat, target: targetFat },
            ].map(({ label, Icon, tone, bar, value, target }) => (
              <div key={label} className="space-y-1">
                <div className="flex justify-between items-center text-[10px] uppercase font-mono font-bold text-espresso/60">
                  <span className="flex items-center gap-0.5">
                    <Icon className={`w-3 h-3 ${tone}`} /> {label}
                  </span>
                  <span>{value}g / {target}g</span>
                </div>
                <div className="w-full bg-matcha h-2 rounded-full overflow-hidden">
                  <div className={`${bar} h-full rounded-full transition-all`} style={{ width: `${pct(value, target)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* The day's meals */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-matcha/40 pb-2">
          <h2 className="text-sm font-mono uppercase tracking-widest text-espresso/80 font-bold">
            {formatLogDateLabel(date, today)}'s meals
          </h2>
          <button
            onClick={onResetLogs}
            className="text-[10px] font-mono tracking-wide text-espresso/60 hover:text-bakedclay border border-matcha hover:border-bakedclay/40 bg-cream/70 px-2 py-1 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
            id="reset-logs-action"
          >
            <RefreshCw className="w-3 h-3" /> Clear diary
          </button>
        </div>

        {meals.length === 0 ? (
          <div className="text-center py-10 bg-cream/30 border border-matcha rounded-2xl p-6">
            <UtensilsCrossed className="w-8 h-8 text-espresso/30 mx-auto mb-2" />
            <p className="text-sm font-medium text-espresso/60">
              Nothing logged for {formatLogDateLabel(date, today).toLowerCase()} yet.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {meals.map((meal) => (
              <div
                key={meal.id}
                className="bg-cream border border-matcha/40 p-4 rounded-3xl shadow-warm space-y-3"
                id={`meal-card-${meal.id}`}
              >
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-mono tracking-wider font-bold uppercase text-bakedclay bg-bakedclay/10 px-2 py-0.5 rounded-md">
                    {formatMealTypeLabel(meal.mealType)}
                  </span>
                  <button
                    onClick={() => onDeleteMeal(meal.id)}
                    className="text-espresso/40 hover:text-red-500 p-1.5 rounded-full hover:bg-red-50 transition-colors cursor-pointer"
                    title="Remove this whole meal"
                    id={`delete-meal-${meal.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <ul className="space-y-1.5">
                  {meal.items.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-2 bg-matcha/20 border border-matcha/30 rounded-xl px-3 py-2"
                    >
                      <div className="min-w-0 flex items-center gap-2.5">
                        {item.imageUrl && (
                          <img
                            src={item.imageUrl}
                            alt={item.dishName}
                            className="w-9 h-9 rounded-lg object-cover shrink-0 border border-matcha/40"
                            referrerPolicy="no-referrer"
                          />
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-display font-semibold text-espresso truncate">
                            {item.dishName}
                          </p>
                          {item.ingredients.length > 0 && (
                            <p className="text-[11px] text-espresso/60 truncate">
                              {formatLoggedIngredients(item.ingredients)}
                            </p>
                          )}
                          {item.calories != null && (
                            <p className="text-[10px] font-mono text-espresso/60">
                              {item.calories} kcal · C {item.carbs ?? 0}g · P {item.protein ?? 0}g · F {item.fat ?? 0}g
                            </p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => onDeleteItem(meal.id, item.id)}
                        className="text-espresso/30 hover:text-red-500 p-1 rounded-full transition-colors shrink-0 cursor-pointer"
                        aria-label={`Remove ${item.dishName}`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Photo scan — secondary to typing it in */}
      <div className="space-y-3">
        <button
          onClick={() => setShowPhotoScan((v) => !v)}
          className="w-full flex items-center justify-center gap-2 text-xs font-display font-bold text-espresso/70 hover:text-espresso border border-matcha bg-cream/70 py-2.5 rounded-xl transition-colors cursor-pointer"
          id="toggle-photo-scan"
        >
          <Camera className="w-4 h-4 text-sage" />
          {showPhotoScan ? "Hide photo scan" : "Or scan a photo instead"}
        </button>

        {showPhotoScan && (
          <div className="bg-sage p-5 rounded-[24px] text-cream space-y-3 shadow-premium">
            <p className="text-xs text-matcha leading-relaxed font-medium">
              Upload a plate photo and Gemini estimates the dish and its macros, then files it under{" "}
              <strong className="text-cream">{formatMealTypeLabel(mealType)}</strong> on{" "}
              <strong className="text-cream">{formatLogDateLabel(date, today).toLowerCase()}</strong>.
            </p>

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isParsing}
              className="w-full bg-cream text-espresso py-3 rounded-xl font-display font-bold text-xs transition-transform active:scale-98 shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              <Upload className="w-4 h-4 text-bakedclay" />
              {isParsing ? "Scanning…" : "Upload food photo"}
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/*"
              className="hidden"
            />

            {isParsing && (
              <div className="p-3 bg-cream/10 rounded-xl border border-cream/20 border-dashed text-center animate-pulse">
                <p className="text-[11px] font-mono uppercase tracking-wider text-matcha font-bold">
                  Gemini Vision scan active…
                </p>
              </div>
            )}

            {parseError && (
              <div className="p-3 bg-red-900/40 border border-red-500/40 text-xs rounded-xl flex items-start gap-2 text-cream">
                <AlertCircle className="w-4 h-4 text-red-300 shrink-0 mt-0.5" />
                <span>{parseError}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
