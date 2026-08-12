import { useState } from "react";
import { Carrot, Check, Plus, Sun, UtensilsCrossed, Moon, Cookie, X } from "lucide-react";
import DishSearchInput from "./DishSearchInput";
import IngredientAutocomplete from "./IngredientAutocomplete";
import {
  DishVariant,
  MealLogItemInput,
  MealLogType,
  formatLogDateLabel,
  shiftIsoDate,
  todayIso,
  validateMealLogInput,
} from "../../shared/mealLogs";
import {
  cleanLoggedIngredients,
  formatLoggedIngredients,
  resolveLoggedIngredient,
  type LoggedIngredient,
} from "../../shared/loggedIngredients";

interface ManualMealEntryProps {
  date: string;
  mealType: MealLogType;
  userId: string;
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
  /** What went into it today. Always optional — a plain dish logs as before. */
  ingredients: LoggedIngredient[];
  /** Her own past versions of this dish, offered as a starting point. */
  pastVersions: DishVariant[];
}

export default function ManualMealEntry({
  date,
  mealType,
  userId,
  onDateChange,
  onMealTypeChange,
  onSave,
}: ManualMealEntryProps) {
  const [staged, setStaged] = useState<StagedDish[]>([]);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  const today = todayIso();
  const yesterday = shiftIsoDate(today, -1);

  const updateDish = (key: string, change: (dish: StagedDish) => StagedDish) => {
    setStaged((prev) => prev.map((d) => (d.key === key ? change(d) : d)));
  };

  /**
   * Looks up how she has made this dish before. Purely a convenience: if the
   * lookup fails the dish still logs, just without the suggestion.
   */
  const loadPastVersions = async (key: string, name: string) => {
    try {
      const res = await fetch(
        `/api/logs/${userId}/variants?name=${encodeURIComponent(name)}`
      );
      if (!res.ok) return;
      const data = await res.json();
      const variants: DishVariant[] = Array.isArray(data.variants) ? data.variants : [];
      if (variants.length === 0) return;
      updateDish(key, (d) => ({ ...d, pastVersions: variants }));
    } catch {
      // Silence is right here — a missing suggestion must never block logging.
    }
  };

  const addDish = (name: string, dishId?: number) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const key = `${trimmed}-${Date.now()}-${staged.length}`;
    setStaged((prev) => [
      ...prev,
      { key, name: trimmed, dishId: dishId ?? null, ingredients: [], pastVersions: [] },
    ]);
    setError(null);
    setJustSaved(false);
    void loadPastVersions(key, trimmed);
  };

  const removeDish = (key: string) => {
    setStaged((prev) => prev.filter((d) => d.key !== key));
    setOpenKey((current) => (current === key ? null : current));
  };

  const addIngredient = (key: string, canonical: string, raw: string) => {
    const resolved = resolveLoggedIngredient({
      raw,
      // A tapped suggestion is a catalog name; typed text may not be, and
      // resolveLoggedIngredient decides which.
      canonical: canonical === raw ? null : canonical,
    });
    if (!resolved) return;
    updateDish(key, (d) => ({
      ...d,
      ingredients: cleanLoggedIngredients([...d.ingredients, resolved]),
    }));
  };

  const removeIngredient = (key: string, canonical: string) => {
    updateDish(key, (d) => ({
      ...d,
      ingredients: d.ingredients.filter((i) => i.canonical !== canonical),
    }));
  };

  /** Fills in a past version as a starting point — she can still change any of it. */
  const usePastVersion = (key: string, variant: DishVariant) => {
    updateDish(key, (d) => ({
      ...d,
      ingredients: cleanLoggedIngredients([...d.ingredients, ...variant.ingredients]),
    }));
  };

  const handleSave = async () => {
    if (isSaving) return;
    const dishes: MealLogItemInput[] = staged.map((d) => ({
      name: d.name,
      dishId: d.dishId,
      ingredients: d.ingredients,
    }));
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
    setOpenKey(null);
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
          instead to use the catalog name, then add what went into it.
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

      {/* Staged dishes for this meal. Each one can carry the ingredients that
          actually went into it — the same dish name is a different dish on a
          different day, so this is per entry and never mandatory. */}
      {staged.length > 0 && (
        <div className="space-y-2">
          {staged.map((dish) => {
            const isOpen = openKey === dish.key;
            const unusedVersions = dish.pastVersions.filter(
              (v) => !dish.ingredients.length
            );
            return (
              <div
                key={dish.key}
                className="bg-matcha/30 border border-matcha rounded-2xl px-3 py-2.5 space-y-2"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-espresso truncate flex-1">
                    {dish.name}
                  </span>
                  {dish.dishId === null && (
                    <span className="text-[9px] font-mono uppercase text-espresso/50 shrink-0">
                      custom
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setOpenKey(isOpen ? null : dish.key)}
                    aria-expanded={isOpen}
                    className={`shrink-0 inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-1 rounded-lg border transition-colors cursor-pointer ${
                      isOpen || dish.ingredients.length
                        ? "bg-sage text-cream border-sage"
                        : "bg-cream text-espresso/60 border-matcha hover:border-sage/50"
                    }`}
                    id={`toggle-ingredients-${dish.key}`}
                  >
                    <Carrot className="w-3 h-3" />
                    {dish.ingredients.length || "Add"}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeDish(dish.key)}
                    className="shrink-0 text-espresso/40 hover:text-red-500 p-0.5 rounded-full transition-colors cursor-pointer"
                    aria-label={`Remove ${dish.name}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {dish.ingredients.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {dish.ingredients.map((ing) => (
                      <span
                        key={ing.canonical}
                        className="inline-flex items-center gap-1 bg-cream border border-matcha text-espresso text-[11px] font-semibold pl-2.5 pr-1 py-1 rounded-full"
                      >
                        {ing.canonical}
                        {!ing.matched && (
                          <span
                            title="Not in the ingredient list yet — saved as you typed it"
                            className="text-[8px] font-mono uppercase text-bakedclay"
                          >
                            new
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => removeIngredient(dish.key, ing.canonical)}
                          className="text-espresso/40 hover:text-red-500 p-0.5 rounded-full transition-colors cursor-pointer"
                          aria-label={`Remove ${ing.canonical} from ${dish.name}`}
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {isOpen && (
                  <div className="space-y-2">
                    {/* Offered, never applied: the same sambar is rarely made twice. */}
                    {unusedVersions.map((variant) => (
                      <button
                        key={variant.signature}
                        type="button"
                        onClick={() => usePastVersion(dish.key, variant)}
                        className="w-full text-left bg-cream border border-dashed border-sage/60 rounded-xl px-3 py-2 hover:border-sage transition-colors cursor-pointer"
                      >
                        <span className="block text-[9px] font-mono uppercase tracking-wider text-espresso/50">
                          Last time · tap to use
                        </span>
                        <span className="block text-[11px] font-semibold text-espresso">
                          {formatLoggedIngredients(variant.ingredients)}
                        </span>
                      </button>
                    ))}
                    <IngredientAutocomplete
                      onSelect={(canonical, raw) => addIngredient(dish.key, canonical, raw)}
                      placeholder="Carrot, beans, chow chow…"
                      allowUnlisted
                    />
                  </div>
                )}
              </div>
            );
          })}
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
