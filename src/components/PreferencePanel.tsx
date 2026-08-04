import { useCallback, useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import {
  Diet,
  DEFAULT_PREFERENCES,
  PreferenceProfile,
  ProteinEmphasis,
  preferenceSummaryText,
} from "../../shared/preferences";

interface PreferencePanelProps {
  userId: string;
}

const DIET_OPTIONS: { id: Diet; label: string }[] = [
  { id: "veg", label: "Vegetarian" },
  { id: "veg_egg", label: "Vegetarian + Egg" },
];

const PROTEIN_OPTIONS: { id: ProteinEmphasis; label: string }[] = [
  { id: "light", label: "Light" },
  { id: "balanced", label: "Balanced" },
  { id: "high", label: "High" },
];

export default function PreferencePanel({ userId }: PreferencePanelProps) {
  const [prefs, setPrefs] = useState<PreferenceProfile>(DEFAULT_PREFERENCES);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/preferences/${userId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.preferences) setPrefs(data.preferences);
    } catch {
      /* keep defaults */
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const update = async (next: PreferenceProfile) => {
    setPrefs(next);
    setIsSaving(true);
    try {
      await fetch(`/api/preferences/${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: next }),
      });
    } catch {
      /* the picker still reflects the choice locally; next load will resync */
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="mb-6">
      <div className="border border-matcha/30 rounded-2xl bg-white p-4 space-y-3.5">
        <div className="flex items-start gap-2.5">
          <Sparkles className="w-5 h-5 text-bakedclay shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-espresso">User Preference</p>
            <p className="text-[11px] text-espresso/60 leading-snug">
              Used to suggest a combo whenever a meal has no food plate.
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-mono uppercase tracking-wider text-espresso/50 font-bold">
            Diet
          </label>
          <div className="flex gap-2">
            {DIET_OPTIONS.map(({ id, label }) => {
              const active = prefs.diet === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => update({ ...prefs, diet: id })}
                  disabled={isSaving}
                  className={`flex-1 py-2 rounded-xl text-[11px] font-bold border cursor-pointer transition-all disabled:opacity-60 ${
                    active
                      ? "bg-[#2E9D70] border-[#2E9D70] text-white"
                      : "bg-[#F1F3ED] border-matcha/20 text-espresso/70 hover:bg-matcha/10"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-mono uppercase tracking-wider text-espresso/50 font-bold">
            Protein emphasis
          </label>
          <div className="flex gap-2">
            {PROTEIN_OPTIONS.map(({ id, label }) => {
              const active = prefs.proteinEmphasis === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => update({ ...prefs, proteinEmphasis: id })}
                  disabled={isSaving}
                  className={`flex-1 py-2 rounded-xl text-[11px] font-bold border cursor-pointer transition-all disabled:opacity-60 ${
                    active
                      ? "bg-[#2E9D70] border-[#2E9D70] text-white"
                      : "bg-[#F1F3ED] border-matcha/20 text-espresso/70 hover:bg-matcha/10"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-[#F1F3ED] border border-matcha/20 rounded-xl px-3 py-2.5">
          <p className="text-[9px] font-mono uppercase text-espresso/40 font-bold mb-0.5">Summary</p>
          <p className="text-xs font-semibold text-espresso">{preferenceSummaryText(prefs)}</p>
        </div>
      </div>
    </section>
  );
}
