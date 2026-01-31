import { GoogleGenAI } from "@google/genai";
import { TaskPriority } from "../types";

// Note: In a real production app, this key should be guarded by a backend proxy.
// The prompt assumes process.env.API_KEY is available.

export const generateUnitFlavor = async (taskTitle: string, priority: TaskPriority): Promise<{ codename: string; flavorText: string }> => {
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      console.warn("No API Key found for GenAI");
      return { codename: `OP: ${taskTitle.toUpperCase().substring(0, 10)}`, flavorText: "Standard issue assignment." };
    }

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `
      You are a tactical command AI for a strategy game called ChronoTactics.
      Convert the following real-world task into a cool, military/cyberpunk tactical operation.
      
      Task: "${taskTitle}"
      Priority: "${priority}"
      
      Return a JSON object with two fields:
      1. "codename": A short, cool operation name (e.g., "OP: IRON CLAD", "PROJECT: ZERO").
      2. "flavorText": A one-sentence briefing description in a sci-fi/tactical tone.
      
      Output JSON only.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");

    const data = JSON.parse(text);
    return {
      codename: data.codename || 'UNKNOWN OP',
      flavorText: data.flavorText || 'Data corruption detected in briefing.'
    };

  } catch (error) {
    console.error("GenAI Error:", error);
    return {
      codename: `OP: ${taskTitle.split(' ')[0].toUpperCase()}`,
      flavorText: "Secure link failed. Proceed with standard protocols."
    };
  }
};
