export interface Macros {
  carbs: number;
  protein: number;
  fat: number;
  calories: number;
}

export interface CatalogDish {
  id: number;
  ingredientName?: string;
  name: string;
  youtubeUrl: string | null;
  youtubeVideoId: string | null;
  dishType: string | null;
  spiceLevel: string | null;
  mainIngredients: string[];
  pairsWith: string[];
  description: string | null;
  channelName: string | null;
  discoveredAt?: string;
  source?: string;
}

export interface BuiltComboOption {
  id: string;
  name: string;
  dishIds: number[];
  subComponents: string[];
  dishes: CatalogDish[];
  staple: string;
  rationale: string;
  source?: "global_pool" | "gemini" | "rule_engine";
  popularCount?: number;
}

export interface Meal {
  id: string;
  recipeName: string;
  prepTime: string;
  category: "Breakfast" | "Lunch" | "Dinner" | "Desserts" | "Vegan" | string;
  macros: Macros;
  rating?: number;
  difficulty?: "Easy" | "Medium" | "Hard" | string;
  servings?: number;
  image: string;
  tagline: string;
  subComponents: string[];
  ingredients: string[];
  steps: string[];
  nutritionFact: string;
  matchedIngredients?: string[];
  offline?: boolean;
  videoCount?: number;
  popularCount?: string;
  youtubeLinks?: Record<string, string>;
}

export interface MealLog {
  id: string;
  recipeName: string;
  timestamp: string;
  macros: Macros;
  imageUrl: string;
  mealType: "Breakfast" | "Lunch" | "Dinner" | "Snack" | string;
  review?: string;
  offline?: boolean;
}

export type ActiveScreen = "home" | "kitchen" | "logs" | "profile";
