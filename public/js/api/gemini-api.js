/**
 * Gemini AI API integration for generating content
 */
export class GeminiApi {
  constructor(apiUrl) {
    this.apiUrl = apiUrl;
  }

  async callGeminiAPI(prompt) {
    const payload = {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    };
    
    const response = await fetch(this.apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      throw new Error(`Gemini API Error: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    if (result.candidates && result.candidates[0]?.content?.parts[0]?.text) {
      return result.candidates[0].content.parts[0].text;
    } else {
      if (result.promptFeedback && result.promptFeedback.blockReason) {
        throw new Error(
          `Request blocked by Gemini: ${result.promptFeedback.blockReason}`,
        );
      }
      throw new Error("Could not get a valid response from the AI.");
    }
  }

  async generateSynopsis(title) {
    const prompt = `Provide a compelling, one-paragraph synopsis for the following title: "${title}".`;
    return this.callGeminiAPI(prompt);
  }
}

