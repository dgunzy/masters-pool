const express = require("express");
const router = express.Router();

/**
 * Route to fetch 2024 Masters pool data
 */
router.get("/", (req, res) => {
  if (global.entryObjects2024 && global.entryObjects2024.length > 0) {
    res.json(global.entryObjects2024);
  } else {
    res
      .status(503)
      .send("2024 Golf data is not available yet. Please try again later.");
  }
});

module.exports = router;
