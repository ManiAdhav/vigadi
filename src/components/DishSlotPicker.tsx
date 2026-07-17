import DishSearchInput from "./DishSearchInput";
import { DishSlot, DISH_PICKER_PILLS } from "../../shared/mealTemplates";

interface DishSlotPickerProps {
  onSelect: (slot: DishSlot) => void;
  onCancel?: () => void;
  searchPlaceholder?: string;
  searchCategory?: string;
}

export default function DishSlotPicker({
  onSelect,
  onCancel,
  searchPlaceholder = "Search by dish, ingredient, or type…",
  searchCategory,
}: DishSlotPickerProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-[9px] font-mono uppercase text-espresso/40 font-bold">
          Find a specific dish
        </label>
        <p className="text-[10px] text-espresso/45 leading-snug">
          Search your catalog for a named dish — e.g. Lemon Rice, Carrot Poriyal
        </p>
        <DishSearchInput
          onSelect={onSelect}
          placeholder={searchPlaceholder}
          category={searchCategory}
        />
      </div>

      <div className="space-y-2.5">
        <div>
          <label className="text-[9px] font-mono uppercase text-espresso/40 font-bold">
            Or pick by group &amp; category
          </label>
          <p className="text-[10px] text-espresso/45 leading-snug mt-0.5">
            Adds a flexible slot — combos will pick any matching dish from your ingredients
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {DISH_PICKER_PILLS.map(({ label, slot }) => (
            <button
              key={label}
              type="button"
              onClick={() => onSelect(slot)}
              className="px-2.5 py-1.5 rounded-lg bg-[#F1F3ED] text-[11px] font-bold text-espresso/80 hover:bg-matcha/30 cursor-pointer border border-transparent hover:border-matcha/30"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="text-[10px] font-mono text-espresso/50 cursor-pointer"
        >
          Cancel
        </button>
      )}
    </div>
  );
}
