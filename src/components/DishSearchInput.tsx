import { useCallback, useEffect, useRef, useState, KeyboardEvent } from "react";
import { resolveDishCategory, slotFromDishName } from "../../shared/mealTemplates";

export interface DishSearchResult {
  id: number;
  name: string;
  dishType?: string | null;
  dishCategory?: string | null;
  ingredientName?: string | null;
}

interface DishSearchInputProps {
  onSelect: (slot: ReturnType<typeof slotFromDishName>) => void;
  placeholder?: string;
}

export default function DishSearchInput({
  onSelect,
  placeholder = "Search dishes…",
}: DishSearchInputProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DishSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/catalog/dishes/search?q=${encodeURIComponent(trimmed)}&limit=8`);
      if (!res.ok) {
        setResults([]);
        setOpen(false);
        return;
      }
      const data = await res.json();
      const dishes: DishSearchResult[] = data.dishes ?? [];
      setResults(dishes);
      setOpen(dishes.length > 0);
      setHighlight(0);
    } catch {
      setResults([]);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => runSearch(query), 200);
    return () => clearTimeout(timer);
  }, [query, runSearch]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const pick = (item: DishSearchResult) => {
    onSelect(
      slotFromDishName(item.name, item.dishType, item.dishCategory ?? undefined, item.id)
    );
    setQuery("");
    setResults([]);
    setOpen(false);
    inputRef.current?.focus();
  };

  const addTypedName = () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    const match = results.find((r) => r.name.toLowerCase() === trimmed.toLowerCase());
    if (match) {
      pick(match);
      return;
    }
    onSelect(slotFromDishName(trimmed));
    setQuery("");
    setResults([]);
    setOpen(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (open && results.length > 0) {
        pick(results[highlight]);
      } else {
        addTypedName();
      }
      return;
    }
    if (!open || results.length === 0) {
      if (e.key === "Escape") setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h - 1 + results.length) % results.length);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => query.trim() && results.length > 0 && setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        className="w-full bg-[#F1F3ED] border border-matcha/30 py-2 px-3 rounded-xl text-xs font-semibold text-espresso focus:outline-hidden focus:ring-1 focus:ring-sage/60"
      />
      {loading && query.trim() && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-espresso/40 font-mono">
          …
        </span>
      )}

      {open && results.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-matcha rounded-xl shadow-lg overflow-hidden max-h-52 overflow-y-auto">
          {results.map((item, idx) => (
            <li key={item.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(item)}
                className={`w-full text-left px-3 py-2.5 cursor-pointer ${
                  idx === highlight ? "bg-sage/20" : "hover:bg-cream"
                }`}
              >
                <span className="text-xs font-semibold text-espresso block">{item.name}</span>
                <span className="text-[10px] text-espresso/50 font-mono">
                  {[item.ingredientName, item.dishCategory ?? resolveDishCategory(item.dishType, item.name)]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {query.trim() && !loading && results.length === 0 && (
        <p className="mt-1.5 text-[10px] text-espresso/50">
          Press Enter to add &ldquo;{query.trim()}&rdquo; as a dish slot
        </p>
      )}
    </div>
  );
}
