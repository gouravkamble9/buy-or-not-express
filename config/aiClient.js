const { GoogleGenerativeAI } = require("@google/generative-ai");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  throw new Error("Missing GEMINI_API_KEY in environment variables.");
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

/**
 * Returns a configured Gemini model instance.
 * @param {boolean} jsonMode - Whether to force JSON output mode
 * @returns Gemini GenerativeModel instance
 */
const getModel = (jsonMode = false) => {
  return genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || "gemini-3.5-flash-lite",
    ...(jsonMode && { generationConfig: { responseMimeType: "application/json" } }),
  });
};

/**
 * Sends a prompt to the AI model and returns the raw text response.
 * @param {string} prompt
 * @param {boolean} jsonMode
 * @returns {Promise<string>}
 */
const generateText = async (prompt, jsonMode = false) => {
  const model = getModel(jsonMode);
  const result = await model.generateContent(prompt);
  return result.response.text();
};

/**
 * Sends a prompt to the AI model and returns a parsed JSON object.
 * Strips markdown code fences if the model wraps the response in them.
 * @param {string} prompt
 * @returns {Promise<object>}
 */
const generateJSON = async (prompt) => {
  const text = await generateText(prompt, true);
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  return JSON.parse(cleaned);
};

module.exports = { generateText, generateJSON };
