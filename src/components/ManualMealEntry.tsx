import { useState } from "react";
import { Check, Plus, Sun, UtensilsCrossed, Moon, Cookie, X } from "lucide-react";
import DishSearchInput from "./DishSearchInput";
import {
  MealLogItemInput,
  MealLogType,
  formatLogDateLabel,
  shiftIsoDate,
  todayIso,
  validateMealLogInput,
} from "../../shared/mealLogs";

interface ManualMealEntryProps {
  date: string;
  mealType: MealLogType;
  onDateChange: (date: string) => void;
  onMealTypeChange: (mealType: MealLogType) => void;
  onSave: (dishes: MealLogItemInput[]) => Promise<{ ok: boolean; error?: string }>;
}

const MEAL_OPTIONS: { id: MealLogType; label: string; Icon: typeof Sun }[] = [
  { id: "breakfast", label: "Breakfast", Icon: Sun },
  { id: "lunch", label: "Lunch", Icon: UtensilsCrossed },
  { id: "dinner", label: "Dinner", Icon: Moon },
  { id: "snack", label: "Snack", Icon: Cookie },
];

/** A staged dish, before the whole meal is saved in one go. */
interface StagedDish {
  key: string;
  name: string;
  dishId: number | null;
}

export default function ManualMealEntry({
  date,
  mealType,
  onDateChange,
  onMealTypeChange,
  onSave,
}: ManualMealEntryProps) {
  const [staged, setStaged] = useState<StagedDish[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  const today = todayIso();
  const yesterday = shiftIsoDate(today, -1);

  const addDish = (name: string, dishId?: number) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setStaged((prev) => [
      ...prev,
      { key: `${trimmed}-${Date.now()}-${prev.length}`, name: trimmed, dishId: dishId ?? null },
    ]);
    setError(null);
    setJustSaved(false);
  };

  const removeDish = (key: string) => {
    setStaged((prev) => prev.filter((d) => d.key !== key));
  };

  const handleSave = async () => {
    if (isSaving) return;
    const dishes: MealLogItemInput[] = staged.map((d) => ({ name: d.name, dishId: d.dishId }));
    // Never fail silently: say which piece is missing rather than sitting there disabled.
    const problem = validateMealLogInput(date, dishes);
    if (problem) {
      setError(problem);
      return;
    }
    setIsSaving(true);
    setError(null);
    const result = await onSave(dishes);
    setIsSaving(false);
    if (!result.ok) {
      setError(result.error ?? "Could not save that meal.");
      return;
    }
    setStaged([]);
    setJustSaved(true);
  };

  return (
    <div className="bg-cream border border-matcha p-5 rounded-3xl shadow-warm space-y-4" id="manual-meal-entry">
      <div className="space-y-1">
        <h2 className="font-display font-semibold text-espresso text-lg tracking-tight">
          What did you cook?
        </h2>
        <p className="text-xs text-espresso/60 font-medium">
          Type each dish and press Enter — it is saved exactly as you typed it. Tap a suggestion
          instead to use the catalog name.
        </p>
      </div>

      {/* Day picker — today and yesterday cover almost every log, the rest is a date field */}
      <div className="flex items-center gap-2 flex-wrap">
        {[today, yesterday].map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onDateChange(option)}
            className={`px-3 py-1.5 rounded-xl text-xs font-display font-bold border transition-colors cursor-pointer ${
              date === option
                ? "bg-sage text-cream border-sage"
                : "bg-cream text-espresso/70 border-matcha hover:border-sage/50"
            }`}
            id={`meal-date-${option}`}
          >
            {formatLogDateLabel(option, today)}
          </button>
        ))}
        <input
          type="date"
          value={date}
          max={today}
          onChange={(e) => e.target.value && onDateChange(e.target.value)}
          className="bg-cream border border-matcha text-xs text-espresso rounded-xl px-2.5 py-1.5 font-medium focus:outline-hidden focus:ring-1 focus:ring-sage/60"
          id="meal-date-picker"
        />
      </div>

      {/* Meal slot */}
      <div className="grid grid-cols-4 gap-2">
        {MEAL_OPTIONS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onMealTypeChange(id)}
            className={`flex flex-col items-center gap-1 py-2 rounded-xl border text-[10px] font-mono font-bold uppercase tracking-wider transition-colors cursor-pointer ${
              mealType === id
                ? "bg-bakedclay text-cream border-bakedclay"
                : "bg-cream text-espresso/60 border-matcha hover:border-bakedclay/40"
            }`}
            id={`meal-type-${id}`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Dish search — clears and refocuses after each pick so dishes go in back to back.
          Enter keeps what was typed; tap a suggestion to link it to the catalog. */}
      <DishSearchInput
        onSelect={(slot) => addDish(slot.dishName ?? "", slot.dishId)}
        placeholder="Rice, Sambar, Fish Fry…"
        commitTypedOnEnter
      />

      {/* Staged dishes for this meal */}
      {staged.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {staged.map((dish) => (
            <span
              key={dish.key}
              className="inline-flex items-center gap-1.5 bg-matcha/40 border border-matcha text-espresso text-xs font-semibold pl-3 pr-1.5 py-1.5 rounded-full"
            >
              {dish.name}
              {dish.dishId === null && (
                <span className="text-[9px] font-mono uppercase text-espresso/50">custom</span>
              )}
              <button
                type="button"
                onClick={() => removeDish(dish.key)}
                className="text-espresso/40 hover:text-red-500 p-0.5 rounded-full transition-colors cursor-pointer"
                aria-label={`Remove ${dish.name}`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {error && (
        <p className="text-xs text-red-600 font-semibold bg-red-50 border border-red-200 rounded-xl px-3 py-2">
          {error}
        </p>
      )}

      {justSaved && staged.length === 0 && (
        <p className="text-xs text-emerald-700 font-semibold flex items-center gap-1.5">
          <Check className="w-3.5 h-3.5" /> Saved to your diary.
        </p>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={isSaving || staged.length === 0}
        className="w-full bg-sage hover:bg-sage/95 disabled:opacity-45 disabled:cursor-not-allowed text-cream py-3 rounded-xl font-display font-bold text-sm transition-transform active:scale-98 flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
        id="save-manual-meal"
      >
        <Plus className="w-4 h-4" />
        {isSaving
          ? "Saving…"
          : `Log ${staged.length || ""} ${staged.length === 1 ? "dish" : "dishes"}`.replace(/\s+/g, " ")}
      </button>
    </div>
  );
}
