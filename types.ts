
export enum Preference {
  VEG = 'Veg',
  NON_VEG = 'Non-Veg'
}

export enum MealTime {
  BREAKFAST = 'Breakfast',
  LUNCH = 'Lunch',
  DINNER = 'Dinner'
}

export interface UserSettings {
  name: string;
  preference: Preference;
  location: string;
}

export interface MealPlan {
  id: string;
  date: string;
  time: MealTime;
  main: string;
  sides: string[];
  nutritionalInfo: {
    calories: number;
    protein: string;
    carbs: string;
    fat: string;
  };
  ingredientsUsed: string[];
}

export interface SuggestionRequest {
  ingredients: string;
  people: number;
  time: MealTime;
  preference: Preference;
  duration: number;
}
