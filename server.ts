import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Robust helper to dry-clean the response text before passing to JSON.parse
function cleanAndParseJson(text: string): any {
  if (!text) return null;
  let cleanText = text.trim();
  
  // 1. Strip markdown wrapper if found
  if (cleanText.startsWith("```")) {
    const matches = cleanText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (matches && matches[1]) {
      cleanText = matches[1].trim();
    }
  }
  
  // 2. Extract contents strictly within JSON object/array boundaries to ignore any lead/trail notes
  const firstBrace = cleanText.indexOf("{");
  const lastBrace = cleanText.lastIndexOf("}");
  const firstBracket = cleanText.indexOf("[");
  const lastBracket = cleanText.lastIndexOf("]");
  
  let targetText = cleanText;
  if (firstBrace !== -1 && lastBrace !== -1) {
    if (firstBracket !== -1 && firstBracket < firstBrace && lastBracket !== -1 && lastBracket > lastBrace) {
      targetText = cleanText.slice(firstBracket, lastBracket + 1);
    } else {
      targetText = cleanText.slice(firstBrace, lastBrace + 1);
    }
  } else if (firstBracket !== -1 && lastBracket !== -1) {
    targetText = cleanText.slice(firstBracket, lastBracket + 1);
  }
  
  try {
    return JSON.parse(targetText);
  } catch (err) {
    console.error("Default JSON parse failed, scrubbing trailing commas and trying one final parse...", err);
    let simpleClean = targetText
      .replace(/,\s*([\]}])/g, "$1") // strip trailing commas
      .replace(/^\s*\/\/.*$/gm, ""); // strip line comments
    return JSON.parse(simpleClean);
  }
}

// Set up bodies parsing limits to handle base64 image uploads smoothly
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

// Predefined recipes & meal combos mapping Emma's design
const INITIAL_MEALS: any[] = [
  {
    id: "combo-1",
    recipeName: "Chettinad chicken plate",
    prepTime: "50 min",
    category: "Lunch",
    macros: { carbs: 54, protein: 42, fat: 16, calories: 528 },
    rating: 4.9,
    difficulty: "Medium",
    servings: 2,
    image: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=800&q=80",
    tagline: "plated combo photo",
    subComponents: [
      "Chettinad chicken kulambu",
      "Brinjal poriyal",
      "Potato roast",
      "Rice"
    ],
    ingredients: [
      "500g Chicken, bone-in pieces",
      "1 cup Rice (Sona Masuri or Basmati)",
      "2 medium Potatoes, diced for roast",
      "2 medium Brinjals, sliced",
      "2 tbsp Chettinad masala blend",
      "3 tbsp Sesame oil",
      "1 cup Coconut milk",
      "Curry leaves & mustard seeds for tempering"
    ],
    steps: [
      "Rinse and soak rice for 20 minutes, then boil to a fluffy dry finish.",
      "Dry roast Chettinad coriander, fennel, cumin, pepper, and red chillies, then grind to a fine paste with coconut.",
      "Sear the chicken with sliced onions, ginger-garlic paste, and tomatoes, then simmer in water and the ground spice paste until tender.",
      "Prepare brinjal poriyal by shallow frying brinjal with mustard seeds, turmeric, and grated coconut.",
      "Toss potatoes with chili powder, turmeric, salt, and sesame oil in a cast-iron pan until golden roast crust is formed.",
      "Assemble on a clay plate: a mound of hot rice, bowls of Kulambu, Brinjal poriyal, and Potato roast."
    ],
    nutritionFact: "An incredibly fragrant, high-protein traditional platter. It is packed with complex carbs from rice, essential fiber from brinjals, and potassium from roasted potatoes to replenish energy after a long day.",
    matchedIngredients: ["Chicken", "Potato", "Brinjal", "Rice"],
    videoCount: 3,
    popularCount: "1,240 chose this",
    youtubeLinks: {
      "Chettinad chicken kulambu": "https://www.youtube.com/results?search_query=how+to+cook+chettinad+chicken+kulambu",
      "Brinjal poriyal": "https://www.youtube.com/results?search_query=how+to+cook+brinjal+poriyal",
      "Potato roast": "https://www.youtube.com/results?search_query=how+to+cook+potato+roast+south+indian+style"
    }
  },
  {
    id: "combo-2",
    recipeName: "Chicken day",
    prepTime: "45 min",
    category: "Lunch",
    macros: { carbs: 54, protein: 38, fat: 12, calories: 480 },
    rating: 4.8,
    difficulty: "Medium",
    servings: 2,
    image: "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=800&q=80",
    tagline: "homestyle spicy chicken meals",
    subComponents: [
      "Chicken kulambu",
      "Beans poriyal",
      "Potato fry",
      "Rice"
    ],
    ingredients: [
      "500g Chicken, bone-in",
      "1 cup Rice",
      "150g French beans",
      "3 Potatoes",
      "Spices and masala",
      "Oil"
    ],
    steps: [
      "Prepare fragrant homestyle chicken kulambu with a ground onion-tomato masala and fennel spices.",
      "Sauté chopped green beans poriyal with mustard tempering and fresh grated coconut.",
      "Make potato fry thin sliced in a hot pan till crispy and golden brown.",
      "Serve hot with warm steaming white rice."
    ],
    nutritionFact: "High in protein and low in complex fats, perfect for lunch.",
    matchedIngredients: ["Chicken", "Potato", "Beans", "Rice"],
    videoCount: 3,
    popularCount: "1,240 chose this",
    youtubeLinks: {
      "Chicken kulambu": "https://www.youtube.com/results?search_query=how+to+cook+chicken+kulambu",
      "Beans poriyal": "https://www.youtube.com/results?search_query=how+to+cook+beans+poriyal",
      "Potato fry": "https://www.youtube.com/results?search_query=how+to+cook+south+indian+potato+fry"
    }
  },
  {
    id: "combo-3",
    recipeName: "Brinjal & egg",
    prepTime: "35 min",
    category: "Lunch",
    macros: { carbs: 42, protein: 18, fat: 14, calories: 340 },
    rating: 4.7,
    difficulty: "Easy",
    servings: 2,
    image: "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80",
    tagline: "tangy eggplant and seasoned egg",
    subComponents: [
      "Kathirikai kara kuzhambu",
      "Egg poriyal",
      "Beans poriyal",
      "Rice"
    ],
    ingredients: [
      "3 medium Brinjals (Eggplant), sliced",
      "2 fresh Eggs",
      "150g French beans, chopped",
      "1 cup Rice",
      "Tamarind pulp & visual spices"
    ],
    steps: [
      "Simmer sliced eggplants in a spicy tamarind curry (Kathirikai kara kuzhambu) with small onions and garlic spices.",
      "Scramble fresh eggs in a wok with fine chopped chilies and golden curry leaves for Egg poriyal.",
      "Prepare Beans poriyal by pan steaming green beans and tossing with coconut shavings and mustard seeds.",
      "Serve in a modular clay bowl with warm white rice."
    ],
    nutritionFact: "An excellent antioxidant-rich combo, full of brain-boosting choline from eggs, dietary fiber, and healthy minerals.",
    matchedIngredients: ["Egg", "Beans", "Brinjal", "Rice"],
    videoCount: 2,
    popularCount: "860 chose this",
    youtubeLinks: {
      "Kathirikai kara kuzhambu": "https://www.youtube.com/results?search_query=how+to+cook+kathirikai+kara+kuzhambu",
      "Egg poriyal": "https://www.youtube.com/results?search_query=how+to+cook+egg+poriyal",
      "Beans poriyal": "https://www.youtube.com/results?search_query=how+to+cook+beans+poriyal"
    }
  },
  {
    id: "combo-4",
    recipeName: "Egg kulambu",
    prepTime: "30 min",
    category: "Dinner",
    macros: { carbs: 38, protein: 16, fat: 12, calories: 310 },
    rating: 4.6,
    difficulty: "Easy",
    servings: 2,
    image: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=800&q=80",
    tagline: "savory boiled eggs in rich gravy",
    subComponents: [
      "Muttai kuzhambu",
      "Brinjal poriyal",
      "Potato fry",
      "Rice"
    ],
    ingredients: [
      "4 Boiled eggs, peeled",
      "2 medium Potatoes",
      "2 medium Brinjals (Eggplant)",
      "1 cup Rice",
      "Whole spices & coconut oil"
    ],
    steps: [
      "Boil eggs, peel them, make tiny slits, and simmer in traditional tangy spiced tomato-onion Muttai kuzhambu gravy.",
      "Slick slide Brinjals with ginger garlic paste and toast over a light iron pan with minimal groundnut oil for a smoky poriyal.",
      "Dice sweet potatoes, dust with pure red chili powder, rock salt, and pan-roast to golden excellence.",
      "Plate together hot with steamed white rice."
    ],
    nutritionFact: "Excellent combination of essential macro nutrients, complete protein from eggs, and comforting energy from potatoes.",
    matchedIngredients: ["Egg", "Potato", "Brinjal", "Rice"],
    videoCount: 3,
    popularCount: "540 chose this",
    youtubeLinks: {
      "Muttai kuzhambu": "https://www.youtube.com/results?search_query=how+to+cook+muttai+kuzhambu",
      "Brinjal poriyal": "https://www.youtube.com/results?search_query=how+to+cook+brinjal+poriyal",
      "Potato fry": "https://www.youtube.com/results?search_query=how+to+cook+south+indian+potato+fry"
    }
  },
  {
    id: "combo-5",
    recipeName: "Classic Banana Pancakes & Berries Dessert Combo",
    prepTime: "15 min",
    category: "Breakfast",
    macros: { carbs: 58, protein: 8, fat: 6, calories: 318 },
    rating: 4.8,
    difficulty: "Easy",
    servings: 2,
    image: "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?auto=format&fit=crop&w=800&q=80",
    tagline: "fluffy whole grain pancakes",
    subComponents: [
      "Banana-oat batter flapjacks",
      "Fresh blueberry topping",
      "Pure organic maple mist"
    ],
    ingredients: [
      "2 ripe Bananas, mashed",
      "2 fresh Eggs",
      "1 cup Rolled Oats (ground into flour)",
      "1/2 cup Almond milk",
      "1 tsp Cinnamon powder",
      "1 tsp Baking powder",
      "Fresh berries & organic maple syrup"
    ],
    steps: [
      "Whisk the eggs in a bowl, then stir in mashed banana, almond milk, oat flour, cinnamon, and baking powder to form a smooth batter.",
      "Heat a lightly oiled griddle or non-stick skillet over medium-high heat.",
      "Pour batter in circular discs. Cook until bubbles burst on top, then flip and brown on the other side.",
      "Stack high on a warm plate.",
      "Squeeze fresh orange or splash maple mist, then distribute sweet fresh berries generously."
    ],
    nutritionFact: "Made completely without refined sugars. Sweetened only by real bananas, providing long-lasting cellular glycogen and potassium for excellent mental stamina.",
    matchedIngredients: ["Egg", "Banana", "Oats"]
  }
];

// Memory database for logged plates
let USER_LOGS = [
  {
    id: "log-1",
    recipeName: "Earthy Quinoa Salad & Sweet Potato Combo",
    timestamp: new Date(Date.now() - 3 * 3600000).toISOString(), // 3 hours ago
    macros: { carbs: 48, protein: 14, fat: 12, calories: 356 },
    imageUrl: "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80",
    mealType: "Lunch",
    review: "Incredibly refreshing and rich in gut-supportive prebiotic fibers."
  },
  {
    id: "log-2",
    recipeName: "Avocado Toast & Poached Egg Breakfast Combo",
    timestamp: new Date(Date.now() - 11 * 3600000).toISOString(), // 11 hours ago
    macros: { carbs: 28, protein: 16, fat: 18, calories: 338 },
    imageUrl: "https://images.unsplash.com/photo-1541532713592-79a0317b6b77?auto=format&fit=crop&w=800&q=80",
    mealType: "Breakfast",
    review: "Kept my focus sharp through four morning calls without any sugar rollercoasters."
  }
];

// Lazy-initialize Gemini API
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (key) {
      aiClient = new GoogleGenAI({
        apiKey: key,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build"
          }
        }
      });
      console.log("Successfully initialized Gemini API Client");
    } else {
      console.warn("GEMINI_API_KEY is not defined in environment secrets. App will fallback to offline mock intelligence.");
    }
  }
  return aiClient;
}

// 1. API: Get meals library
app.get("/api/meals", (req, res) => {
  res.json({ meals: INITIAL_MEALS });
});

// 2. API: Get logs list
app.get("/api/logs", (req, res) => {
  res.json({ logs: USER_LOGS });
});

// 3. API: Add a manual or identified plate log
app.post("/api/logs/add", (req, res) => {
  const { recipeName, macros, imageUrl, mealType, review } = req.body;
  if (!recipeName || !macros) {
    return res.status(400).json({ error: "Missing recipeName or macros structure." });
  }

  const newLog = {
    id: `log-${Date.now()}`,
    recipeName,
    timestamp: new Date().toISOString(),
    macros: {
      carbs: Number(macros.carbs) || 0,
      protein: Number(macros.protein) || 0,
      fat: Number(macros.fat) || 0,
      calories: Number(macros.calories) || 0
    },
    imageUrl: imageUrl || "https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=400&q=80",
    mealType: mealType || "Snack",
    review: review || "Lovingly prepared and safely logged today."
  };

  USER_LOGS.unshift(newLog);
  res.status(201).json({ status: "success", log: newLog });
});

// 4. API: Delete logged plate
app.delete("/api/logs/:id", (req, res) => {
  const { id } = req.params;
  USER_LOGS = USER_LOGS.filter((l) => l.id !== id);
  res.json({ status: "success" });
});

// 5. API: Clear user logs (for resetting demo)
app.post("/api/logs/reset", (req, res) => {
  USER_LOGS = [
    {
      id: "log-1",
      recipeName: "Earthy Quinoa Salad Bowl",
      timestamp: new Date().toISOString(),
      macros: { carbs: 48, protein: 14, fat: 12, calories: 356 },
      imageUrl: "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80",
      mealType: "Lunch",
      review: "Incredibly refreshing and rich in gut-supportive prebiotic fibers."
    }
  ];
  res.json({ status: "success", logs: USER_LOGS });
});

// --- Engine 5 (Learning): Memory Database for Thumbs Up/Down and Prompt Alignment ---
interface FeedbackItem {
  id: string;
  mealId: string;
  recipeName: string;
  thumb: "up" | "down";
  timestamp: string;
  ingredients: string[];
  rules: string;
}

let FEEDBACK_STORE: FeedbackItem[] = [];

// API: Get learning adjusted feedback data
app.get("/api/learning/feedback", (req, res) => {
  res.json({ feedback: FEEDBACK_STORE });
});

// API: Save thumbs feedback for Engine 5 (Learning)
app.post("/api/learning/feedback", (req, res) => {
  const { mealId, recipeName, thumb, ingredients, rules } = req.body;
  
  if (!mealId || !recipeName || !thumb) {
    return res.status(400).json({ error: "Missing required feedback components." });
  }

  // Check if we already rated this meal, update it if so
  const existingIdx = FEEDBACK_STORE.findIndex(item => item.mealId === mealId);
  if (existingIdx > -1) {
    FEEDBACK_STORE[existingIdx].thumb = thumb;
    FEEDBACK_STORE[existingIdx].timestamp = new Date().toISOString();
  } else {
    FEEDBACK_STORE.push({
      id: `feedback-${Date.now()}`,
      mealId,
      recipeName,
      thumb,
      timestamp: new Date().toISOString(),
      ingredients: ingredients || [],
      rules: rules || "Standard customs"
    });
  }

  res.json({ status: "success", feedback: FEEDBACK_STORE });
});

// 6. API: Generate dynamic meal combo using ingredients tags via Gemini AI
// Implementing Engine 2 (YouTube Search Planner) & Engine 3 (Regional Rules Reasoning Engine)
app.post("/api/combos/generate", async (req, res) => {
  const { ingredients, category, rules } = req.body;
  const activeCategory = category || "Lunch";
  const activeRules = rules || "Tamil Nadu rules: 1 Kulambu, 2 Sides";
  
  if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
    return res.status(400).json({ error: "Missing array of active kitchen ingredients." });
  }

  // Leverage Engine 5 (Learning Systems) in prompt generation dynamically!
  const lovedMeals = FEEDBACK_STORE.filter(f => f.thumb === "up").map(f => `${f.recipeName} under rules: "${f.rules}"`);
  const dislikedMeals = FEEDBACK_STORE.filter(f => f.thumb === "down").map(f => f.recipeName);

  let learningDirective = "";
  if (lovedMeals.length > 0) {
    learningDirective += `\nUser highly preferred and thumbs-upped these recipes: [ ${lovedMeals.join(", ")} ]. Adapt your flavor profile and pairing choices to suit this style!`;
  }
  if (dislikedMeals.length > 0) {
    learningDirective += `\nUser did not like or thumbs-downed these dishes: [ ${dislikedMeals.join(", ")} ]. Avoid replicating these or similar composition styles!`;
  }

  const client = getGeminiClient();
  if (!client) {
    // Return exactly 3 distinct high-quality offline fallbacks matching the requested rules and ingredients
    const comboA_Id = `created-ai-offline-A-${Date.now()}`;
    const comboB_Id = `created-ai-offline-B-${Date.now()}`;
    const comboC_Id = `created-ai-offline-C-${Date.now()}`;

    const mainIng = ingredients[0] || "Fresh Vegetable";
    const sideIng = ingredients[1] || "Greens";
    const tertiaryIng = ingredients[2] || "Potato";

    const offlineCombos = [
      {
        id: comboA_Id,
        recipeName: `${activeRules.includes("Tamil Nadu") ? "Chettinad" : "Spicy Roasted"} ${mainIng} Plate`,
        prepTime: "50 min",
        category: activeCategory,
        macros: { carbs: 45, protein: 28, fat: 12, calories: 420 },
        rating: 4.8,
        difficulty: "Easy",
        servings: 2,
        image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80",
        tagline: "plated authentic offline feast",
        subComponents: [
          activeRules.includes("Tamil Nadu") ? `${mainIng} Kulambu` : `${mainIng} Sauté`,
          `${sideIng} Poriyal`,
          `${tertiaryIng} Roast`,
          "Rice"
        ],
        ingredients: [
          `2.5 cups fresh ${mainIng}`,
          `1 cup chopped ${sideIng}`,
          `1.5 cups diced ${tertiaryIng}`,
          "1.5 cups premium Basmati Rice",
          "1.5 tbsp sesame spices and curry leaves"
        ],
        steps: [
          `Inspect and dress your fresh ingredients: ${ingredients.join(", ")}.`,
          `Fulfill native regional partition rules "${activeRules}" for perfect presentation.`,
          `Simmer ${mainIng} Kara Kulambu in a clay vessel with tamarind nectar.`,
          `Stir-fry ${sideIng} dry with lightly toasted mustard seeds and fresh grated coconut.`,
          `Roast ${tertiaryIng} with red chili spice in a heavy cast iron pan until caramelized.`,
          "Mold steaming rice beautifully, drape the warm stew and roasted sides carefully around the edge."
        ],
        nutritionFact: "Earthy, mineral-rich comforting platter aligning with active lifestyle guidelines.",
        matchedIngredients: ingredients,
        offline: true,
        youtubeLinks: {
          [activeRules.includes("Tamil Nadu") ? `${mainIng} Kulambu` : `${mainIng} Sauté`]: `https://www.youtube.com/results?search_query=how+to+cook+${encodeURIComponent(mainIng)}+kulambu`,
          [`${sideIng} Poriyal`]: `https://www.youtube.com/results?search_query=how+to+cook+${encodeURIComponent(sideIng)}+poriyal`,
          [`${tertiaryIng} Roast`]: `https://www.youtube.com/results?search_query=how+to+cook+${encodeURIComponent(tertiaryIng)}+roast`
        },
        videoCount: 3,
        popularCount: "1,240 chose this"
      },
      {
        id: comboB_Id,
        recipeName: `${mainIng} Day Plate`,
        prepTime: "45 min",
        category: activeCategory,
        macros: { carbs: 38, protein: 24, fat: 10, calories: 350 },
        rating: 4.7,
        difficulty: "Normal",
        servings: 2,
        image: "https://images.unsplash.com/photo-1626853558417-ad6c4f828a2a?auto=format&fit=crop&w=800&q=80",
        tagline: "balanced mindful nutrition plate",
        subComponents: [
          `${mainIng} Kulambu`,
          `${sideIng} Poriyal`,
          "Beans poriyal",
          "Rice"
        ],
        ingredients: [
          `2 cups wholesome chopped ${mainIng}`,
          `1.5 cups fine Beans`,
          `1 cup sliced ${sideIng}`,
          "Spices, coconut shreds, cold-pressed oil"
        ],
        steps: [
          `Wash and separate vegetable ingredients meticulously.`,
          "Prepare flavorful basic aromatic temper using mustard, cumin, and dried red chilies.",
          `Slow cook ${mainIng} down in seasoned tamarind curry gravy until thoroughly tender.`,
          "Gently steam and toss cut beans and side greens with coconut shreds for fiber-dense sides.",
          "Assemble neat portions of curry and fresh nutritious greens surrounding a bed of fluffy rice."
        ],
        nutritionFact: "Full of dietary fiber, minerals, and digestible energy to keep your blood sugar balanced.",
        matchedIngredients: ingredients,
        offline: true,
        youtubeLinks: {
          [`${mainIng} Kulambu`]: `https://www.youtube.com/results?search_query=how+to+cook+${encodeURIComponent(mainIng)}+kulambu`,
          [`${sideIng} Poriyal`]: `https://www.youtube.com/results?search_query=how+to+cook+${encodeURIComponent(sideIng)}+poriyal`
        },
        videoCount: 2,
        popularCount: "860 chose this"
      },
      {
        id: comboC_Id,
        recipeName: `Sankara Meen Style ${mainIng} Combo`,
        prepTime: "45 min",
        category: activeCategory,
        macros: { carbs: 42, protein: 32, fat: 12, calories: 405 },
        rating: 4.9,
        difficulty: "Medium",
        servings: 2,
        image: "https://images.unsplash.com/photo-1541832676-9b763b0239ab?auto=format&fit=crop&w=800&q=80",
        tagline: "regional coastal comfort assembly",
        subComponents: [
          `Sankara Meen Urulaikilangu Kulambu`,
          `Muttai Podimas`,
          `${sideIng} Poriyal`
        ],
        ingredients: [
          `2 cups premium fresh ${mainIng}`,
          "2 farm fresh Eggs",
          `1.5 cups chopped ${sideIng}`,
          "Grated coconut, coastal spices, curry sprigs"
        ],
        steps: [
          "Create authentic coastal masala paste with shallots, fennel, garlic, and freshly scraped coconut.",
          `Simmer potatoes and ${mainIng} together in seasoned tangy coastal curry base.`,
          "Scramble the eggs with thin onion shreds to build the soft Tamil-style Muttai Podimas.",
          `Whisk and lightly steam ${sideIng} with mustard seeds for fresh texture contrast.`,
          "Serve steaming hot with the fragrant coastal curry sauce spooned on top."
        ],
        nutritionFact: "High-protein coastal preparation with healthy fats, iron, and rich antioxidants.",
        matchedIngredients: ingredients,
        offline: true,
        youtubeLinks: {
          "Sankara Meen Urulaikilangu Kulambu": "https://www.youtube.com/results?search_query=sankara+meen+kulambu+authentic",
          "Muttai Podimas": "https://www.youtube.com/results?search_query=how+to+cook+egg+scramble+podimas"
        },
        videoCount: 3,
        popularCount: "92% match today"
      }
    ];

    // Align with our session list
    offlineCombos.forEach(combo => {
      INITIAL_MEALS.unshift(combo as any);
    });

    return res.json({ combos: offlineCombos });
  }

  try {
    const prompt = `You are Vigadi, a neutral food tracker. Never judge a user. Present food data neutrally and warmly.
    
We are operating Engine 3 (Rules reasoning engine with live search grounding).
Active kitchen ingredient tags: [${ingredients.join(", ")}].
Target meal slot category: ${activeCategory}.
Specific custom cooking guidelines / regional rules to follow: "${activeRules}"
${learningDirective}

Your task is to construct EXACTLY 3 distinct, authentic and balanced combo plates adhering perfectly to the custom rules.
For example, if rules state "Tamil Nadu rules: 1 Kulambu, 2 Sides", each combo's subComponents list must contain exactly 1 Kulambu (spices/onion/sour stew) and 2 Sides (such as dry poriyal, roast, fry, podimas), alongside a staple carb (Rice, Roti, Bread, etc.). Formulate native, authentic recipes.

CRITICAL RESEARCH INSTRUCTION: You must use the Google Search tool to search for real dishes and authentic YouTube video URLs on the web. For each cooking sub-component, search for its recipe video on YouTube (for example search for "how to cook ladies finger fry south indian style youtube" or similar) and find real, authentic YouTube URL/link (such as "https://www.youtube.com/watch?v=VIDEO_ID" or "https://youtu.be/VIDEO_ID"). Do NOT generate random, fake or hallucinated URLs. Extract only real-world active URLs from the search results to map to each subComponent dish in the realYoutubeLinks object.

For each of the 3 combinations, you must also operate Engine 2 (YouTube search planner): generate highly specific, clean, ideal YouTube search queries to discover tutorials for each item in the subComponents list. No punctuation or extra brackets in queries.

Provide the response as a single valid JSON object adhering precisely to this schema:
{
  "combos": [
    {
      "recipeName": "A classic, comforting and authentic regional name for combo 1 (e.g., 'Chettinad chicken plate')",
      "prepTime": "Prep/cooking time (e.g., '50 min')",
      "difficulty": "Easy, Medium, or Hard",
      "servings": 2,
      "macros": {
        "carbs": 45,
        "protein": 28,
        "fat": 12,
        "calories": 410
      },
      "tagline": "A single premium aesthetic tagline phrase describing the plate combo",
      "subComponents": [
        "Component A name matching regional rules",
        "Component B name matching regional rules",
        "Component C name",
        "Starch Component"
      ],
      "ingredients": [
        "1.5 cups fresh main vegetable with unit",
        "Pantry staples / spices with detailed fractions"
      ],
      "steps": [
        "Triage and wash step...",
        "Detailed step describing preparation of Component A...",
        "Detailed step describing cooking of Component B...",
        "Detailed plating/assembly step matching regional guidelines..."
      ],
      "nutritionFact": "A highly warm, encouraging, non-judgmental description of the plate's dietary benefits.",
      "youtubeQueries": {
        "Component A name": "clean search query (e.g. 'how to cook vendakkai kara kuzhambu south indian style')",
        "Component B name": "query for Component B",
        "Component C name": "query for Component C"
      },
      "realYoutubeLinks": {
        "Component A name": "exact real YouTube URL retrieved from your search grounding results (e.g. https://www.youtube.com/watch?v=VIDEO_ID)",
        "Component B name": "exact real YouTube URL retrieved for Component B",
        "Component C name": "exact real YouTube URL retrieved for Component C"
      }
    }
  ]
}`;

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        systemInstruction: "You are Vigadi, a neutral and premium lifestyle food companion. Avoid medical warnings, dietary shame, or aggressive gym talk. Critically, you MUST use the Google Search tool to search for real cooking recipes and retrieve actual YouTube video guide URLs on Google for the user's specific regional ingredients.",
      }
    });

    const parsedData = cleanAndParseJson(response.text || '{"combos": []}');
    const combosList = parsedData?.combos || [];

    // Ensure we have an array of combos
    if (!Array.isArray(combosList) || combosList.length === 0) {
      throw new Error("Invalid output format returned by model.");
    }

    // Process and enrich each of the 3 combos
    const imagesList = [
      "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1626853558417-ad6c4f828a2a?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1541832676-9b763b0239ab?auto=format&fit=crop&w=800&q=80"
    ];

    const enrichedCombos = combosList.slice(0, 3).map((item: any, index: number) => {
      const queries = item.youtubeQueries || {};
      const realLinks = item.realYoutubeLinks || {};
      const youtubeLinks: Record<string, string> = {};

      item.subComponents?.forEach((comp: string) => {
        const q = queries[comp] || `how to cook ${comp}`;
        const realUrl = realLinks[comp];

        if (realUrl && (realUrl.startsWith("http://") || realUrl.startsWith("https://"))) {
          youtubeLinks[comp] = realUrl;
        } else {
          youtubeLinks[comp] = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
        }
      });

      item.id = `created-ai-${Date.now()}-${index}`;
      item.category = activeCategory;
      item.rating = parseFloat((4.6 + Math.random() * 0.3).toFixed(1)) || 4.8;
      item.videoCount = item.subComponents?.length || 3;
      item.popularCount = index === 2 ? "92% match today" : "1,240 chose this";
      item.youtubeLinks = youtubeLinks;
      item.matchedIngredients = ingredients;
      item.image = imagesList[index % imagesList.length];

      // Store in backend initial meals for query synchronization
      INITIAL_MEALS.unshift(item);

      return item;
    });

    res.json({ combos: enrichedCombos });
  } catch (error: any) {
    console.error("Gemini combination generation failed in Engine 3:", error);
    res.status(500).json({ error: "Gemini AI failed to process ingredients. Please check configuration." });
  }
});

// 7. API: Photo-first parsing logging (Vision AI)
app.post("/api/logs/parse-photo", async (req, res) => {
  const { imageBase64, mimeType } = req.body;
  if (!imageBase64) {
    return res.status(400).json({ error: "No image file provided for Vígadi Vision." });
  }

  const client = getGeminiClient();
  if (!client) {
    // Offline simulated backup log parsed from a dummy file signature or name
    return res.json({
      recipeName: "Green Harvest Organic Plate",
      prepTimeEstimate: "15 min",
      ingredients: [
        "1 Avocado",
        "Handful of fresh watercress",
        "2 organic Free-range eggs",
        "Drizzle of sesame oil"
      ],
      macros: {
        carbs: 22,
        protein: 15,
        fat: 16,
        calories: 292
      },
      review: "A highly elegant, clean-looking plate tracked offline. Rich in monounsaturated fats and dynamic trace minerals.",
      offline: true
    });
  }

  try {
    const rawData = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const imagePart = {
      inlineData: {
        data: rawData,
        mimeType: mimeType || "image/jpeg"
      }
    };

    const textPart = {
      text: `You are Vigadi, a warm and neutral lifestyle food companion. Detect the food or culinary preparation in this meal photo. Estimate its ingredients, portions, find prep time, and calculate estimated macronutrient info (carbs, protein, fat, calories).
Never judge the user's choices. Respond neutrally and with deep encouraging warmth.
Respond strictly in JSON format using this exact schema:
{
  "recipeName": "A descriptive, appealing culinary name of the detected dish",
  "prepTimeEstimate": "Estimated cooking/prep time (e.g. '20 min')",
  "ingredients": [
    "estimated portion of ingredient or condiment detected"
  ],
  "macros": {
    "carbs": 30,
    "protein": 18,
    "fat": 14,
    "calories": 318
  },
  "review": "Provide a warm, premium, non-judgmental description of this food choice (e.g. 'This represents a beautiful source of clean energy to help you float through your active afternoon schedule. Egg yolks offer amazing fat-soluble brain food.')"
}`
    };

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: { parts: [imagePart, textPart] },
      config: {
        responseMimeType: "application/json"
      }
    });

    const parsedData = cleanAndParseJson(response.text || "{}") || {};
    res.json(parsedData);
  } catch (error: any) {
    console.error("Gemini Vision Parser failed:", error);
    res.status(500).json({ error: "Gemini Vision failed to scan the dish. Try checking the format or API parameters." });
  }
});

// Serve assets and standard Express logic
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // Mount Vite in development Mode
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    // Serve build artifacts in production Mode
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Vigadi] Server is beautifully balanced and running on http://localhost:${PORT}`);
  });
}

startServer();
