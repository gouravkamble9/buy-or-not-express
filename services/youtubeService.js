const axios = require("axios");
const { generateText } = require("../config/aiClient");

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

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

  return await generateText(prompt);
};

module.exports = {
  searchVideos,
  fetchCommentsForVideo,
  summarizeProduct,
};
