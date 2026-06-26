import { useState, useRef, useEffect, useCallback, KeyboardEvent } from "react";
import { Plus } from "lucide-react";
import { searchIngredients } from "../../shared/ingredientSearch";
import type { IngredientSearchResult } from "../../shared/ingredientCatalog";

interface IngredientAutocompleteProps {
  onSelect: (canonical: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function IngredientAutocomplete({
  onSelect,
  placeholder = "Type vegetable name…",
  disabled = false,
}: IngredientAutocompleteProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<IngredientSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const runSearch = useCallback((q: string) => {
    if (!q.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }
    const matches = searchIngredients(q, 8);
    setResults(matches);
    setOpen(matches.length > 0);
    setHighlight(0);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => runSearch(query), 80);
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

  const pick = (item: IngredientSearchResult) => {
    onSelect(item.canonical);
    setQuery("");
    setResults([]);
    setOpen(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open || results.length === 0) {
      if (e.key === "Enter") e.preventDefault();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      pick(results[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapperRef} className="relative flex-1">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => query.trim() && results.length > 0 && setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        spellCheck={false}
        className="w-full bg-cream border border-matcha py-2.5 px-3.5 rounded-xl text-espresso text-xs focus:outline-hidden focus:ring-1 focus:ring-sage/60"
      />

      {open && results.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-matcha rounded-xl shadow-lg overflow-hidden max-h-56 overflow-y-auto">
          {results.map((item, idx) => (
            <li key={item.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(item)}
                className={`w-full text-left px-3.5 py-2.5 flex flex-col gap-0.5 cursor-pointer ${
                  idx === highlight ? "bg-sage/20" : "hover:bg-cream"
                }`}
              >
                <span className="text-xs font-semibold text-espresso">{item.canonical}</span>
                <span className="text-[10px] text-espresso/50 font-mono">
                  {[item.tamil, item.transliteration, item.matchedAlias !== item.canonical ? item.matchedAlias : null]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function IngredientAddButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="bg-espresso text-cream px-3.5 rounded-xl cursor-pointer disabled:opacity-50"
    >
      <Plus className="w-4 h-4" />
    </button>
  );
}
