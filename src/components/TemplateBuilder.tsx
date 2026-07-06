import { useMemo, useState } from "react";
import DishSearchInput from "./DishSearchInput";
import { X, Plus, Copy, Trash2, Sun, UtensilsCrossed, Moon, RefreshCw } from "lucide-react";
import {
  createBlankMealPlan,
  createTemplateId,
  DishSlot,
  formatMealSectionPreview,
  formatReuseLabel,
  formatSlotLabel,
  formatTemplatePreview,
  MealPlan,
  MealSlot,
  MealTemplate,
  normalizeTemplate,
  prepareTemplateForSave,
  QUICK_DISH_PRESETS,
  reuseOptionsForMeal,
  templateMealsLabel,
} from "../../shared/mealTemplates";

interface TemplateBuilderProps {
  templates: MealTemplate[];
  editing?: MealTemplate | null;
  onSave: (template: MealTemplate) => Promise<{ ok: boolean; error?: string }>;
  onDuplicate: (templateId: string) => void;
  onDelete: (templateId: string) => void | Promise<boolean>;
  onClose: () => void;
}

const MEAL_SECTIONS: { id: MealSlot; label: string; Icon: typeof Sun }[] = [
  { id: "breakfast", label: "Breakfast", Icon: Sun },
  { id: "lunch", label: "Lunch", Icon: UtensilsCrossed },
  { id: "dinner", label: "Dinner", Icon: Moon },
];

function blankTemplate(): MealTemplate {
  return {
    id: createTemplateId(),
    name: "",
    meals: {
      breakfast: [
        { category: "tiffin", count: 1 },
        { category: "chutney", count: 1, options: ["sambar"] },
      ],
      lunch: [{ category: "mixed_rice", count: 1 }],
    },
  };
}

function cloneMeals(meals: MealPlan): MealPlan {
  const next: MealPlan = {};
  for (const ms of ["breakfast", "lunch", "dinner"] as MealSlot[]) {
    const slots = meals[ms];
    if (slots?.length) {
      next[ms] = slots.map((s) => ({
        ...s,
        options: s.options ? [...s.options] : undefined,
      }));
    }
  }
  return next;
}

function initDraft(editing?: MealTemplate | null): MealTemplate {
  if (!editing) return blankTemplate();
  const normalized = normalizeTemplate(editing);
  return {
    ...normalized,
    meals: cloneMeals(normalized.meals),
  };
}

function hasAnyDishes(meals: MealPlan): boolean {
  return (["breakfast", "lunch", "dinner"] as MealSlot[]).some((ms) => (meals[ms]?.length ?? 0) > 0);
}

export default function TemplateBuilder({
  templates,
  editing,
  onSave,
  onDuplicate,
  onDelete,
  onClose,
}: TemplateBuilderProps) {
  const [draft, setDraft] = useState<MealTemplate>(() => initDraft(editing));
  const [listMode, setListMode] = useState(!editing);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [addPickerFor, setAddPickerFor] = useState<MealSlot | null>(null);

  const meals = draft.meals ?? createBlankMealPlan();
  const preview = useMemo(() => formatTemplatePreview({ ...draft, meals }), [draft, meals]);

  const updateMealSlots = (mealSlot: MealSlot, slots: DishSlot[]) => {
    setDraft((prev) => ({
      ...prev,
      meals: { ...(prev.meals ?? createBlankMealPlan()), [mealSlot]: slots },
    }));
  };

  const addDish = (mealSlot: MealSlot, slot: DishSlot) => {
    const current = meals[mealSlot] ?? [];
    updateMealSlots(mealSlot, [...current, { ...slot, options: slot.options ? [...slot.options] : undefined }]);
    setAddPickerFor(null);
  };

  const removeDish = (mealSlot: MealSlot, index: number) => {
    const current = meals[mealSlot] ?? [];
    updateMealSlots(
      mealSlot,
      current.filter((_, i) => i !== index)
    );
  };

  const cycleReuse = (mealSlot: MealSlot, index: number) => {
    const current = meals[mealSlot] ?? [];
    const slot = current[index];
    const options = reuseOptionsForMeal(mealSlot, meals);
    const currentIdx = options.findIndex((o) => o === slot.reuse);
    const nextReuse = options[(currentIdx + 1) % options.length];
    updateMealSlots(
      mealSlot,
      current.map((s, i) => (i === index ? { ...s, reuse: nextReuse } : s))
    );
  };

  const handleDelete = (templateId: string, templateName: string) => {
    if (!window.confirm(`Delete "${templateName}"? This cannot be undone.`)) return;
    onDelete(templateId);
  };

  const handleSave = async () => {
    if (!draft.name.trim() || !hasAnyDishes(meals) || isSaving) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const prepared = prepareTemplateForSave({ ...draft, meals });
      const result = await onSave(prepared);
      if (result.ok) {
        onClose();
      } else {
        setSaveError(result.error || "Could not save template. Please try again.");
      }
    } catch {
      setSaveError("Could not save template. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  if (listMode && !editing) {
    return (
      <div className="fixed inset-0 z-50 bg-espresso/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
        <div className="bg-cream w-full max-w-md max-h-[90vh] overflow-y-auto rounded-t-[28px] sm:rounded-[28px] border border-matcha shadow-premium p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-bold text-lg text-espresso">Meal Templates</h2>
            <button type="button" onClick={onClose} className="text-espresso/50 hover:text-espresso cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-2">
            {templates.map((tpl) => {
              const normalized = normalizeTemplate(tpl);
              return (
                <div key={tpl.id} className="border border-matcha/30 rounded-2xl p-3 bg-white space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-sm text-espresso">{tpl.name}</h3>
                      <p className="text-[11px] text-espresso/60">{formatTemplatePreview(normalized)}</p>
                      <p className="text-[9px] font-mono text-espresso/40 uppercase mt-1">
                        {templateMealsLabel(normalized)}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => onDuplicate(tpl.id)}
                        className="p-1.5 rounded-lg border border-matcha/30 text-espresso/60 hover:text-espresso cursor-pointer"
                        title="Duplicate"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(tpl.id, tpl.name)}
                        className="p-1.5 rounded-lg border border-matcha/30 text-red-500/70 hover:text-red-600 cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setDraft(initDraft(tpl));
                      setListMode(false);
                    }}
                    className="text-[10px] font-mono uppercase text-bakedclay font-bold cursor-pointer"
                  >
                    Edit template
                  </button>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => {
              setDraft(blankTemplate());
              setListMode(false);
            }}
            className="w-full py-3 rounded-xl border-2 border-dashed border-matcha/40 text-xs font-bold text-espresso/70 hover:border-bakedclay hover:text-bakedclay cursor-pointer flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New template
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-espresso/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-cream w-full max-w-md max-h-[90vh] overflow-y-auto rounded-t-[28px] sm:rounded-[28px] border border-matcha shadow-premium p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-lg text-espresso">
            {editing ? "Edit Template" : "New Template"}
          </h2>
          <button type="button" onClick={onClose} className="text-espresso/50 hover:text-espresso cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-mono uppercase tracking-wider text-espresso/50 font-bold">Name</label>
          <input
            value={draft.name}
            onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="School Day Combo"
            className="w-full bg-[#F1F3ED] border border-matcha/30 px-3 py-2.5 rounded-xl text-xs font-semibold text-espresso"
          />
        </div>

        <div className="space-y-3">
          {MEAL_SECTIONS.map(({ id, label, Icon }) => {
            const slots = meals[id] ?? [];
            return (
              <div key={id} className="border border-matcha/25 rounded-2xl bg-white overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-matcha/15">
                  <Icon className="w-4 h-4 text-espresso/70" />
                  <span className="font-semibold text-sm text-espresso">{label}</span>
                </div>

                {slots.length > 0 ? (
                  <ul className="divide-y divide-matcha/10">
                    {slots.map((slot, index) => {
                      const reuseLabel = formatReuseLabel(slot.reuse);
                      const canReuse =
                        slot.category === "side_poriyal" ||
                        slot.category === "protein" ||
                        slot.category === "curry" ||
                        slot.category === "kulambu";
                      return (
                        <li key={index} className="flex items-center gap-2 px-4 py-3">
                          <span className="flex-1 text-sm font-medium text-espresso">{formatSlotLabel(slot)}</span>
                          {canReuse && (
                            <button
                              type="button"
                              onClick={() => cycleReuse(id, index)}
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-mono font-bold shrink-0 cursor-pointer ${
                                slot.reuse === "all_meals"
                                  ? "bg-sage/30 text-espresso border border-sage/40"
                                  : slot.reuse
                                    ? "bg-matcha/40 text-espresso border border-matcha/30"
                                    : "bg-[#F1F3ED] text-espresso/40 border border-matcha/20"
                              }`}
                              title="Tap to change reuse"
                            >
                              <RefreshCw className="w-3 h-3" />
                              {reuseLabel ?? "cook here"}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => removeDish(id, index)}
                            className="p-1 text-espresso/40 hover:text-red-500 cursor-pointer shrink-0"
                            aria-label={`Remove ${formatSlotLabel(slot)}`}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="px-4 py-3 text-[11px] text-espresso/50 italic">
                    {formatMealSectionPreview(id, slots)}
                  </p>
                )}

                <div className="px-4 py-3 border-t border-matcha/10">
                  {addPickerFor === id ? (
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-mono uppercase text-espresso/40 font-bold">
                          Search or type dish name
                        </label>
                        <DishSearchInput onSelect={(slot) => addDish(id, slot)} />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-mono uppercase text-espresso/40 font-bold">
                          Or pick a category
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {QUICK_DISH_PRESETS.map(({ label, slot }) => (
                            <button
                              key={label}
                              type="button"
                              onClick={() => addDish(id, slot)}
                              className="px-2.5 py-1.5 rounded-lg bg-[#F1F3ED] text-[11px] font-bold text-espresso/80 hover:bg-matcha/30 cursor-pointer"
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAddPickerFor(null)}
                        className="text-[10px] font-mono text-espresso/50 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAddPickerFor(id)}
                      className="text-[11px] font-bold text-espresso/60 hover:text-bakedclay cursor-pointer flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      add dish
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="bg-[#F1F3ED] border border-matcha/20 rounded-xl p-3">
          <p className="text-[9px] font-mono uppercase text-espresso/40 font-bold mb-1">Preview</p>
          <p className="text-sm font-semibold text-espresso">{preview || "Add dishes to see preview"}</p>
        </div>

        {saveError && (
          <div className="bg-red-50 border border-red-200 text-xs text-red-700 p-3 rounded-xl">{saveError}</div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => (editing ? onClose() : setListMode(true))}
            disabled={isSaving}
            className="flex-1 py-3 rounded-xl border border-matcha text-xs font-bold text-espresso cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!draft.name.trim() || !hasAnyDishes(meals) || isSaving}
            className="flex-1 py-3 rounded-xl bg-[#2E9D70] text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
          >
            {isSaving ? "Saving…" : "Save template"}
          </button>
        </div>
      </div>
    </div>
  );
}
