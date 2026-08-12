const { generateJSON } = require("../config/aiClient");
const { searchVideos, fetchCommentsForVideo, summarizeProduct } = require("./youtubeService");

const compareSummaries = async (summaryA, summaryB, productA, productB) => {
  const prompt = `
  You are an expert product comparison and buying advisor.

Your task is to compare two products using ONLY the information provided in their summaries.

IMPORTANT RULES:
- Do not invent specifications, features, prices, or facts.
- Base your decision only on the provided summaries.
- Compare both products fairly.
- Choose exactly ONE overall winner.
- A category winner can be "Tie" if the evidence is genuinely equal.
- Keep explanations concise and useful for a buyer.
- Do not use Markdown.
- Return ONLY valid JSON.
- Do not wrap the JSON in \`\`\`json or any other code fence.

PRODUCT A:
${productA}

SUMMARY A:
${summaryA}

---

PRODUCT B:
${productB}

SUMMARY B:
${summaryB}

Return JSON with exactly this structure:

{
  "winner": "Product Name",
  "confidence": 8.5,
  "reason": "Short explanation of why this product is the better overall choice.",

  "comparison": {
    "camera": {
      "winner": "Product Name or Tie",
      "scoreA": 8.5,
      "scoreB": 9.0,
      "summary": "Short comparison of camera capabilities, strengths and weaknesses."
    },

    "battery": {
      "winner": "Product Name or Tie",
      "scoreA": 8.0,
      "scoreB": 8.5,
      "summary": "Short comparison of battery life and charging."
    },

    "performance": {
      "winner": "Product Name or Tie",
      "scoreA": 9.0,
      "scoreB": 9.0,
      "summary": "Short comparison of performance."
    },

    "display": {
      "winner": "Product Name or Tie",
      "scoreA": 7.0,
      "scoreB": 9.5,
      "summary": "Short comparison of display quality and user experience."
    },

    "build": {
      "winner": "Product Name or Tie",
      "scoreA": 8.5,
      "scoreB": 9.0,
      "summary": "Short comparison of build quality, design and ergonomics."
    }
  },

  "products": {
    "productA": {
      "pros": [
        "Top advantage",
        "Second advantage",
        "Third advantage"
      ],
      "cons": [
        "Top disadvantage",
        "Second disadvantage",
        "Third disadvantage"
      ],
      "bestFor": [
        "Type of user who should buy this product",
        "Another suitable user"
      ]
    },

    "productB": {
      "pros": [
        "Top advantage",
        "Second advantage",
        "Third advantage"
      ],
      "cons": [
        "Top disadvantage",
        "Second disadvantage",
        "Third disadvantage"
      ],
      "bestFor": [
        "Type of user who should buy this product",
        "Another suitable user"
      ]
    }
  },

  "seriousComplaints": {
    "productA": [
      {
        "issue": "Issue name",
        "severity": "high",
        "description": "Short description"
      }
    ],

    "productB": [
      {
        "issue": "Issue name",
        "severity": "medium",
        "description": "Short description"
      }
    ]
  }
}
`;

  let parsedDecision;
  try {
    parsedDecision = await generateJSON(prompt);
  } catch (err) {
    console.error("Failed to generate or parse AI JSON response:", err);
    parsedDecision = { error: "Failed to parse JSON" };
  }
  return parsedDecision;
};

const compareTwoProducts = async (productA, productB) => {
  // Run searches concurrently
  const [videoIdsA, videoIdsB] = await Promise.all([
    searchVideos(`${productA} review`),
    searchVideos(`${productB} review`)
  ]);

  const fetchAllComments = async (videoIds) => {
    const arrays = await Promise.all(videoIds.map(id => fetchCommentsForVideo(id)));
    return arrays.flat().slice(0, 5000);
  };

  // Fetch all comments for both products concurrently
  const [commentsA, commentsB] = await Promise.all([
    fetchAllComments(videoIdsA),
    fetchAllComments(videoIdsB)
  ]);

  // Summarize both products concurrently
  const [summaryA, summaryB] = await Promise.all([
    summarizeProduct(productA, commentsA),
    summarizeProduct(productB, commentsB)
  ]);

  const finalDecision = await compareSummaries(summaryA, summaryB, productA, productB);

  return {
    finalDecision,
  };
};

module.exports = {
  compareTwoProducts,
};
