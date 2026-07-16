import { useMemo, useState } from "react";
import DishSearchInput from "./DishSearchInput";
import { X, Plus, Copy, Trash2, Sun, UtensilsCrossed, Moon } from "lucide-react";
import {
  createFoodPlateId,
  formatFoodPlatePreview,
  formatWeekdays,
  FoodPlate,
  prepareFoodPlateForSave,
  WEEKDAY_LABELS,
} from "../../shared/foodPlates";
import {
  DishSlot,
  formatSlotLabel,
  MealSlot,
  QUICK_DISH_PRESETS,
} from "../../shared/mealTemplates";

interface FoodPlateBuilderProps {
  plates: FoodPlate[];
  editing?: FoodPlate | null;
  onSave: (plate: FoodPlate) => Promise<{ ok: boolean; error?: string }>;
  onDuplicate: (plateId: string) => void;
  onDelete: (plateId: string) => void | Promise<boolean>;
  onClose: () => void;
}

const MEAL_OPTIONS: { id: MealSlot; label: string; Icon: typeof Sun }[] = [
  { id: "breakfast", label: "Breakfast", Icon: Sun },
  { id: "lunch", label: "Lunch", Icon: UtensilsCrossed },
  { id: "dinner", label: "Dinner", Icon: Moon },
];

function blankPlate(): FoodPlate {
  return {
    id: createFoodPlateId(),
    name: "",
    meal_slot: "lunch",
    slots: [
      { category: "rice_staple", count: 1 },
      { category: "curry", count: 1 },
      { category: "side_poriyal", count: 2 },
      { category: "protein", count: 1 },
    ],
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    source: "manual",
  };
}

function initDraft(editing?: FoodPlate | null): FoodPlate {
  if (!editing) return blankPlate();
  return {
    ...editing,
    slots: editing.slots.map((s) => ({
      ...s,
      options: s.options ? [...s.options] : undefined,
    })),
    weekdays: [...editing.weekdays],
  };
}

export default function FoodPlateBuilder({
  plates,
  editing,
  onSave,
  onDuplicate,
  onDelete,
  onClose,
}: FoodPlateBuilderProps) {
  const [draft, setDraft] = useState<FoodPlate>(() => initDraft(editing));
  const [listMode, setListMode] = useState(!editing);
  const [editingPlateId, setEditingPlateId] = useState<string | null>(editing?.id ?? null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showAddPicker, setShowAddPicker] = useState(false);
  const isEditingExisting = !!editingPlateId;

  const preview = useMemo(() => formatFoodPlatePreview(draft), [draft]);

  const toggleWeekday = (day: number) => {
    setDraft((prev) => {
      const has = prev.weekdays.includes(day);
      const weekdays = has
        ? prev.weekdays.filter((d) => d !== day)
        : [...prev.weekdays, day].sort((a, b) => a - b);
      return { ...prev, weekdays };
    });
  };

  const addSlot = (slot: DishSlot) => {
    setDraft((prev) => ({
      ...prev,
      slots: [
        ...prev.slots,
        { ...slot, options: slot.options ? [...slot.options] : undefined },
      ],
    }));
    setShowAddPicker(false);
  };

  const removeSlot = (index: number) => {
    setDraft((prev) => ({
      ...prev,
      slots: prev.slots.filter((_, i) => i !== index),
    }));
  };

  const handleDelete = (plateId: string, plateName: string) => {
    if (!window.confirm(`Delete "${plateName}"? This cannot be undone.`)) return;
    onDelete(plateId);
  };

  const handleSave = async () => {
    if (!draft.name.trim() || draft.slots.length === 0 || draft.weekdays.length === 0 || isSaving) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const prepared = prepareFoodPlateForSave(draft);
      const result = await onSave(prepared);
      if (result.ok) {
        if (editing) {
          onClose();
        } else {
          setListMode(true);
          setEditingPlateId(null);
          setDraft(blankPlate());
          setShowAddPicker(false);
        }
      } else {
        setSaveError(result.error || "Could not save food plate. Please try again.");
      }
    } catch {
      setSaveError("Could not save food plate. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  if (listMode && !editing) {
    return (
      <div className="fixed inset-0 z-50 bg-espresso/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
        <div className="bg-cream w-full max-w-md max-h-[90vh] overflow-y-auto rounded-t-[28px] sm:rounded-[28px] border border-matcha shadow-premium p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-bold text-lg text-espresso">My Food Plan</h2>
            <button type="button" onClick={onClose} className="text-espresso/50 hover:text-espresso cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-2">
            {plates.map((plate) => (
              <div key={plate.id} className="border border-matcha/30 rounded-2xl p-3 bg-white space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-sm text-espresso">{plate.name}</h3>
                    <p className="text-[11px] text-espresso/60">{formatFoodPlatePreview(plate)}</p>
                    <p className="text-[9px] font-mono text-espresso/40 uppercase mt-1">
                      {plate.meal_slot} · {formatWeekdays(plate.weekdays)}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onDuplicate(plate.id)}
                      className="p-1.5 rounded-lg border border-matcha/30 text-espresso/60 hover:text-espresso cursor-pointer"
                      title="Duplicate"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(plate.id, plate.name)}
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
                    setDraft(initDraft(plate));
                    setEditingPlateId(plate.id);
                    setListMode(false);
                    setSaveError(null);
                    setShowAddPicker(false);
                  }}
                  className="text-[10px] font-mono uppercase text-bakedclay font-bold cursor-pointer"
                >
                  Edit plate
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              setDraft(blankPlate());
              setEditingPlateId(null);
              setListMode(false);
              setSaveError(null);
              setShowAddPicker(false);
            }}
            className="w-full py-3 rounded-xl border-2 border-dashed border-matcha/40 text-xs font-bold text-espresso/70 hover:border-bakedclay hover:text-bakedclay cursor-pointer flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New food plate
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
            {isEditingExisting ? "Edit Food Plate" : "New Food Plate"}
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
            placeholder="Balanced Lunch"
            className="w-full bg-[#F1F3ED] border border-matcha/30 px-3 py-2.5 rounded-xl text-xs font-semibold text-espresso"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-mono uppercase tracking-wider text-espresso/50 font-bold">Meal</label>
          <div className="flex gap-2">
            {MEAL_OPTIONS.map(({ id, label, Icon }) => {
              const active = draft.meal_slot === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setDraft((prev) => ({ ...prev, meal_slot: id }))}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-bold border cursor-pointer transition-all ${
                    active
                      ? "bg-[#2E9D70] border-[#2E9D70] text-white"
                      : "bg-[#F1F3ED] border-matcha/20 text-espresso/70 hover:bg-matcha/10"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-mono uppercase tracking-wider text-espresso/50 font-bold">Days</label>
          <div className="flex gap-1.5">
            {WEEKDAY_LABELS.map((label, day) => {
              const active = draft.weekdays.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleWeekday(day)}
                  className={`w-9 h-9 rounded-lg text-[10px] font-bold border cursor-pointer transition-all ${
                    active
                      ? "bg-[#2E9D70] border-[#2E9D70] text-white"
                      : "bg-[#F1F3ED] border-matcha/20 text-espresso/50 hover:bg-matcha/10"
                  }`}
                >
                  {label.charAt(0)}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-espresso/50 font-mono">{formatWeekdays(draft.weekdays)}</p>
        </div>

        <div className="border border-matcha/25 rounded-2xl bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-matcha/15">
            <span className="font-semibold text-sm text-espresso">What you eat</span>
          </div>

          {draft.slots.length > 0 ? (
            <ul className="divide-y divide-matcha/10">
              {draft.slots.map((slot, index) => (
                <li key={index} className="flex items-center gap-2 px-4 py-3">
                  <span className="flex-1 text-sm font-medium text-espresso">{formatSlotLabel(slot)}</span>
                  <button
                    type="button"
                    onClick={() => removeSlot(index)}
                    className="p-1 text-espresso/40 hover:text-red-500 cursor-pointer shrink-0"
                    aria-label={`Remove ${formatSlotLabel(slot)}`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-3 text-[11px] text-espresso/50 italic">Add dishes to define your plate</p>
          )}

          <div className="px-4 py-3 border-t border-matcha/10">
            {showAddPicker ? (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-mono uppercase text-espresso/40 font-bold">
                    Search or type dish name
                  </label>
                  <DishSearchInput
                    onSelect={addSlot}
                    placeholder="Search dishes…"
                  />
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
                        onClick={() => addSlot(slot)}
                        className="px-2.5 py-1.5 rounded-lg bg-[#F1F3ED] text-[11px] font-bold text-espresso/80 hover:bg-matcha/30 cursor-pointer"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddPicker(false)}
                  className="text-[10px] font-mono text-espresso/50 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowAddPicker(true)}
                className="text-[11px] font-bold text-espresso/60 hover:text-bakedclay cursor-pointer flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                add dish
              </button>
            )}
          </div>
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
            onClick={() => {
              if (editing) {
                onClose();
                return;
              }
              setListMode(true);
              setEditingPlateId(null);
              setDraft(blankPlate());
              setSaveError(null);
              setShowAddPicker(false);
            }}
            disabled={isSaving}
            className="flex-1 py-3 rounded-xl border border-matcha text-xs font-bold text-espresso cursor-pointer disabled:opacity-50"
          >
            {editing ? "Cancel" : "Back"}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!draft.name.trim() || draft.slots.length === 0 || draft.weekdays.length === 0 || isSaving}
            className="flex-1 py-3 rounded-xl bg-[#2E9D70] text-white text-xs font-bold cursor-pointer disabled:opacity-40"
          >
            {isSaving ? "Saving…" : "Save plate"}
          </button>
        </div>
      </div>
    </div>
  );
}
