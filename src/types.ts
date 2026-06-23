export interface Macros {
  carbs: number;
  protein: number;
  fat: number;
  calories: number;
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
