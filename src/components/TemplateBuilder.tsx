import { useMemo, useState } from "react";
import { X, Plus, Copy, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import {
  ALL_DISH_CATEGORIES,
  createTemplateId,
  DISH_CATEGORY_LABELS,
  DishCategory,
  DishSlot,
  formatTemplatePreview,
  MealSlot,
  MealTemplate,
} from "../../shared/mealTemplates";

interface TemplateBuilderProps {
  templates: MealTemplate[];
  editing?: MealTemplate | null;
  onSave: (template: MealTemplate) => void;
  onDuplicate: (templateId: string) => void;
  onDelete: (templateId: string) => void;
  onClose: () => void;
}

const MEAL_SLOT_OPTIONS: { id: MealSlot; label: string }[] = [
  { id: "breakfast", label: "Breakfast" },
  { id: "lunch", label: "Lunch" },
  { id: "dinner", label: "Dinner" },
];

const DAY_TYPE_OPTIONS = [
  { id: "school_day", label: "School Day" },
  { id: "holiday", label: "Holiday" },
  { id: "any", label: "Any" },
];

function emptySlot(): DishSlot {
  return { category: "side_poriyal", count: 1 };
}

function blankTemplate(): MealTemplate {
  return {
    id: createTemplateId(),
    name: "",
    meal_slots: ["lunch"],
    day_types: ["any"],
    slots: [emptySlot()],
  };
}

export default function TemplateBuilder({
  templates,
  editing,
  onSave,
  onDuplicate,
  onDelete,
  onClose,
}: TemplateBuilderProps) {
  const [draft, setDraft] = useState<MealTemplate>(editing ? { ...editing } : blankTemplate());
  const [customDayType, setCustomDayType] = useState("");
  const [showBalance, setShowBalance] = useState(!!draft.balance_target);
  const [listMode, setListMode] = useState(!editing);

  const preview = useMemo(() => formatTemplatePreview(draft), [draft]);

  const toggleMealSlot = (slot: MealSlot) => {
    setDraft((prev) => {
      const next = prev.meal_slots.includes(slot)
        ? prev.meal_slots.filter((s) => s !== slot)
        : [...prev.meal_slots, slot];
      return { ...prev, meal_slots: next.length ? next : [slot] };
    });
  };

  const toggleDayType = (dayType: string) => {
    setDraft((prev) => {
      const next = prev.day_types.includes(dayType)
        ? prev.day_types.filter((d) => d !== dayType)
        : [...prev.day_types, dayType];
      return { ...prev, day_types: next.length ? next : ["any"] };
    });
  };

  const addCustomDayType = () => {
    const tag = customDayType.trim().toLowerCase().replace(/\s+/g, "_");
    if (!tag) return;
    setDraft((prev) => ({
      ...prev,
      day_types: prev.day_types.includes(tag) ? prev.day_types : [...prev.day_types, tag],
    }));
    setCustomDayType("");
  };

  const updateSlot = (index: number, patch: Partial<DishSlot>) => {
    setDraft((prev) => ({
      ...prev,
      slots: prev.slots.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    }));
  };

  const toggleOrCategory = (index: number, category: DishCategory) => {
    setDraft((prev) => {
      const slot = prev.slots[index];
      const options = slot.options ?? [];
      const hasOr = options.includes(category);
      const nextOptions = hasOr ? options.filter((c) => c !== category) : [...options, category];
      return {
        ...prev,
        slots: prev.slots.map((s, i) =>
          i === index ? { ...s, options: nextOptions.length ? nextOptions : undefined } : s
        ),
      };
    });
  };

  const addSlot = () => setDraft((prev) => ({ ...prev, slots: [...prev.slots, emptySlot()] }));

  const removeSlot = (index: number) => {
    setDraft((prev) => ({
      ...prev,
      slots: prev.slots.length > 1 ? prev.slots.filter((_, i) => i !== index) : prev.slots,
    }));
  };

  const handleSave = () => {
    if (!draft.name.trim() || draft.slots.length === 0) return;
    onSave({ ...draft, name: draft.name.trim() });
    setListMode(true);
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
            {templates.map((tpl) => (
              <div key={tpl.id} className="border border-matcha/30 rounded-2xl p-3 bg-white space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-sm text-espresso">{tpl.name}</h3>
                    <p className="text-[11px] text-espresso/60">{formatTemplatePreview(tpl)}</p>
                    <p className="text-[9px] font-mono text-espresso/40 uppercase mt-1">
                      {tpl.meal_slots.join(" · ")} · {tpl.day_types.join(", ")}
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
                    {!tpl.id.startsWith("preset-") && (
                      <button
                        type="button"
                        onClick={() => onDelete(tpl.id)}
                        className="p-1.5 rounded-lg border border-matcha/30 text-red-500/70 hover:text-red-600 cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDraft({ ...tpl });
                    setListMode(false);
                  }}
                  className="text-[10px] font-mono uppercase text-bakedclay font-bold cursor-pointer"
                >
                  Edit template
                </button>
              </div>
            ))}
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
            {editing ? "Edit Template" : draft.id ? "Edit Template" : "New Template"}
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
            placeholder="School Day Breakfast"
            className="w-full bg-[#F1F3ED] border border-matcha/30 px-3 py-2.5 rounded-xl text-xs font-semibold text-espresso"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-mono uppercase tracking-wider text-espresso/50 font-bold">Applies to — meal slot</label>
          <div className="flex flex-wrap gap-1.5">
            {MEAL_SLOT_OPTIONS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => toggleMealSlot(id)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer ${
                  draft.meal_slots.includes(id)
                    ? "bg-espresso text-cream"
                    : "bg-[#F1F3ED] text-espresso/70 border border-matcha/20"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-mono uppercase tracking-wider text-espresso/50 font-bold">Day type</label>
          <div className="flex flex-wrap gap-1.5">
            {DAY_TYPE_OPTIONS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => toggleDayType(id)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer ${
                  draft.day_types.includes(id)
                    ? "bg-espresso text-cream"
                    : "bg-[#F1F3ED] text-espresso/70 border border-matcha/20"
                }`}
              >
                {label}
              </button>
            ))}
            {draft.day_types
              .filter((d) => !DAY_TYPE_OPTIONS.some((o) => o.id === d))
              .map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleDayType(tag)}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-bakedclay/20 text-bakedclay cursor-pointer"
                >
                  {tag.replace(/_/g, " ")} ×
                </button>
              ))}
          </div>
          <div className="flex gap-2">
            <input
              value={customDayType}
              onChange={(e) => setCustomDayType(e.target.value)}
              placeholder="Festival, Fasting…"
              className="flex-1 bg-[#F1F3ED] border border-matcha/30 px-3 py-2 rounded-xl text-xs font-semibold text-espresso"
            />
            <button
              type="button"
              onClick={addCustomDayType}
              className="px-3 py-2 rounded-xl bg-matcha text-espresso text-xs font-bold cursor-pointer"
            >
              + Add
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-[10px] font-mono uppercase tracking-wider text-espresso/50 font-bold">Dish slots</label>
          {draft.slots.map((slot, index) => (
            <div key={index} className="border border-matcha/25 rounded-2xl p-3 bg-white space-y-2">
              <div className="flex flex-wrap gap-1">
                {ALL_DISH_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => updateSlot(index, { category: cat })}
                    className={`px-2 py-1 rounded-md text-[10px] font-bold cursor-pointer ${
                      slot.category === cat
                        ? "bg-[#2E9D70] text-white"
                        : "bg-[#F1F3ED] text-espresso/60"
                    }`}
                  >
                    {DISH_CATEGORY_LABELS[cat]}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-espresso/50">Count</span>
                  <button
                    type="button"
                    onClick={() => updateSlot(index, { count: Math.max(1, slot.count - 1) })}
                    className="w-7 h-7 rounded-lg bg-[#F1F3ED] text-espresso font-bold cursor-pointer"
                  >
                    −
                  </button>
                  <span className="text-sm font-bold w-4 text-center">{slot.count}</span>
                  <button
                    type="button"
                    onClick={() => updateSlot(index, { count: slot.count + 1 })}
                    className="w-7 h-7 rounded-lg bg-[#F1F3ED] text-espresso font-bold cursor-pointer"
                  >
                    +
                  </button>
                </div>
                {draft.slots.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeSlot(index)}
                    className="text-[10px] text-red-500 font-bold cursor-pointer"
                  >
                    Remove
                  </button>
                )}
              </div>

              <div className="space-y-1">
                <span className="text-[9px] font-mono uppercase text-espresso/40">OR combine with</span>
                <div className="flex flex-wrap gap-1">
                  {ALL_DISH_CATEGORIES.filter((c) => c !== slot.category).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => toggleOrCategory(index, cat)}
                      className={`px-2 py-0.5 rounded-md text-[9px] font-bold cursor-pointer ${
                        slot.options?.includes(cat)
                          ? "bg-bakedclay text-white"
                          : "bg-[#F1F3ED] text-espresso/50"
                      }`}
                    >
                      {DISH_CATEGORY_LABELS[cat]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addSlot}
            className="w-full py-2 rounded-xl border border-dashed border-matcha/40 text-[11px] font-bold text-espresso/60 hover:border-[#2E9D70] cursor-pointer flex items-center justify-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Add slot
          </button>
        </div>

        <div className="bg-[#F1F3ED] border border-matcha/20 rounded-xl p-3">
          <p className="text-[9px] font-mono uppercase text-espresso/40 font-bold mb-1">Preview</p>
          <p className="text-sm font-semibold text-espresso">{preview || "Add slots to see preview"}</p>
        </div>

        <div className="border border-matcha/20 rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setShowBalance(!showBalance)}
            className="w-full flex items-center justify-between px-3 py-2.5 bg-white text-[10px] font-mono uppercase text-espresso/60 font-bold cursor-pointer"
          >
            Balance target (optional)
            {showBalance ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showBalance && (
            <div className="p-3 space-y-3 bg-[#F1F3ED]/50">
              {(["carb", "veg", "protein"] as const).map((key) => (
                <div key={key} className="space-y-1">
                  <div className="flex justify-between text-[10px] font-mono uppercase text-espresso/50">
                    <span>{key}</span>
                    <span>{draft.balance_target?.[key] ?? (key === "carb" ? 50 : key === "veg" ? 30 : 20)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={draft.balance_target?.[key] ?? (key === "carb" ? 50 : key === "veg" ? 30 : 20)}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        balance_target: {
                          carb: prev.balance_target?.carb ?? 50,
                          veg: prev.balance_target?.veg ?? 30,
                          protein: prev.balance_target?.protein ?? 20,
                          [key]: Number(e.target.value),
                        },
                      }))
                    }
                    className="w-full accent-[#2E9D70]"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => (editing ? onClose() : setListMode(true))}
            className="flex-1 py-3 rounded-xl border border-matcha text-xs font-bold text-espresso cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!draft.name.trim()}
            className="flex-1 py-3 rounded-xl bg-[#2E9D70] text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
          >
            Save template
          </button>
        </div>
      </div>
    </div>
  );
}
