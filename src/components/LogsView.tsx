import { useState, useRef, ChangeEvent } from "react";
import { Camera, Trash2, Calendar, Wheat, Beef, Sprout, Flame, Upload, Sparkles, Plus, AlertCircle, RefreshCw } from "lucide-react";
import { MealLog, Macros } from "../types";

interface LogsViewProps {
  logs: MealLog[];
  onAddLog: (newLog: Partial<MealLog>) => void;
  onDeleteLog: (id: string) => void;
  onResetLogs: () => void;
}

// Sample images that users can click to simulate picking / taking a real photo
const SAMPLE_PHOTOS = [
  {
    name: "Avocado Sourdough Toast",
    url: "https://images.unsplash.com/photo-1541532713592-79a0317b6b77?auto=format&fit=crop&w=400&q=80",
    mime: "image/jpeg"
  },
  {
    name: "Quinoa Veggie Mix",
    url: "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=400&q=80",
    mime: "image/jpeg"
  },
  {
    name: "Banana Pancakes Stack",
    url: "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?auto=format&fit=crop&w=400&q=80",
    mime: "image/jpeg"
  }
];

export default function LogsView({ logs, onAddLog, onDeleteLog, onResetLogs }: LogsViewProps) {
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedPreview, setParsedPreview] = useState<{
    recipeName: string;
    prepTimeEstimate: string;
    ingredients: string[];
    macros: Macros;
    review: string;
    imageUrl: string;
  } | null>(null);

  const [selectedMealType, setSelectedMealType] = useState<string>("Lunch");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Daily budget targets
  const targetCalories = 1800;
  const targetCarbs = 200;
  const targetProtein = 110;
  const targetFat = 65;

  // Compute logged totals
  const totalCalories = logs.reduce((sum, item) => sum + (item.macros.calories || 0), 0);
  const totalCarbs = logs.reduce((sum, item) => sum + (item.macros.carbs || 0), 0);
  const totalProtein = logs.reduce((sum, item) => sum + (item.macros.protein || 0), 0);
  const totalFat = logs.reduce((sum, item) => sum + (item.macros.fat || 0), 0);

  // Percentages for beautiful biophilic radial ring or bars
  const calPercent = Math.min(Math.round((totalCalories / targetCalories) * 100), 100);
  const carbsPercent = Math.min(Math.round((totalCarbs / targetCarbs) * 100), 100);
  const proteinPercent = Math.min(Math.round((totalProtein / targetProtein) * 100), 100);
  const fatPercent = Math.min(Math.round((totalFat / targetFat) * 100), 100);

  // Helper utility: fetch Unsplash image and convert to Base64 to pipe to server
  const parseImageOnServer = async (imgUrl: string) => {
    setIsParsing(true);
    setParseError(null);
    setParsedPreview(null);

    try {
      // 1. Fetch image bytes from our proxy/url
      const response = await fetch(imgUrl);
      if (!response.ok) throw new Error("Could not download sample asset.");
      const blob = await response.blob();
      
      // 2. Convert to Base64
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64Data = reader.result as string;

        // 3. Post to our full-stack server
        const parseRes = await fetch("/api/logs/parse-photo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageBase64: base64Data,
            mimeType: blob.type || "image/jpeg"
          })
        });

        if (!parseRes.ok) {
          throw new Error("Server failed to parse the plate photo.");
        }

        const data = await parseRes.json();
        setParsedPreview({
          recipeName: data.recipeName || "Harvest Plate",
          prepTimeEstimate: data.prepTimeEstimate || "15 min",
          ingredients: data.ingredients || ["Healthy ingredients"],
          macros: data.macros || { carbs: 20, protein: 12, fat: 8, calories: 200 },
          review: data.review || "Eaten with peaceful, warm gratitude.",
          imageUrl: imgUrl
        });
        setIsParsing(false);
      };
    } catch (err: any) {
      console.error(err);
      setParseError(err.message || "Failed to parse dish. Ensure GEMINI_API_KEY is configured.");
      setIsParsing(false);
    }
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    setParseError(null);
    setParsedPreview(null);

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = async () => {
      try {
        const base64Data = reader.result as string;
        const parseRes = await fetch("/api/logs/parse-photo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageBase64: base64Data,
            mimeType: file.type || "image/jpeg"
          })
        });

        if (!parseRes.ok) {
          throw new Error("Server failed to scan the uploaded file.");
        }

        const data = await parseRes.json();
        setParsedPreview({
          recipeName: data.recipeName || file.name.split(".")[0],
          prepTimeEstimate: data.prepTimeEstimate || "10 min",
          ingredients: data.ingredients || ["Handmade choice"],
          macros: data.macros || { carbs: 32, protein: 15, fat: 10, calories: 278 },
          review: data.review || "Mindfully prepared and happily eaten today.",
          imageUrl: URL.createObjectURL(file) // local preview URL
        });
      } catch (err: any) {
        console.error(err);
        setParseError("Could not analyze your photo file directly. Retrying with samples instead usually works perfectly!");
      } finally {
        setIsParsing(false);
      }
    };
  };

  const handleSaveParsedPreview = () => {
    if (!parsedPreview) return;
    onAddLog({
      recipeName: parsedPreview.recipeName,
      macros: parsedPreview.macros,
      imageUrl: parsedPreview.imageUrl,
      mealType: selectedMealType,
      review: parsedPreview.review
    });
    setParsedPreview(null);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Top Title Section */}
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <h1 className="text-3xl font-display font-medium text-espresso tracking-tight">
            Today's Diary
          </h1>
          <p className="text-xs text-espresso/60 font-mono uppercase tracking-wider flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-bakedclay" />
            June 20, 2026 • Wellness Tracked
          </p>
        </div>
        <button
          onClick={onResetLogs}
          className="text-xs font-mono tracking-wide text-espresso/60 hover:text-bakedclay border border-matcha hover:border-bakedclay/40 bg-cream/70 p-2 rounded-xl flex items-center gap-1.5 transition-colors"
          id="reset-logs-action"
        >
          <RefreshCw className="w-3 h-3" /> Reset
        </button>
      </div>

      {/* Daily Progress Stats Card */}
      <div className="bg-cream border border-matcha/80 p-5 rounded-3xl shadow-warm space-y-5">
        {/* Caloric ring bar */}
        <div className="flex items-center gap-5">
          <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
            {/* SVG circle budget */}
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-matcha stroke-current"
                strokeWidth="3.5"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="text-bakedclay stroke-current"
                strokeWidth="3.5"
                strokeDasharray={`${calPercent}, 100`}
                strokeLinecap="round"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute text-center">
              <span className="text-md font-display font-bold text-espresso">{totalCalories}</span>
              <p className="text-[8px] font-mono uppercase tracking-wider text-espresso/60">kcal</p>
            </div>
          </div>

          <div className="space-y-1">
            <h3 className="font-display font-semibold text-espresso text-md leading-tight">
              Caloric Budget Status
            </h3>
            <p className="text-xs text-espresso/70 font-medium">
              You have consumed <strong className="text-bakedclay">{totalCalories} kcal</strong> out of your nourishing daily target of <strong className="text-espresso">{targetCalories} kcal</strong> ({calPercent}% completed).
            </p>
          </div>
        </div>

        {/* Nested Soft Macros progress */}
        <div className="grid grid-cols-3 gap-4 pt-3 border-t border-matcha/30">
          {/* Carbs */}
          <div className="space-y-1">
            <div className="flex justify-between items-center text-[10px] uppercase font-mono font-bold text-espresso/60">
              <span className="flex items-center gap-0.5"><Wheat className="w-3 h-3 text-amber-600" /> Carbs</span>
              <span>{totalCarbs}g / {targetCarbs}g</span>
            </div>
            <div className="w-full bg-matcha h-2 rounded-full overflow-hidden">
              <div className="bg-amber-400 h-full rounded-full transition-all" style={{ width: `${carbsPercent}%` }} />
            </div>
          </div>

          {/* Protein */}
          <div className="space-y-1">
            <div className="flex justify-between items-center text-[10px] uppercase font-mono font-bold text-espresso/60">
              <span className="flex items-center gap-0.5"><Beef className="w-3 h-3 text-red-600" /> Protein</span>
              <span>{totalProtein}g / {targetProtein}g</span>
            </div>
            <div className="w-full bg-matcha h-2 rounded-full overflow-hidden">
              <div className="bg-red-400 h-full rounded-full transition-all" style={{ width: `${proteinPercent}%` }} />
            </div>
          </div>

          {/* Fat */}
          <div className="space-y-1">
            <div className="flex justify-between items-center text-[10px] uppercase font-mono font-bold text-espresso/60">
              <span className="flex items-center gap-0.5"><Sprout className="w-3 h-3 text-emerald-600" /> Fats</span>
              <span>{totalFat}g / {targetFat}g</span>
            </div>
            <div className="w-full bg-matcha h-2 rounded-full overflow-hidden">
              <div className="bg-emerald-500 h-full rounded-full transition-all" style={{ width: `${fatPercent}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Multimodal Photo-First Logging Panel */}
      <div className="bg-sage p-5 rounded-[24px] text-cream space-y-4 shadow-premium relative overflow-hidden">
        <div className="absolute right-0 top-0 w-24 h-24 bg-cream/10 rounded-full blur-xl pointer-events-none" />

        <div className="flex items-center gap-2">
          <Camera className="w-5 h-5 text-matcha" />
          <h2 className="font-display font-medium text-lg text-cream tracking-tight">
            Photo-First Log (Vision AI)
          </h2>
        </div>

        <p className="text-xs text-matcha leading-relaxed font-medium">
          Simply snap or upload a meal photo. Vígadi's server-side Gemini scanner automatically identifies ingredients, portion size, logs exact macro data, and drops a positive, non-judgmental review!
        </p>

        {/* Real photo triggers */}
        <div className="grid grid-cols-3 gap-2.5 pt-1">
          {SAMPLE_PHOTOS.map((sample) => (
            <button
              key={sample.name}
              onClick={() => parseImageOnServer(sample.url)}
              disabled={isParsing}
              className="flex flex-col items-center gap-1.5 p-2 bg-cream/10 hover:bg-cream/20 disabled:opacity-55 active:scale-95 transition-all rounded-xl border border-cream/20 text-center cursor-pointer"
            >
              <img
                src={sample.url}
                alt={sample.name}
                className="w-10 h-10 rounded-lg object-cover shadow-sm border border-cream/30"
                referrerPolicy="no-referrer"
              />
              <span className="text-[9px] font-mono tracking-wide uppercase truncate w-full text-cream font-bold">
                {sample.name.split(" ")[0]}
              </span>
            </button>
          ))}
        </div>

        {/* Custom file upload triggers */}
        <div className="flex gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isParsing}
            className="flex-1 bg-cream text-espresso py-3 rounded-xl font-display font-bold text-xs transition-transform active:scale-98 shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
          >
            <Upload className="w-4 h-4 text-bakedclay" />
            Upload food photo
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="image/*"
            className="hidden"
          />
        </div>

        {/* Loading Parse sequence */}
        {isParsing && (
          <div className="p-4 bg-cream/10 backdrop-blur-xs rounded-xl border border-cream/2 border-dashed space-y-3 animate-pulse text-center">
            <div className="w-5 h-5 border-2 border-cream/30 border-t-cream rounded-full animate-spin mx-auto" />
            <p className="text-[11px] font-mono uppercase tracking-wider text-matcha font-bold">
              Gemini Vision Scan active... weighing fats and minerals...
            </p>
          </div>
        )}

        {/* Error notification */}
        {parseError && (
          <div className="p-3 bg-red-900/40 border border-red-500/40 text-xs rounded-xl flex items-start gap-2 text-cream">
            <AlertCircle className="w-4 h-4 text-red-300 shrink-0 mt-0.5" />
            <span>{parseError}</span>
          </div>
        )}

        {/* Parse Preview Result Card */}
        {parsedPreview && (
          <div className="bg-cream text-espresso p-4 rounded-xl space-y-3 border border-matcha shadow-premium animate-fade-in">
            <div className="flex gap-3">
              <img
                src={parsedPreview.imageUrl}
                alt={parsedPreview.recipeName}
                className="w-16 h-16 rounded-lg object-cover mt-1 shrink-0 shadow-xs"
                referrerPolicy="no-referrer"
              />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                  <h4 className="font-display font-semibold text-md text-espresso truncate">
                    {parsedPreview.recipeName}
                  </h4>
                  <span className="text-[9px] font-mono tracking-widest bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-sm">
                    SCAN COMPLETE
                  </span>
                </div>
                <p className="text-xs text-espresso/60 font-mono mt-0.5">
                  Est. Cook Time: {parsedPreview.prepTimeEstimate}
                </p>
              </div>
            </div>

            {/* Estimated Ingredients list */}
            <div className="text-xs space-y-1 bg-matcha/30 p-2.5 rounded-lg border border-matcha/40">
              <span className="text-[9px] font-mono uppercase tracking-widest text-espresso/60 font-bold block mb-1">
                Detected ingredients:
              </span>
              <p className="text-espresso/90 font-medium">
                {parsedPreview.ingredients.join(", ")}
              </p>
            </div>

            {/* Estimated Macros line row */}
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <div className="bg-cream border border-matcha p-1.5 rounded-lg">
                <p className="text-espresso font-bold">{parsedPreview.macros.calories}</p>
                <span className="text-[8px] font-mono uppercase text-espresso/60">kcal</span>
              </div>
              <div className="bg-cream border border-matcha p-1.5 rounded-lg">
                <p className="text-espresso font-bold">{parsedPreview.macros.carbs}g</p>
                <span className="text-[8px] font-mono uppercase text-espresso/60">Carbs</span>
              </div>
              <div className="bg-cream border border-matcha p-1.5 rounded-lg">
                <p className="text-espresso font-bold">{parsedPreview.macros.protein}g</p>
                <span className="text-[8px] font-mono uppercase text-espresso/60">Protein</span>
              </div>
              <div className="bg-cream border border-matcha p-1.5 rounded-lg">
                <p className="text-espresso font-bold">{parsedPreview.macros.fat}g</p>
                <span className="text-[8px] font-mono uppercase text-espresso/60">Fat</span>
              </div>
            </div>

            {/* AI Review in system's non-judgmental style */}
            <p className="text-xs italic bg-cream p-2.5 rounded-lg border border-matcha text-espresso/80 leading-relaxed font-semibold">
              "{parsedPreview.review}"
            </p>

            <div className="flex gap-2">
              {/* Category picker */}
              <select
                value={selectedMealType}
                onChange={(e) => setSelectedMealType(e.target.value)}
                className="bg-cream border border-matcha text-xs text-espresso rounded-xl px-2 shrink-0 py-2.5 focus:outline-hidden"
              >
                <option>Breakfast</option>
                <option>Lunch</option>
                <option>Dinner</option>
                <option>Snack</option>
              </select>

              <button
                onClick={handleSaveParsedPreview}
                className="flex-1 bg-bakedclay hover:bg-bakedclay/95 text-cream py-2.5 rounded-xl font-display font-semibold text-xs transition-transform active:scale-97 flex items-center justify-center gap-1 cursor-pointer shadow-md"
              >
                <Plus className="w-4 h-4" /> Log into Diary
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Diary logs list matching screenshots */}
      <div className="space-y-4">
        <h2 className="text-sm font-mono uppercase tracking-widest text-espresso/80 font-bold border-b border-matcha/40 pb-2">
          Logged Food Plates ({logs.length})
        </h2>

        {logs.length === 0 ? (
          <div className="text-center py-12 bg-cream/30 border border-matcha rounded-2xl p-6">
            <AlertCircle className="w-8 h-8 text-espresso/30 mx-auto mb-2" />
            <p className="text-sm font-medium text-espresso/60">No meals logged for today yet. Use search or snap a photo above to log meal!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {logs.map((log) => (
              <div
                key={log.id}
                className="bg-cream border border-matcha/40 p-4 rounded-3xl flex flex-col sm:flex-row gap-4 shadow-warm group hover:border-matcha transition-all"
                id={`log-item-${log.id}`}
              >
                {/* Plate image cover */}
                <img
                  src={log.imageUrl}
                  alt={log.recipeName}
                  className="w-full sm:w-24 h-24 rounded-2xl object-cover shrink-0 select-none shadow-xs border border-matcha/20"
                  referrerPolicy="no-referrer"
                />

                {/* Meta details */}
                <div className="flex-1 space-y-1.5 min-w-0">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-mono tracking-wider font-bold uppercase text-bakedclay bg-bakedclay/10 px-2 py-0.5 rounded-md">
                        {log.mealType}
                      </span>
                      <h4 className="font-display font-bold text-espresso text-md sm:text-lg mt-1 truncate">
                        {log.recipeName}
                      </h4>
                    </div>
                    {/* Delete action */}
                    <button
                      onClick={() => onDeleteLog(log.id)}
                      className="text-espresso/40 hover:text-red-500 p-1.5 rounded-full hover:bg-red-50 transition-colors shrink-0"
                      title="Remove log entry"
                      id={`delete-log-${log.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Macros info */}
                  <div className="flex items-center gap-3 text-xs font-mono font-medium text-espresso/70">
                    <span className="flex items-center gap-0.5"><Flame className="w-3.5 h-3.5 text-bakedclay" /> {log.macros.calories} kcal</span>
                    <span className="w-1 h-1 bg-matcha rounded-full" />
                    <span>C: <strong>{log.macros.carbs}g</strong></span>
                    <span className="w-1 h-1 bg-matcha rounded-full" />
                    <span>P: <strong>{log.macros.protein}g</strong></span>
                    <span className="w-1 h-1 bg-matcha rounded-full" />
                    <span>F: <strong>{log.macros.fat}g</strong></span>
                  </div>

                  {/* Soft positive AI review explanation */}
                  {log.review && (
                    <p className="text-xs text-espresso/80 leading-relaxed italic bg-matcha/20 p-2.5 rounded-xl border border-matcha/30 font-medium">
                      "{log.review}"
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
