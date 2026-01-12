
import { GoogleGenAI, Type } from "@google/genai";
import { SuggestionRequest, UserSettings } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

export const generateMealSuggestion = async (
  request: SuggestionRequest,
  user: UserSettings
) => {
  const prompt = `
    Suggest a balanced Tamil Nadu style meal menu for ${request.people} people.
    Preference: ${request.preference}
    Location: ${user.location} (Use local flavors/spices)
    Time: ${request.time}
    Duration: ${request.duration} minutes
    Available Ingredients: ${request.ingredients}
    
    Rules:
    1. Balanced Diet: Must include vegetable, carb, and protein.
    2. Pairing: If main is dry, side must be gravy. Contrast spice levels.
    3. Authenticity: Use Tamil Nadu names (e.g., Sambar, Poriyal, Kootu).
    4. Feasibility: Must be cookable in ${request.duration} mins for ${request.people} people.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          main: { type: Type.STRING },
          sides: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING } 
          },
          nutritionalInfo: {
            type: Type.OBJECT,
            properties: {
              calories: { type: Type.NUMBER },
              protein: { type: Type.STRING },
              carbs: { type: Type.STRING },
              fat: { type: Type.STRING }
            },
            required: ["calories", "protein", "carbs", "fat"]
          }
        },
        required: ["main", "sides", "nutritionalInfo"]
      },
    },
  });

  return JSON.parse(response.text);
};
