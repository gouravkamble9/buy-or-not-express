const { generateJSON } = require("../config/aiClient");
const { searchVideos, fetchCommentsForVideo, summarizeProduct } = require("./youtubeService");

const getCommentsAnalysis = async (productName) => {
  const videoIds = await searchVideos(`${productName} review`);

  const commentsPromises = videoIds.map(id => fetchCommentsForVideo(id));
  const commentsArrays = await Promise.all(commentsPromises);
  const allComments = commentsArrays.flat().slice(0, 5000);

  const summary = await summarizeProduct(productName, allComments);

  const prompt = `You are an assistant that gives product buying advice. Analyze these YouTube comment summaries and tell if the product is worth buying.
Return a valid JSON object with exactly this structure:
{
  "recommendation": "Buy" | "Skip" | "Neutral",
  "reason": "Short explanation of why this product is worth buying or not.",
  "confidenceScore": 8,
  "pros": ["Pro 1", "Pro 2", "Pro 3"],
  "cons": ["Con 1", "Con 2", "Con 3"],
  "bestFor": ["Type of user who should buy this product", "Another suitable user"],
  "featureRatings": {
    "camera": 8.5,
    "battery": 7.0,
    "performance": 9.0,
    "display": 8.0,
    "build": 8.5
  },
  "seriousComplaints": [
    { "issue": "Issue name", "severity": "high", "description": "Short description" }
  ]
}

Summaries:
"""
${summary}
"""`;

  console.log("allComments analyzed length:", allComments.length);

  let parsedAnalysis;
  try {
    parsedAnalysis = await generateJSON(prompt);
  } catch (err) {
    console.error("Failed to generate or parse AI JSON response:", err);
    parsedAnalysis = { error: "Failed to parse JSON" };
  }

  return {
    ...parsedAnalysis,
    productName,
  };
};

module.exports = {
  getCommentsAnalysis,
};
