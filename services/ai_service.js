const BASE_URL = "https://generativelanguage.googleapis.com/v1";

console.log("AI Service Loaded: v13 (Dynamic Discovery) - " + new Date().toISOString());

class AIService {
    static async getValidModel(apiKey) {
        try {
            console.log("Discovering available models...");
            const response = await fetch(`${BASE_URL}/models?key=${apiKey}`);
            if (!response.ok) throw new Error("Failed to list models");

            const data = await response.json();
            const models = data.models || [];

            console.log("Found models:", models.map(m => m.name));

            // Prefer Flash -> Pro -> standard Gemini
            // Must support generateContent
            const validModels = models.filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent"));

            // Priority list: Flash (Fast/Cheap) -> Pro (Stable) -> 1.5 -> 1.0
            const bestModel = validModels.find(m => m.name.includes("flash")) ||
                validModels.find(m => m.name.includes("pro") && m.name.includes("1.5")) ||
                validModels.find(m => m.name.includes("pro")) ||
                validModels[0];

            if (!bestModel) throw new Error("No text generation models found for this key.");

            console.log("%c SELECTED MODEL: " + bestModel.name, "background: #222; color: #00ff00; font-size: 14px;");

            // The name comes back as "models/gemini-1.5-flash-latest", so we use it directly.
            // But we need to handle if it has "models/" prefix or not to be safe.
            return bestModel.name.startsWith("models/") ? bestModel.name.split("/")[1] : bestModel.name;
        } catch (e) {
            console.error("Model discovery failed, defaulting to hardcoded fallback:", e);
            return "gemini-1.5-flash"; // Ultimate fallback
        }
    }

    static async extractQuotes(text, apiKey) {
        if (!apiKey) throw new Error("API Key is missing");

        // 1. Find the right model dynamically
        const modelName = await this.getValidModel(apiKey);
        const qualifiedUrl = `${BASE_URL}/models/${modelName}:generateContent`;

        console.log("Attempting request to:", qualifiedUrl);

        const prompt = `
            You are an expert literary curator. I will provide you with text from a book. 
            Your task is to identify and extract the most inspiring, motivational, or profound quotes from this text.
            
            Return the result ONLY as a valid JSON array of objects.
            Each object should have:
            - "text": The exact quote text.
            - "author": "Unknown" (since we are analyzing a chunk, unless you recognize the likely author, else default to "Unknown").
            - "book": "Uploaded Book" (placeholder).
            
            Extract between 1 to 5 quotes depending on the content quality. If the text has no inspiring quotes, return an empty array.
            Do not include any markdown formatting (like \`\`\`json) in the response, just the raw JSON string.
            
            Text to analyze:
            Text to analyze:
            "${text}"
        `;

        try {
            const response = await fetch(`${qualifiedUrl}?key=${apiKey}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }]
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || "Failed to fetch from Gemini API");
            }

            const data = await response.json();

            if (!data.candidates || data.candidates.length === 0) {
                throw new Error("No quotes generated (blocked safety?). Try another book.");
            }

            const generatedText = data.candidates[0].content.parts[0].text;

            // Clean up if model adds markdown blocks
            const cleanJson = generatedText.replace(/```json/g, '').replace(/```/g, '').trim();

            return JSON.parse(cleanJson);

        } catch (error) {
            console.error("AI Service Error:", error);
            throw error;
        }
    }
}
