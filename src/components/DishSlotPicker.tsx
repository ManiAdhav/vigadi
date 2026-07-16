import DishSearchInput from "./DishSearchInput";
import {
  DishSlot,
  MEAL_GROUP_LABELS,
  MEAL_GROUP_SLOT_PRESETS,
  MealGroup,
} from "../../shared/mealTemplates";

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
            Or pick by meal group &amp; type
          </label>
          <p className="text-[10px] text-espresso/45 leading-snug mt-0.5">
            Adds a flexible slot — combos will pick any matching dish from your ingredients
          </p>
        </div>

        {MEAL_GROUP_SLOT_PRESETS.map(({ group, dishTypes }) => (
          <MealGroupRow key={group} group={group} dishTypes={dishTypes} onSelect={onSelect} />
        ))}
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

function MealGroupRow({
  group,
  dishTypes,
  onSelect,
}: {
  group: MealGroup;
  dishTypes: Array<{ label: string; slot: DishSlot }>;
  onSelect: (slot: DishSlot) => void;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="shrink-0 w-14 pt-1.5 text-[10px] font-mono font-bold uppercase text-espresso/50">
        {MEAL_GROUP_LABELS[group]}
      </span>
      <div className="flex flex-wrap gap-1.5 flex-1">
        {dishTypes.map(({ label, slot }) => (
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
  );
}
