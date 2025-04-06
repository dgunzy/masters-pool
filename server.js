const express = require("express");
const path = require("path");
const app = express();
const PORT = process.env.PORT || 3000;
require("dotenv").config();

// Import utility modules
const { fetchGolfData2024, fetchGolfData2025 } = require("./utils/apiHandler");
const data2024Routes = require("./routes/data2024");
const data2025Routes = require("./routes/data2025");
const fs = require("fs").promises;
const {
  determinePollInterval,
  hasTournamentStarted,
} = require("./utils/timingUtils");
// Serve static files from the public directory
app.use(express.static("public"));

// Global data stores for both years
global.golfData2024 = {};
global.entryObjects2024 = [];
global.golfData2025 = {};
global.entryObjects2025 = [];
global.lastUpdated2025 = null;

// Use route handlers
app.use("/data/2024", data2024Routes);
app.use("/data/2025", data2025Routes);

// Redirect root to index
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

/**
 * The application uses separate payout structures for each year:
 * - data/payoutStructure2024.js: Contains the 2024 Masters Tournament payout structure
 * - data/payoutStructure2025.js: Contains the 2025 Masters Tournament payout structure (currently a copy of 2024)
 *
 * To modify the payouts for 2025, edit the payoutStructure2025.js file.
 */

// Initialize the application by loading initial data
async function initializeApp() {
  try {
    // Load 2024 data only once at startup (since it doesn't change)
    await fetchGolfData2024();
    console.log("2024 Golf data loaded successfully");

    // Load initial 2025 data
    await fetchGolfData2025();
    console.log("2025 Golf data loaded successfully");

    // Setup dynamic interval for 2025 data (active tournament)
    scheduleNextUpdate();
  } catch (error) {
    console.error("Error initializing application:", error);
  }
}

// Function to schedule the next update based on tournament timing
function scheduleNextUpdate() {
  const interval = determinePollInterval();

  console.log(`Next 2025 data update scheduled in ${interval / 60000} minutes`);

  setTimeout(async () => {
    try {
      await fetchGolfData2025();
      console.log("2025 Golf data updated successfully");
    } catch (error) {
      console.error("Error updating 2025 golf data:", error);
    }

    // Schedule the next update
    scheduleNextUpdate();
  }, interval);
}
// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  initializeApp();
});
