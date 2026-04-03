const express = require("express");
const router  = express.Router();
const { hasTournamentStarted, getTournamentConfig } = require("../utils/timingUtils");

/**
 * Active-year Masters pool data.
 * Before the tournament starts: returns a "not_started" status with the
 * configured start date so the frontend can show a countdown.
 * During/after: returns the live leaderboard data.
 *
 * Controlled by env vars:
 *   SHOW_NOT_STARTED_MESSAGE  "true" (default) / "false" to bypass for testing
 *   TOURNAMENT_START_DATE     used to populate the countdown response
 */
router.get("/", (req, res) => {
  const activeYear = process.env.ACTIVE_YEAR || "2026";
  const entryKey   = `entryObjects${activeYear}`;
  const showMsg    = (process.env.SHOW_NOT_STARTED_MESSAGE || "true") !== "false";

  if (showMsg && !hasTournamentStarted()) {
    const { startDate } = getTournamentConfig();
    return res.json({
      status:      "not_started",
      message:     `The ${activeYear} Masters Tournament has not started yet.`,
      startDate,
      lastUpdated: global.lastUpdatedActive
        ? global.lastUpdatedActive.toISOString()
        : null,
    });
  }

  if (global[entryKey] && global[entryKey].length > 0) {
    return res.json({
      status:      "active",
      data:        global[entryKey],
      lastUpdated: global.lastUpdatedActive
        ? global.lastUpdatedActive.toISOString()
        : null,
    });
  }

  res.status(503).send("Active year data is not available yet. Please try again later.");
});

module.exports = router;
