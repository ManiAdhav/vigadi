import { GoogleGenAI } from "@google/genai";
import { insertDish, upsertIngredient } from "./db";
import { GEMINI_MODEL } from "./geminiConfig";
import { cleanAndParseJson, extractYouTubeVideoId } from "./jsonUtils";

let aiClient: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI | null {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (key) {
      aiClient = new GoogleGenAI({
        apiKey: key,
        httpOptions: { headers: { "User-Agent": "aistudio-build" } },
      });
    }
  }
  return aiClient;
}

export interface DiscoveredDish {
  name: string;
  youtubeUrl: string;
  dishType: string;
  spiceLevel: string;
  mainIngredients: string[];
  pairsWith: string[];
  description: string;
  channelName?: string;
}

const OFFLINE_DISH_TEMPLATES: Record<string, DiscoveredDish[]> = {
  potato: [
    { name: "South Indian Potato Fry", youtubeUrl: "https://www.youtube.com/results?search_query=south+indian+potato+fry", dishType: "side", spiceLevel: "medium", mainIngredients: ["potato", "chili powder", "turmeric"], pairsWith: ["Rice", "Chapati"], description: "Crispy pan-roasted potato side" },
    { name: "Urulaikilangu Poriyal", youtubeUrl: "https://www.youtube.com/results?search_query=urulaikilangu+poriyal", dishType: "side", spiceLevel: "mild", mainIngredients: ["potato", "coconut", "mustard seeds"], pairsWith: ["Rice"], description: "Dry coconut potato poriyal" },
    { name: "Potato Sambar", youtubeUrl: "https://www.youtube.com/results?search_query=potato+sambar+south+indian", dishType: "gravy", spiceLevel: "medium", mainIngredients: ["potato", "toor dal", "tamarind"], pairsWith: ["Rice", "Idli"], description: "Tangy lentil gravy with potato" },
    { name: "Aloo Masala Curry", youtubeUrl: "https://www.youtube.com/results?search_query=aloo+masala+curry", dishType: "gravy", spiceLevel: "medium", mainIngredients: ["potato", "onion", "tomato"], pairsWith: ["Rice", "Chapati", "Poori"], description: "North-South fusion potato curry" },
    { name: "Potato Roast Kulambu Style", youtubeUrl: "https://www.youtube.com/results?search_query=potato+roast+kulambu", dishType: "side", spiceLevel: "spicy", mainIngredients: ["potato", "sambar powder"], pairsWith: ["Rice"], description: "Spicy roasted potato chunks" },
  ],
  fish: [
    { name: "Meen Varuval (Fish Fry)", youtubeUrl: "https://www.youtube.com/results?search_query=meen+varuval+fish+fry", dishType: "side", spiceLevel: "spicy", mainIngredients: ["fish", "chili powder", "ginger garlic"], pairsWith: ["Rice"], description: "Crispy Tamil fish fry" },
    { name: "Fish Kulambu", youtubeUrl: "https://www.youtube.com/results?search_query=fish+kulambu+south+indian", dishType: "gravy", spiceLevel: "medium", mainIngredients: ["fish", "tamarind", "coconut"], pairsWith: ["Rice"], description: "Tangy coastal fish curry" },
    { name: "Meen Kuzhambu", youtubeUrl: "https://www.youtube.com/results?search_query=meen+kuzhambu", dishType: "gravy", spiceLevel: "spicy", mainIngredients: ["fish", "shallots", "tamarind"], pairsWith: ["Rice"], description: "Traditional spicy fish stew" },
    { name: "Fish Curry Kerala Style", youtubeUrl: "https://www.youtube.com/results?search_query=kerala+fish+curry", dishType: "gravy", spiceLevel: "medium", mainIngredients: ["fish", "coconut milk", "kudampuli"], pairsWith: ["Rice", "Appam"], description: "Coconut-based Kerala fish curry" },
    { name: "Tawa Fish Fry", youtubeUrl: "https://www.youtube.com/results?search_query=tawa+fish+fry", dishType: "side", spiceLevel: "medium", mainIngredients: ["fish", "lemon", "spice masala"], pairsWith: ["Rice"], description: "Pan-seared spiced fish" },
  ],
  chicken: [
    { name: "Chicken Kulambu", youtubeUrl: "https://www.youtube.com/results?search_query=chicken+kulambu", dishType: "gravy", spiceLevel: "spicy", mainIngredients: ["chicken", "onion", "tomato"], pairsWith: ["Rice", "Chapati"], description: "Homestyle chicken stew" },
    { name: "Chettinad Chicken Curry", youtubeUrl: "https://www.youtube.com/results?search_query=chettinad+chicken+curry", dishType: "gravy", spiceLevel: "very_spicy", mainIngredients: ["chicken", "chettinad masala"], pairsWith: ["Rice", "Parotta"], description: "Aromatic Chettinad chicken gravy" },
    { name: "Chicken Pepper Fry", youtubeUrl: "https://www.youtube.com/results?search_query=chicken+pepper+fry", dishType: "side", spiceLevel: "spicy", mainIngredients: ["chicken", "black pepper"], pairsWith: ["Rice"], description: "Dry pepper chicken side" },
    { name: "Chicken Poriyal", youtubeUrl: "https://www.youtube.com/results?search_query=chicken+poriyal", dishType: "side", spiceLevel: "medium", mainIngredients: ["chicken", "coconut"], pairsWith: ["Rice"], description: "Dry coconut chicken side" },
    { name: "Chicken Sambar", youtubeUrl: "https://www.youtube.com/results?search_query=chicken+sambar", dishType: "gravy", spiceLevel: "medium", mainIngredients: ["chicken", "toor dal", "tamarind"], pairsWith: ["Rice"], description: "Lentil-based chicken sambar" },
  ],
  tomato: [
    { name: "Tomato Chutney", youtubeUrl: "https://www.youtube.com/results?search_query=tomato+chutney+south+indian", dishType: "side", spiceLevel: "medium", mainIngredients: ["tomato", "chili", "tamarind"], pairsWith: ["Rice", "Idli", "Dosa"], description: "Tangy tomato chutney side" },
    { name: "Tomato Rasam", youtubeUrl: "https://www.youtube.com/results?search_query=tomato+rasam", dishType: "gravy", spiceLevel: "mild", mainIngredients: ["tomato", "pepper", "cumin"], pairsWith: ["Rice"], description: "Light peppery tomato soup-gravy" },
    { name: "Tomato Pachadi", youtubeUrl: "https://www.youtube.com/results?search_query=tomato+pachadi", dishType: "side", spiceLevel: "mild", mainIngredients: ["tomato", "yogurt"], pairsWith: ["Rice"], description: "Cooling tomato yogurt side" },
    { name: "Tomato Sambar", youtubeUrl: "https://www.youtube.com/results?search_query=tomato+sambar", dishType: "gravy", spiceLevel: "medium", mainIngredients: ["tomato", "toor dal"], pairsWith: ["Rice", "Idli"], description: "Classic tomato lentil sambar" },
    { name: "Tomato Fry", youtubeUrl: "https://www.youtube.com/results?search_query=tomato+fry+south+indian", dishType: "side", spiceLevel: "medium", mainIngredients: ["tomato", "onion"], pairsWith: ["Rice", "Chapati"], description: "Sautéed tomato side dish" },
  ],
};

function getOfflineDishes(ingredient: string): DiscoveredDish[] {
  const key = ingredient.toLowerCase().replace(/\s+/g, " ");
  if (OFFLINE_DISH_TEMPLATES[key]) return OFFLINE_DISH_TEMPLATES[key];

  const base = ingredient.charAt(0).toUpperCase() + ingredient.slice(1);
  return [
    { name: `${base} Fry`, youtubeUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(base + " fry south indian")}`, dishType: "side", spiceLevel: "medium", mainIngredients: [base.toLowerCase()], pairsWith: ["Rice"], description: `Crispy ${base.toLowerCase()} fry side` },
    { name: `${base} Sambar`, youtubeUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(base + " sambar")}`, dishType: "gravy", spiceLevel: "medium", mainIngredients: [base.toLowerCase(), "toor dal"], pairsWith: ["Rice"], description: `Tangy ${base.toLowerCase()} sambar gravy` },
    { name: `${base} Poriyal`, youtubeUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(base + " poriyal")}`, dishType: "side", spiceLevel: "mild", mainIngredients: [base.toLowerCase(), "coconut"], pairsWith: ["Rice"], description: `Dry coconut ${base.toLowerCase()} poriyal` },
    { name: `${base} Curry`, youtubeUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(base + " curry south indian")}`, dishType: "gravy", spiceLevel: "medium", mainIngredients: [base.toLowerCase(), "onion"], pairsWith: ["Rice", "Chapati"], description: `${base} homestyle curry` },
    { name: `${base} Roast`, youtubeUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(base + " roast south indian")}`, dishType: "side", spiceLevel: "spicy", mainIngredients: [base.toLowerCase()], pairsWith: ["Rice"], description: `Spiced roasted ${base.toLowerCase()}` },
  ];
}

async function discoverDishesForIngredient(ingredient: string): Promise<DiscoveredDish[]> {
  const client = getGeminiClient();
  if (!client) return getOfflineDishes(ingredient);

  const prompt = `You are Vigadi's YouTube dish catalog engine. Search YouTube and the web for authentic South Indian (and regional Indian) cooking videos for the ingredient: "${ingredient}".

Find between 5 and 10 DISTINCT real dishes that use ${ingredient} as a main ingredient. For each dish include:
- name: authentic dish name (e.g. "Potato Fry", "Drumstick Sambar", "Meen Varuval")
- youtubeUrl: a REAL YouTube URL (watch?v= or youtu.be) from search results. Do NOT invent video IDs.
- dishType: one of "gravy", "kulambu", "sambar", "curry", "side", "fry", "poriyal", "roast", "chutney"
- spiceLevel: one of "mild", "medium", "spicy", "very_spicy"
- mainIngredients: array of primary ingredients
- pairsWith: array from ["Rice", "Chapati", "Roti", "Idli", "Dosa", "Appam"]
- description: one sentence about the dish
- channelName: YouTube channel if known

Return ONLY valid JSON:
{
  "dishes": [ { "name": "...", "youtubeUrl": "...", "dishType": "...", "spiceLevel": "...", "mainIngredients": [], "pairsWith": [], "description": "...", "channelName": "..." } ]
}`;

  try {
    const response = await client.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        systemInstruction:
          "Search for real YouTube cooking videos. Return only dishes with verifiable YouTube URLs from search grounding. Prefer South Indian home-style recipes.",
      },
    });

    const parsed = cleanAndParseJson(response.text || '{"dishes":[]}');
    const dishes: DiscoveredDish[] = (parsed?.dishes ?? []).slice(0, 10).map((d: any) => ({
      name: d.name,
      youtubeUrl: d.youtubeUrl || `https://www.youtube.com/results?search_query=${encodeURIComponent("how to cook " + d.name)}`,
      dishType: d.dishType || "side",
      spiceLevel: d.spiceLevel || "medium",
      mainIngredients: d.mainIngredients || [ingredient],
      pairsWith: d.pairsWith || ["Rice"],
      description: d.description || "",
      channelName: d.channelName,
    }));

    return dishes.length > 0 ? dishes : getOfflineDishes(ingredient);
  } catch (err) {
    console.error(`Discovery failed for ${ingredient}:`, err);
    return getOfflineDishes(ingredient);
  }
}

export async function discoverAndStoreIngredients(ingredients: string[]) {
  const results: Record<string, ReturnType<typeof persistDiscoveredDishes>> = {};

  for (const raw of ingredients) {
    const name = raw.trim();
    if (!name || name.toLowerCase() === "rice") continue;

    const ingredientId = upsertIngredient(name);
    const discovered = await discoverDishesForIngredient(name);
    const stored = persistDiscoveredDishes(ingredientId, name, discovered);
    results[name] = stored;
  }

  return results;
}

function persistDiscoveredDishes(ingredientId: number, ingredientName: string, dishes: DiscoveredDish[]) {
  const stored: any[] = [];
  for (const dish of dishes) {
    const id = insertDish({
      ingredientId,
      name: dish.name,
      youtubeUrl: dish.youtubeUrl,
      youtubeVideoId: extractYouTubeVideoId(dish.youtubeUrl) ?? undefined,
      dishType: dish.dishType,
      spiceLevel: dish.spiceLevel,
      mainIngredients: dish.mainIngredients,
      pairsWith: dish.pairsWith,
      description: dish.description,
      channelName: dish.channelName,
      source: getGeminiClient() ? "gemini_grounding" : "offline_template",
    });
    if (id) {
      stored.push({ id, ingredientName, ...dish });
    }
  }
  return stored;
}
