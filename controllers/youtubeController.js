const { getCommentsAnalysis } = require("../services/productInsightService");
const { compareTwoProducts } = require("../services/compareService");

exports.getProductInsight = async (req, res) => {
  const { productName } = req.body;
  if (!productName) return res.status(400).json({ error: "Missing productName" });

  try {
    console.log("Analyzing product:", productName);
    const insight = await getCommentsAnalysis(productName);
    res.json(insight);
  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({ error: "Failed to analyze product" });
  }
};

exports.compareInsight = async (req, res) => {
  const { productA, productB } = req.body;
  if (!productA || !productB) {
    return res.status(400).json({ error: "Both productA and productB are required." });
  }

  try {
    const comparison = await compareTwoProducts(productA, productB);
    res.json(comparison);
  } catch (err) {
    console.error("Comparison error:", err.message);
    res.status(500).json({ error: "Comparison failed." });
  }
};
