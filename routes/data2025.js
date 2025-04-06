const express = require("express");
const router = express.Router();
const { hasTournamentStarted } = require("../utils/timingUtils");

/**
 * Route to fetch 2025 Masters pool data
 */
router.get("/", (req, res) => {
  // Check if we should show the "not started" message
  // Set this to false for development/testing
  const SHOW_NOT_STARTED_MESSAGE = true;

  if (SHOW_NOT_STARTED_MESSAGE && !hasTournamentStarted()) {
    // Return "not started" status with tournament dates
    res.json({
      status: "not_started",
      message: "The 2025 Masters Tournament has not started yet.",
      startDate: "2025-04-10",
      lastUpdated: global.lastUpdated2025
        ? global.lastUpdated2025.toISOString()
        : null,
    });
  } else if (global.entryObjects2025 && global.entryObjects2025.length > 0) {
    // Tournament has started or we're in development mode, return the data
    // Always return the in-memory data, regardless of when it was last updated
    res.json({
      status: "active",
      data: global.entryObjects2025,
      lastUpdated: global.lastUpdated2025
        ? global.lastUpdated2025.toISOString()
        : null,
    });
  } else {
    // No data available
    res
      .status(503)
      .send("2025 Golf data is not available yet. Please try again later.");
  }
});

module.exports = router;
