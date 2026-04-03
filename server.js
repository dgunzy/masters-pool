require("dotenv").config();

const express = require("express");
const path    = require("path");
const app     = express();
const PORT    = process.env.PORT || 3000;

const { fetchGolfData2024, fetchGolfData2025, fetchGolfDataActive } = require("./utils/apiHandler");
const { determinePollInterval } = require("./utils/timingUtils");

const data2024Routes  = require("./routes/data2024");
const data2025Routes  = require("./routes/data2025");
const dataActiveRoutes = require("./routes/dataActive");

// ---------------------------------------------------------------------------
// Static files
// ---------------------------------------------------------------------------
app.use(express.static("public"));

// ---------------------------------------------------------------------------
// Global data stores
// ---------------------------------------------------------------------------
const activeYear = process.env.ACTIVE_YEAR || "2026";

global.golfData2024    = {};
global.entryObjects2024 = [];
global.golfData2025    = {};
global.entryObjects2025 = [];
global[`golfData${activeYear}`]     = {};
global[`entryObjects${activeYear}`] = [];
global.lastUpdatedActive = null;

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.use("/data/2024",   data2024Routes);
app.use("/data/2025",   data2025Routes);
app.use("/data/active", dataActiveRoutes);

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ---------------------------------------------------------------------------
// Initialisation
// ---------------------------------------------------------------------------
async function initializeApp() {
  try {
    // Historical years — load once at startup, never polled again
    await fetchGolfData2024();
    console.log("2024 data loaded");

    await fetchGolfData2025();
    console.log("2025 data loaded");

    // Active year — load now then schedule dynamic polling
    await fetchGolfDataActive();
    console.log(`${activeYear} (active) data loaded`);

    scheduleNextUpdate();
  } catch (error) {
    console.error("Error during initialisation:", error);
  }
}

function scheduleNextUpdate() {
  const interval = determinePollInterval();
  console.log(`Next active-year update in ${interval / 60000} min`);

  setTimeout(async () => {
    try {
      await fetchGolfDataActive();
    } catch (error) {
      console.error("Error updating active year data:", error);
    }
    scheduleNextUpdate();
  }, interval);
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} | Active year: ${activeYear}`);
  initializeApp();
});
