const https = require("https");
const {
  fetchCsvContent,
  parseCsvContent,
  processRecords,
} = require("./csvHandler");
const {
  calculatePayoutsByTotal,
  updateEntryObjectsWithPayouts,
  updateFirstRoundLeaderPayouts,
} = require("./dataProcessor");

// Remove the global import of payoutStructure as we're now using year-specific ones

/**
 * Tournament IDs for different years
 */
const TOURNAMENT_IDS = {
  2024: "014", // 2024 Masters Tournament ID
  2025: "014", // 2025 Masters Tournament ID (assuming same ID, update if different)
};

/**
 * Fetches golf data for 2024 Masters (historical data)
 * Only needs to be called once at server startup
 */
async function fetchGolfData2024() {
  try {
    await fetchGolfDataForYear("2024");
  } catch (error) {
    console.error("Error fetching 2024 golf data:", error);
  }
}

/**
 * Fetches golf data for 2025 Masters (current data)
 * Should be called periodically during the tournament
 */
async function fetchGolfData2025() {
  try {
    await fetchGolfDataForYear("2025");
  } catch (error) {
    console.error("Error fetching 2025 golf data:", error);
  }
}

/**
 * Generic function to fetch golf data for a specific year
 * @param {string} year - Year to fetch data for (2024 or 2025)
 */
async function fetchGolfDataForYear(year) {
  // Reset global objects for this year
  global[`golfData${year}`] = {};
  global[`entryObjects${year}`] = [];

  try {
    // Fetch and parse CSV content
    const csvContent = await fetchCsvContent(year);
    const records = await parseCsvContent(csvContent);

    // Process records to create entry objects
    global[`entryObjects${year}`] = processRecords(records, year);

    // Fetch tournament data from API
    await fetchTournamentData(year);
  } catch (error) {
    console.error(`Error processing data for ${year}:`, error);
  }
}

/**
 * Fetches tournament data from the RapidAPI endpoint
 * @param {string} year - Year to fetch data for
 */
function fetchTournamentData(year) {
  return new Promise((resolve, reject) => {
    const tournId = TOURNAMENT_IDS[year];

    const options = {
      method: "GET",
      hostname: process.env.RAPIDAPI_HOST,
      path: `/leaderboard?orgId=1&tournId=${tournId}&year=${year}`,
      headers: {
        "X-RapidAPI-Key": process.env.RAPIDAPI_KEY,
        "X-RapidAPI-Host": process.env.RAPIDAPI_HOST,
      },
    };

    const request = https.request(options, (response) => {
      let data = "";

      response.on("data", (chunk) => {
        data += chunk;
      });

      response.on("end", () => {
        try {
          const parsedData = JSON.parse(data);

          if (Array.isArray(parsedData.leaderboardRows)) {
            // Update the global golf data first so it's available for first round leader calculations
            global[`golfData${year}`] = parsedData;

            // Calculate payouts based on the latest data
            const payouts = calculatePayoutsByTotal(
              parsedData.leaderboardRows,
              require(`../data/payoutStructure${year}`)
            );

            // Update the global entryObjects with these payouts
            // For 2025, this will also check for first round leaders if the data is available
            updateEntryObjectsWithPayouts(payouts, year);

            console.log(`Golf data for ${year} updated with payouts.`);
            resolve(parsedData);
          } else {
            const error = new Error(
              "leaderboardRows is missing or not an array"
            );
            console.error(error);
            reject(error);
          }
        } catch (error) {
          console.error(`Error parsing golf data for ${year}:`, error);
          reject(error);
        }
      });
    });

    request.on("error", (error) => {
      console.error(`Error fetching golf data for ${year}:`, error);
      reject(error);
    });

    request.end();
  });
}

module.exports = {
  fetchGolfData2024,
  fetchGolfData2025,
};
