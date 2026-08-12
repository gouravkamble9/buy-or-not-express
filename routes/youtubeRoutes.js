const express = require("express");
const router = express.Router();
const { getProductInsight } = require("../controllers/youtubeController");
const { compareInsight } = require("../controllers/youtubeController");

router.post("/insight", getProductInsight);
router.post("/compare", compareInsight);


module.exports = router;
