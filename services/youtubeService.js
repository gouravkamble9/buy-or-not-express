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
  let allComments = [];

  for (const videoId of videoIds) {
    const comments = await fetchCommentsForVideo(videoId);
    allComments.push(...comments);
  }

  const prompt = `You are an assistant that gives product buying advice. Analyze these YouTube comments and tell if the product is worth buying. Give:
- A recommendation (Buy / Skip / Neutral)
- Top 3 Pros
- Top 3 Cons
- Confidence Score (1-10)

Comments:
"""
${allComments.join("\n")}
"""`;


  console.log("allComments:", allComments.length);

  const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });
  const result = await model.generateContent(prompt);
  const text = result.response.text();

  console.log("AI Response:\n", text);

  return { analysis: text };
};

// const compareTwoProducts = async (productA, productB) => {
//   const videoIdsA = await searchVideos(`${productA} review`);
//   const videoIdsB = await searchVideos(`${productB} review`);

//   let commentsA = [], commentsB = [];

//   for (const id of videoIdsA) {
//     const comments = await fetchCommentsForVideo(id);
//     commentsA.push(...comments);
//   }
//   console.log("commentsA:", commentsA.length);
//   for (const id of videoIdsB) {
//     const comments = await fetchCommentsForVideo(id);
//     commentsB.push(...comments);
//   }
//   console.log("commentsB:", commentsB.length);

//   // Limit and clean
//   const clean = (arr) => arr.filter(c => c.length > 20).slice(0, 400);
//   const commentsAJoined = clean(commentsA).join("\n");
//   const commentsBJoined = clean(commentsB).join("\n");

//   const prompt = `
// You are a product decision assistant. You will be given YouTube user comments for two products.

// Your job is to:
// 1. Analyze the pros and cons based ONLY on the comments
// 2. Compare key features: 📷 Camera, 🔋 Battery, ⚡ Performance, 📱 Display, 🔧 Build
// 3. Give a **final decision**: Which product should the user buy and why?

// Rules:
// - Be confident.
// - Do not say “it depends”.
// - Choose **only one** product as the better option for most people.
// - At the end, write: "✅ You should buy: [PRODUCT NAME]"

// ---

// 📦 Product A: ${productA}
// Comments:
// """
// ${commentsAJoined}
// """

// 📦 Product B: ${productB}
// Comments:
// """
// ${commentsBJoined}
// """
// `;
//   console.log("commentsA:", commentsA.length, "commentsB:", commentsB.length);
//   const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
//   const result = await model.generateContent(prompt);
//   const text = result.response.text();
//   console.log("AI Response:\n", text);
//   return { comparison: text };
// };

const chunkArray = (arr, size) => {
  const result = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
};

const summarizeChunk = async (commentsChunk, productName, chunkIndex) => {
  const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });
  const prompt = `
You are analyzing user reviews for a product: ${productName}.
Below are user comments. Summarize the most important insights.

Focus on:
- Top Pros
- Top Cons
- Common Complaints or Praise
- Feature mentions (Camera, Battery, Performance, Display, Build)

Comments (Chunk ${chunkIndex}):
"""
${commentsChunk.join("\n")}
"""`;

  const result = await model.generateContent(prompt);
  return result.response.text();
};

const summarizeProduct = async (productName, comments) => {
  const cleaned = comments
    .filter((c) => c.length > 20)
    .map((c) => c.replace(/\s+/g, " ").trim());

  const chunks = chunkArray(cleaned, 500);
  const summaries = [];

  for (let i = 0; i < chunks.length; i++) {
    console.log(`Summarizing chunk ${i + 1} of ${chunks.length} for ${productName}...`);
    const summary = await summarizeChunk(chunks[i], productName, i + 1);
    summaries.push(summary);
  }

  return summaries.join("\n\n");
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
  const videoIdsA = await searchVideos(`${productA} review`);
  const videoIdsB = await searchVideos(`${productB} review`);

  let commentsA = [];
  let commentsB = [];

  for (const id of videoIdsA) {
    const comments = await fetchCommentsForVideo(id);
    commentsA.push(...comments);
  }

  for (const id of videoIdsB) {
    const comments = await fetchCommentsForVideo(id);
    commentsB.push(...comments);
  }

  commentsA = commentsA.slice(0, 5000);
  commentsB = commentsB.slice(0, 5000);

  const summaryA = await summarizeProduct(productA, commentsA);
  const summaryB = await summarizeProduct(productB, commentsB);

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
