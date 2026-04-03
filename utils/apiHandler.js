const https = require("https");
const fs    = require("fs");
const {
  fetchCsvContent,
  fetchCsvContentFromPath,
  parseCsvContent,
  processRecords,
} = require("./csvHandler");
const {
  calculatePayoutsByTotal,
  updateEntryObjectsWithPayouts,
} = require("./dataProcessor");

// ---------------------------------------------------------------------------
// Historical years (bundled CSV + JS payout structures in image)
// ---------------------------------------------------------------------------

async function fetchGolfData2024() {
  return _fetchHistoricalYear("2024");
}

async function fetchGolfData2025() {
  return _fetchHistoricalYear("2025");
}

async function _fetchHistoricalYear(year) {
  try {
    global[`golfData${year}`]    = {};
    global[`entryObjects${year}`] = [];

    const csvContent = await fetchCsvContent(year);
    const records    = await parseCsvContent(csvContent);
    global[`entryObjects${year}`] = processRecords(records);

    await _fetchTournamentData(year, _loadBundledPayouts(year));
    console.log(`${year} golf data loaded.`);
  } catch (error) {
    console.error(`Error loading ${year} data:`, error);
  }
}

function _loadBundledPayouts(year) {
  return require(`../data/payoutStructure${year}`);
}

// ---------------------------------------------------------------------------
// Active year (CSV + payout structure come from mounted ConfigMap volume)
// ---------------------------------------------------------------------------

async function fetchGolfDataActive() {
  const year = process.env.ACTIVE_YEAR || "2026";
  try {
    global[`golfData${year}`]    = {};
    global[`entryObjects${year}`] = [];

    const csvPath = process.env.CSV_PATH;
    if (!csvPath) {
      throw new Error("CSV_PATH env var is not set — cannot load active year entries");
    }

    const csvContent = await fetchCsvContentFromPath(csvPath);
    const records    = await parseCsvContent(csvContent);
    global[`entryObjects${year}`] = processRecords(records);

    const payoutStructure = _loadActivePayouts();
    await _fetchTournamentData(year, payoutStructure);

    global[`lastUpdatedActive`] = new Date();
    console.log(`Active year (${year}) golf data updated at ${global.lastUpdatedActive}`);
  } catch (error) {
    console.error(`Error fetching active year (${year}) data:`, error);
  }
}

function _loadActivePayouts() {
  const payoutPath = process.env.PAYOUT_STRUCTURE_PATH;
  if (payoutPath && fs.existsSync(payoutPath)) {
    try {
      return JSON.parse(fs.readFileSync(payoutPath, "utf-8"));
    } catch (err) {
      console.error("Failed to parse PAYOUT_STRUCTURE_PATH JSON:", err);
    }
  }
  // Fallback: use previous year's structure if the file isn't mounted yet.
  // Remove this fallback once the ConfigMap is populated.
  console.warn("PAYOUT_STRUCTURE_PATH not set or unreadable — falling back to 2025 payout structure");
  return require("../data/payoutStructure2025");
}

// ---------------------------------------------------------------------------
// Shared: hit the RapidAPI leaderboard and feed the result into dataProcessor
// ---------------------------------------------------------------------------

function _fetchTournamentData(year, payoutStructure) {
  return new Promise((resolve, reject) => {
    const tournId = process.env.TOURNAMENT_ID || "014";

    const options = {
      method: "GET",
      hostname: process.env.RAPIDAPI_HOST,
      path: `/leaderboard?orgId=1&tournId=${tournId}&year=${year}`,
      headers: {
        "X-RapidAPI-Key":  process.env.RAPIDAPI_KEY,
        "X-RapidAPI-Host": process.env.RAPIDAPI_HOST,
      },
    };

    const request = https.request(options, (response) => {
      let data = "";
      response.on("data", (chunk) => { data += chunk; });
      response.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (!Array.isArray(parsed.leaderboardRows)) {
            // API returns {"detail": "leaderboards not found..."} before tournament starts — not an error
            if (parsed.detail && parsed.detail.includes("not found")) {
              console.log(`[${year}] Leaderboard not available yet (pre-tournament)`);
              return resolve(null);
            }
            return reject(new Error("leaderboardRows missing or not an array"));
          }
          global[`golfData${year}`] = parsed;
          const payouts = calculatePayoutsByTotal(parsed.leaderboardRows, payoutStructure);
          updateEntryObjectsWithPayouts(payouts, year);
          console.log(`Golf data for ${year} updated with payouts.`);
          resolve(parsed);
        } catch (err) {
          console.error(`Error parsing golf data for ${year}:`, err);
          reject(err);
        }
      });
    });

    request.on("error", (err) => {
      console.error(`Network error fetching ${year} data:`, err);
      reject(err);
    });

    request.end();
  });
}

module.exports = {
  fetchGolfData2024,
  fetchGolfData2025,
  fetchGolfDataActive,
};
