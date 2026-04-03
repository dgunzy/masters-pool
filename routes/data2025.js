const express = require("express");
const router  = express.Router();

/**
 * Historical 2025 Masters pool data.
 * Tournament is complete — data is loaded once at startup and never changes.
 */
router.get("/", (req, res) => {
  if (global.entryObjects2025 && global.entryObjects2025.length > 0) {
    res.json(global.entryObjects2025);
  } else {
    res.status(503).send("2025 data is not available yet. Please try again later.");
  }
});

module.exports = router;
