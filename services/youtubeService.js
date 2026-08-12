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

  const prompt = `You are an assistant that gives product buying advice. Analyze these YouTube comment summaries and tell if the product is worth buying. Give:
- A recommendation (Buy / Skip / Neutral)
- Top 3 Pros
- Top 3 Cons
- Confidence Score (1-10)

Summaries:
"""
${summary}
"""`;

  console.log("allComments analyzed length:", allComments.length);

  const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });
  const result = await model.generateContent(prompt);
  const text = result.response.text();

  console.log("AI Response:\n", text);

  return { analysis: text };
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
You are a product recommendation expert.
Compare these two product summaries and make a final decision on which product is better overall.

Focus on:
- Camera
- Battery
- Performance
- Display
- Build
- Any serious complaints

Only choose one product as the better choice. End with:
✅ You should buy: [Product Name]

---
📦 Product A: ${productA}
Summary:
${summaryA}

---
📦 Product B: ${productB}
Summary:
${summaryB}
`;

  const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });
  const result = await model.generateContent(prompt);
  return result.response.text();
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
