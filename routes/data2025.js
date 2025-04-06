const express = require("express");
const router = express.Router();

/**
 * Route to fetch 2025 Masters pool data
 */
router.get("/", (req, res) => {
  if (global.entryObjects2025 && global.entryObjects2025.length > 0) {
    res.json(global.entryObjects2025);
  } else {
    res
      .status(503)
      .send("2025 Golf data is not available yet. Please try again later.");
  }
});

module.exports = router;
