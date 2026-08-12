const axios = require("axios");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

const searchVideos = async (query) => {
  const res = await axios.get("https://www.googleapis.com/youtube/v3/search", {
    params: {
      part: "snippet",
      q: query,
      type: "video",
      maxResults: 10,
      key: YOUTUBE_API_KEY,
    },
  });
  return res.data.items.map(item => item.id.videoId);
};

const fetchCommentsForVideo = async (videoId) => {
  let comments = [];
  let nextPageToken = "";

  do {
    const res = await axios.get("https://www.googleapis.com/youtube/v3/commentThreads", {
      params: {
        part: "snippet",
        videoId,
        maxResults: 100,
        pageToken: nextPageToken,
        textFormat: "plainText",
        key: YOUTUBE_API_KEY,
      },
    });

    res.data.items.forEach(item => {
      const text = item.snippet.topLevelComment.snippet.textDisplay;
      comments.push(text);
    });

    nextPageToken = res.data.nextPageToken;
  } while (nextPageToken && comments.length < 1000);

  return comments;
};

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
  "pros": ["Pro 1", "Pro 2", "Pro 3"],
  "cons": ["Con 1", "Con 2", "Con 3"],
  "confidenceScore": 8
}

Summaries:
"""
${summary}
"""`;

  console.log("allComments analyzed length:", allComments.length);

  const model = genAI.getGenerativeModel({
    model: "gemini-3.6-flash",
    generationConfig: { responseMimeType: "application/json" }
  });
  const result = await model.generateContent(prompt);
  const text = result.response.text();

  console.log("AI Response:\n", text);

  let parsedAnalysis;
  try {
    parsedAnalysis = JSON.parse(text);
  } catch (err) {
    console.error("Failed to parse AI JSON response:", err);
    parsedAnalysis = { error: "Failed to parse JSON", rawText: text };
  }

  return parsedAnalysis;
};

const summarizeProduct = async (productName, comments) => {
  const cleaned = comments
    .filter((c) => c.length > 20)
    .map((c) => c.replace(/\s+/g, " ").trim());

  const prompt = `
You are analyzing user reviews for a product: ${productName}.
Below are user comments. Summarize the most important insights.

Focus on:
- Top Pros
- Top Cons
- Common Complaints or Praise
- Feature mentions (Camera, Battery, Performance, Display, Build)

Comments:
"""
${cleaned.join("\n")}
"""`;

  console.log(`Summarizing ${cleaned.length} comments for ${productName} in a single request...`);

  const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });
  const result = await model.generateContent(prompt);
  return result.response.text();
};

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

  const model = genAI.getGenerativeModel({
    model: "gemini-3.6-flash",
    generationConfig: { responseMimeType: "application/json" }
  });
  const result = await model.generateContent(prompt);

  let parsedDecision;
  try {
    parsedDecision = JSON.parse(result.response.text());
  } catch (err) {
    console.error("Failed to parse AI JSON response:", err);
    parsedDecision = { error: "Failed to parse JSON", rawText: result.response.text() };
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

  console.log("Summary A:\n", summaryA);
  console.log("Summary B:\n", summaryB);
  console.log("Final Decision:\n", finalDecision);

  return {
    summaryA,
    summaryB,
    decision: finalDecision,
  };
};


module.exports = {
  getCommentsAnalysis,
  compareTwoProducts
};
