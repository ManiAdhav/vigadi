import type { MealGroup } from "./mealTemplates";

/**
 * The dish catalog was generated ingredient-by-ingredient ("what dishes use
 * brinjal?"), which reliably produces variants and reliably skips the plain
 * staple underneath them. The catalog has 21 rice dishes and no plain rice, 20
 * idli variants and no idli, 24 dosa variants and no dosa.
 *
 * These are those missing base dishes. Everything here hangs off an ingredient
 * that already exists in the catalog — the dishes table requires one.
 */
export interface StapleDish {
  name: string;
  ingredientSlug: string;
  dishGroup: string;
  dishCategory: string;
  consistency: string;
  baseTags: string[];
  accompaniments: string[];
  englishAlias: string | null;
  /** Alternate spellings and English names people actually type. */
  nameAliases: string[];
  spiceLevel: string;
  mainIngredients: string[];
  description: string;
  /** The template slot this staple is meant to fill. Asserted in tests. */
  expectSlotCategory: MealGroup;
}

export const STAPLE_DISHES: StapleDish[] = [
  {
    name: "Sadam",
    ingredientSlug: "rice",
    dishGroup: "Rice",
    dishCategory: "Plain Rice",
    consistency: "dry",
    baseTags: ["standalone"],
    accompaniments: ["sambar", "rasam", "kuzhambu", "appalam"],
    englishAlias: "Plain Rice",
    nameAliases: ["Rice", "Plain Rice", "Steamed Rice", "White Rice", "Saadam", "Choru", "Sooru"],
    spiceLevel: "mild",
    mainIngredients: ["rice"],
    description: "Everyday steamed rice — the base every Tamil lunch is built on.",
    expectSlotCategory: "rice",
  },
  {
    name: "Idli",
    ingredientSlug: "idli-batter",
    dishGroup: "Tiffin",
    dishCategory: "Tiffin",
    consistency: "dry",
    baseTags: ["standalone"],
    accompaniments: ["chutney", "sambar", "idli podi"],
    englishAlias: "Breakfast",
    nameAliases: ["Idly", "Plain Idli", "Idlee", "Steamed Idli"],
    spiceLevel: "mild",
    mainIngredients: ["idli-batter"],
    description: "Plain steamed rice and urad dal cakes — the default Tamil breakfast.",
    expectSlotCategory: "tiffin",
  },
  {
    name: "Dosa",
    ingredientSlug: "dosa-batter",
    dishGroup: "Tiffin",
    dishCategory: "Tiffin",
    consistency: "crisp",
    baseTags: ["standalone"],
    accompaniments: ["chutney", "sambar", "idli podi"],
    englishAlias: "Breakfast",
    nameAliases: ["Dosai", "Plain Dosa", "Sada Dosa", "Dose", "Thosai"],
    spiceLevel: "mild",
    mainIngredients: ["dosa-batter", "oil"],
    description: "Plain crisp rice and lentil crepe, cooked to order on a hot tawa.",
    expectSlotCategory: "tiffin",
  },
  {
    name: "Uttapam",
    ingredientSlug: "dosa-batter",
    dishGroup: "Tiffin",
    dishCategory: "Tiffin",
    consistency: "dry",
    baseTags: ["standalone"],
    accompaniments: ["chutney", "sambar"],
    englishAlias: "Breakfast",
    nameAliases: ["Uthappam", "Plain Uttapam", "Ooththappam", "Uthappa"],
    spiceLevel: "mild",
    mainIngredients: ["dosa-batter", "oil"],
    description: "Thick, soft, spongy batter pancake — the untopped version.",
    expectSlotCategory: "tiffin",
  },
  {
    name: "Arisi Puttu",
    ingredientSlug: "parboiled-rice",
    dishGroup: "Tiffin",
    dishCategory: "Tiffin",
    consistency: "dry",
    baseTags: ["standalone"],
    accompaniments: ["sugar", "banana", "kadalai kuzhambu"],
    englishAlias: "Breakfast",
    nameAliases: ["Puttu", "Rice Puttu", "Pittu"],
    spiceLevel: "mild",
    mainIngredients: ["parboiled-rice", "coconut"],
    description: "Steamed rice flour and coconut, crumbled loose — eaten sweet or with kuzhambu.",
    expectSlotCategory: "tiffin",
  },
  {
    name: "Thengai Chutney",
    ingredientSlug: "coconut",
    dishGroup: "Chutney",
    dishCategory: "Chutney",
    consistency: "semi_liquid",
    baseTags: ["idli", "dosa", "pongal", "uttapam"],
    accompaniments: [],
    englishAlias: "Chutney",
    nameAliases: ["Coconut Chutney", "Chutney", "White Chutney", "Thengai Chatni", "Kobbari Chutney"],
    spiceLevel: "mild",
    mainIngredients: ["coconut", "green chillies", "roasted gram", "ginger"],
    description: "The default white coconut chutney that goes with idli, dosa and pongal.",
    expectSlotCategory: "chutney",
  },
  {
    name: "Thengai Thuvaiyal",
    ingredientSlug: "coconut",
    dishGroup: "Chutney",
    dishCategory: "Thuvaiyal",
    consistency: "dry",
    baseTags: ["rice", "idli", "dosa"],
    accompaniments: [],
    englishAlias: "Thogayal",
    nameAliases: ["Coconut Thuvaiyal", "Coconut Thogayal", "Thengai Thogayal"],
    spiceLevel: "medium",
    mainIngredients: ["coconut", "urad dal", "dried red chillies", "tamarind"],
    description: "Thick ground coconut relish, eaten with rice or as a tiffin side.",
    expectSlotCategory: "chutney",
  },
  {
    name: "Vevicha Muttai",
    ingredientSlug: "egg",
    dishGroup: "Side",
    dishCategory: "Fry",
    consistency: "dry",
    baseTags: ["rice", "chapati", "idli", "dosa"],
    accompaniments: [],
    englishAlias: null,
    nameAliases: [
      "Boiled Egg",
      "Egg Boiled",
      "Hard Boiled Egg",
      "Muttai Vevichathu",
      "Vevicha Muttai",
    ],
    spiceLevel: "mild",
    mainIngredients: ["egg"],
    description: "Plain boiled egg — the simplest protein to put beside rice or tiffin.",
    expectSlotCategory: "side",
  },
  {
    name: "Muttai Omelette",
    ingredientSlug: "egg",
    dishGroup: "Side",
    dishCategory: "Fry",
    consistency: "dry",
    baseTags: ["rice", "chapati", "dosa"],
    accompaniments: [],
    englishAlias: null,
    nameAliases: [
      "Egg Omelette",
      "Omelette",
      "Omlet",
      "Egg Omlet",
      "Omlette",
      "Muttai Poriyal",
    ],
    spiceLevel: "medium",
    mainIngredients: ["egg", "onions", "green chillies", "curry leaves"],
    description: "Everyday egg omelette with onion, chilli and curry leaves.",
    expectSlotCategory: "side",
  },
  {
    name: "Muttai Half Boil",
    ingredientSlug: "egg",
    dishGroup: "Side",
    dishCategory: "Fry",
    consistency: "semi_liquid",
    baseTags: ["rice", "chapati", "dosa", "parotta"],
    accompaniments: [],
    englishAlias: null,
    nameAliases: ["Half Boil", "Half Boiled Egg", "Sunny Side Up", "Muttai Half Boiled"],
    spiceLevel: "mild",
    mainIngredients: ["egg", "black pepper"],
    description: "Egg fried soft with a running yolk, peppered and slid onto the plate.",
    expectSlotCategory: "side",
  },
];

/**
 * Aliases for dishes the catalog ALREADY has, keyed by their exact stored name.
 * These are the ones that were unfindable because the catalog stores the Tamil
 * name and people type the English one — or vice versa.
 */
export const CATALOG_NAME_ALIASES: Record<string, string[]> = {
  // Egg — the whole block is stored as "Muttai …"
  "Muttai Podimas": ["Egg Podimas", "Egg Bhurji", "Egg Burji", "Scrambled Egg", "Muttai Burji"],
  "Muttai Kurma": ["Egg Kurma", "Egg Korma"],
  "Muttai Thokku": ["Egg Thokku", "Egg Masala"],
  "Muttai Salna": ["Egg Salna", "Egg Gravy"],
  "Muttai Milagu Roast": ["Egg Pepper Roast", "Pepper Egg", "Egg Roast"],
  "Karuvapillai Muttai Roast": ["Curry Leaf Egg Roast", "Curry Leaves Egg"],
  "Udaitha Muttai Kuzhambu": ["Egg Kuzhambu", "Egg Curry", "Egg Kulambu"],
  "Muttai Dosa": ["Egg Dosa", "Egg Dosai"],
  "Muttai Sadam (Egg Rice)": ["Egg Rice", "Muttai Rice"],
  "Muttai Noodles": ["Egg Noodles"],

  // Staple gravies — the plain versions people ask for by their English name
  "Toor Dal Sambar": ["Sambar", "Plain Sambar", "Sambhar", "Saambar", "Dal Sambar"],
  "Paruppu Rasam": ["Rasam", "Plain Rasam", "Dal Rasam", "Rasam Soup"],
  "Paruppu Kadayal": ["Paruppu", "Plain Dal", "Dal", "Mashed Dal"],

  // Tiffin and rice staples stored under a Tamil or compound name
  Chapati: ["Chappathi", "Chapathi", "Roti", "Chapatti", "Phulka"],
  Poori: ["Puri", "Pooree", "Poori Bhaji"],
  "Ven Pongal": ["Pongal", "Khara Pongal", "Ghee Pongal"],
  "Medhu Vadai": ["Vada", "Vadai", "Ulundhu Vadai", "Medu Vada", "Uzhunnu Vada"],
  Idiyappam: ["String Hoppers", "Nool Puttu"],
  "Rava Upma": ["Upma", "Uppuma", "Rava Uppuma"],
  "Puzhungal Arisi Kanji": ["Kanji", "Rice Porridge", "Kanchi"],
  "Thayir Sadam (Curd Rice)": ["Curd Rice", "Thayir Saadam", "Yogurt Rice", "Daddojanam"],
  "Elumichai Sadam (Lemon Rice)": ["Lemon Rice", "Elumichai Saadam"],
  "Thakkali Sadam (Tomato Rice)": ["Tomato Rice", "Thakkali Saadam"],
  "Thengai Sadam (Coconut Rice)": ["Coconut Rice", "Thengai Saadam"],
  "Puliyodarai (Puli Sadam / Tamarind Rice)": ["Tamarind Rice", "Puli Sadam", "Pulihora"],
  "Idli Milagai Podi": ["Idli Podi", "Milagai Podi", "Gunpowder", "Chutney Podi"],
};

/** Every alias for a dish, whether it is a new staple or an existing catalog dish. */
export function aliasesForDish(dishName: string): string[] {
  const staple = STAPLE_DISHES.find((d) => d.name === dishName);
  if (staple) return staple.nameAliases;
  return CATALOG_NAME_ALIASES[dishName] ?? [];
}

interface SearchableDish {
  name: string;
  name_aliases?: string[] | null;
}

function aliasList(dish: SearchableDish): string[] {
  return Array.isArray(dish.name_aliases) ? dish.name_aliases : [];
}

/**
 * Substring match over the dish name AND its aliases — the same "contains"
 * behaviour the name search already had, just widened to alternate spellings.
 */
export function dishNameMatchesQuery(dish: SearchableDish, query: string): boolean {
  const q = query.toLowerCase().trim();
  if (!q) return false;
  if (dish.name.toLowerCase().includes(q)) return true;
  return aliasList(dish).some((alias) => alias.toLowerCase().includes(q));
}

/**
 * Lower rank sorts first. An alias prefix has to rank alongside a name prefix,
 * otherwise typing "Rice" buries plain Sadam under 21 variety rices that happen
 * to have "Rice" in their name.
 */
export function dishSearchRank(dish: SearchableDish, query: string): number {
  const q = query.toLowerCase().trim();
  if (!q) return 99;
  const name = dish.name.toLowerCase();
  const aliases = aliasList(dish).map((a) => a.toLowerCase());

  if (name === q || aliases.includes(q)) return 0;
  if (name.startsWith(q) || aliases.some((a) => a.startsWith(q))) return 1;
  if (name.includes(q)) return 2;
  if (aliases.some((a) => a.includes(q))) return 3;
  return 4;
}
