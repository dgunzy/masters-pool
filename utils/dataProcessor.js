const {
  calculatePlayerOwnership,
  createPlayerDataMap,
  enhanceEntriesWithPlayerData,
} = require("./playerUtils");

// ---------------------------------------------------------------------------
// Active-year configuration — all values come from env vars so you can tweak
// them via a single PR to the gitops deployment manifest.
// ---------------------------------------------------------------------------

function getActiveConfig() {
  const mutGroup    = parseInt(process.env.MUTT_GROUP     || "9");
  const oldMutGroup = parseInt(process.env.OLD_MUTT_GROUP || "10");
  const mutMult     = parseFloat(process.env.MUTT_MULTIPLIER     || "2");
  const oldMutMult  = parseFloat(process.env.OLD_MUTT_MULTIPLIER || "3");

  // Comma-separated positions → amounts, e.g. "4475,2640,1920,1115"
  const poolPayoutsRaw = (process.env.POOL_PAYOUTS || "4475,2640,1920,1115")
    .split(",")
    .map((v) => parseInt(v.trim(), 10));
  const poolPayouts = {};
  poolPayoutsRaw.forEach((amount, i) => {
    poolPayouts[i + 1] = amount;
  });

  const frlWinner = (process.env.FIRST_ROUND_LEADER_WINNER || "").toLowerCase();
  const frlPayout = parseInt(process.env.FIRST_ROUND_LEADER_PAYOUT || "500000");

  const playoffWinner   = (process.env.PLAYOFF_WINNER    || "").toLowerCase();
  const playoffRunnerUp = (process.env.PLAYOFF_RUNNER_UP || "").toLowerCase();

  return { mutGroup, oldMutGroup, mutMult, oldMutMult, poolPayouts, frlWinner, frlPayout, playoffWinner, playoffRunnerUp };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Attaches tournament payouts to every entry in global.entryObjects<year>
 * and applies year-specific special rules.
 * @param {Object} payouts - map of "First Last" → payout amount
 * @param {string} year    - "2024", "2025", or the active year string
 */
function updateEntryObjectsWithPayouts(payouts, year) {
  const activeYear = process.env.ACTIVE_YEAR || "2026";

  global[`entryObjects${year}`].forEach((entry) => {
    Object.keys(entry).forEach((group) => {
      const isPickGroup =
        group.startsWith("Group") ||
        group === "Mutt"          ||
        group === "Old Mutt"      ||
        group === "Champion Mutt" ||
        group === "WC"            ||
        group === "1RL";

      if (isPickGroup && !group.includes("Payout") && !group.includes("_data")) {
        const golferName = entry[group] ? entry[group].toLowerCase() : "";
        if (golferName) {
          matchGolferAndAssignPayout(golferName, group, entry, payouts);
        }
      }
    });
  });

  // Enhance player data for the active year (live scores + ownership)
  if (year === activeYear) {
    enhancePlayerData(year);
  }

  adjustValuesAndCalculateTotal(year);
}

/**
 * Attaches live score/ownership data to each entry's player slots.
 * Only called for the active (polled) year.
 */
function enhancePlayerData(year) {
  const leaderboardData = global[`golfData${year}`];
  if (!leaderboardData || !leaderboardData.leaderboardRows) return;

  const ownershipPercentages = calculatePlayerOwnership(global[`entryObjects${year}`]);
  const playerDataMap        = createPlayerDataMap(leaderboardData.leaderboardRows);

  global[`entryObjects${year}`] = enhanceEntriesWithPlayerData(
    global[`entryObjects${year}`],
    playerDataMap,
    ownershipPercentages
  );
}

// ---------------------------------------------------------------------------
// Payout calculation
// ---------------------------------------------------------------------------

/**
 * Calculates per-player payouts from the sorted leaderboard.
 * Handles ties by averaging the affected positions.
 */
function calculatePayoutsByTotal(leaderboardRows, payoutStructure) {
  const activePlayers     = leaderboardRows.filter((p) => p.status !== "cut");
  const sortedLeaderboard = [...activePlayers].sort(
    (a, b) => parseFloat(a.total) - parseFloat(b.total)
  );

  const payouts = {};
  let lastTotal = null;
  let processed = 0;
  let tieBuffer = [];

  sortedLeaderboard.forEach((player, index) => {
    const total      = player.total;
    const playerName = `${player.firstName} ${player.lastName}`;

    if (total === lastTotal) {
      tieBuffer.push(playerName);
    } else {
      if (tieBuffer.length > 0) {
        distributeTiePayout(tieBuffer, processed - tieBuffer.length, payoutStructure, payouts);
        tieBuffer = [];
      }
      payouts[playerName] = payoutStructure[(processed + 1).toString()] || 0;
      lastTotal = total;
      tieBuffer.push(playerName);
    }

    processed++;

    if (index === sortedLeaderboard.length - 1 && tieBuffer.length > 0) {
      distributeTiePayout(tieBuffer, processed - tieBuffer.length, payoutStructure, payouts);
    }
  });

  // Optional playoff override
  const { playoffWinner, playoffRunnerUp } = getActiveConfig();
  if (playoffWinner && playoffRunnerUp) {
    Object.keys(payouts).forEach((name) => {
      const lower = name.toLowerCase();
      if (lower.includes(playoffWinner)) {
        payouts[name] = payoutStructure["1"];
      } else if (lower.includes(playoffRunnerUp)) {
        payouts[name] = payoutStructure["2"];
      }
    });
  }

  return payouts;
}

// ---------------------------------------------------------------------------
// Special-rules and total calculation
// ---------------------------------------------------------------------------

/**
 * Applies year-specific multiplier rules and calculates each entry's total.
 *
 * KEY FIX: For the active year, Pool Payout is intentionally excluded from
 * Total Payout. This keeps the server sort and frontend sort perfectly in sync.
 * The frontend adds Pool Payout back in for display purposes only.
 *
 * For 2025 (frozen), Pool Payout IS included in Total Payout to preserve
 * historical display behaviour.
 */
function adjustValuesAndCalculateTotal(year) {
  const activeYear = process.env.ACTIVE_YEAR || "2026";

  // ── 2024 (frozen) ────────────────────────────────────────────────────────
  if (year === "2024") {
    global[`entryObjects${year}`].forEach((entry) => {
      let totalPayout = 0;
      Object.keys(entry).forEach((group) => {
        if (group === "1RL Payout") {
          entry[group] = entry["1RL"] && entry["1RL"].toLowerCase().includes("dechambeau")
            ? 500000 : 0;
        } else if (group === "Mutt Payout" || group === "Old Mutt Payout") {
          entry[group] = (entry[group] || 0) * 2;
        }
        if (group.endsWith("Payout")) totalPayout += entry[group] || 0;
      });
      entry["Total Payout"] = totalPayout;
    });
    return;
  }

  // ── 2025 (frozen) ────────────────────────────────────────────────────────
  if (year === "2025") {
    // Sort first so pool positions are correct
    global[`entryObjects${year}`].sort((a, b) => calculateRawTotal(b) - calculateRawTotal(a));

    const poolPayouts2025 = require("../data/poolPayouts2025");
    global[`entryObjects${year}`].forEach((entry, index) => {
      let totalPayout = 0;
      Object.keys(entry).forEach((group) => {
        if (group === "1RL Payout") {
          entry[group] = entry["1RL"] && entry["1RL"].toLowerCase().includes("rose")
            ? 500000 : 0;
        } else if (group === "Group 9 (M) Payout") {
          entry[group] = (entry[group] || 0) * 2;
        } else if (group === "Group 10 (OM) Payout") {
          entry[group] = (entry[group] || 0) * 3;
        }
        if (group.endsWith("Payout")) totalPayout += entry[group] || 0;
      });
      entry["Pool Payout"]  = poolPayouts2025[index + 1] || 0;
      entry["Total Payout"] = totalPayout + entry["Pool Payout"];
    });
    return;
  }

  // ── Active year ───────────────────────────────────────────────────────────
  //
  // TWO-PASS APPROACH:
  //
  // Pass 1 — apply multipliers, calculate Total Payout (tournament earnings only,
  //           no Pool Payout). Pool Payout is reset to 0 so it can't bleed into
  //           the sort.
  //
  // Pass 2 — sort by Total Payout descending, then assign Pool Payout by
  //           position. Pool Payout is kept separate so the sort is stable and
  //           the frontend doesn't need to subtract anything.
  //
  const { mutGroup, oldMutGroup, mutMult, oldMutMult, poolPayouts, frlWinner, frlPayout } =
    getActiveConfig();

  // Pass 1: tournament earnings
  global[`entryObjects${year}`].forEach((entry) => {
    let totalPayout = 0;

    Object.keys(entry).forEach((group) => {
      if (group === "Pool Payout") {
        entry[group] = 0; // clear from any previous run
        return;
      }

      if (group === "1RL Payout") {
        entry[group] =
          frlWinner && entry["1RL"] && entry["1RL"].toLowerCase().includes(frlWinner)
            ? frlPayout
            : 0;
      } else if (group.endsWith(" Payout") && group !== "1RL Payout") {
        const groupNumMatch = group.match(/Group\s+(\d+)/i);
        if (groupNumMatch) {
          const groupNum = parseInt(groupNumMatch[1]);
          if (groupNum === mutGroup) {
            entry[group] = (entry[group] || 0) * mutMult;
          } else if (groupNum === oldMutGroup) {
            entry[group] = (entry[group] || 0) * oldMutMult;
          }
        } else if (group === "Mutt Payout") {
          entry[group] = (entry[group] || 0) * mutMult;
        } else if (group === "Champion Mutt Payout" || group === "Old Mutt Payout") {
          entry[group] = (entry[group] || 0) * oldMutMult;
        }
      }

      // Accumulate — exclude Pool Payout from Total Payout
      if (group.endsWith("Payout") && group !== "Pool Payout") {
        totalPayout += entry[group] || 0;
      }
    });

    entry["Total Payout"] = totalPayout;
  });

  // Pass 2: stable sort → assign pool position payouts
  global[`entryObjects${year}`].sort((a, b) => b["Total Payout"] - a["Total Payout"]);
  global[`entryObjects${year}`].forEach((entry, index) => {
    entry["Pool Payout"] = poolPayouts[index + 1] || 0;
    // NOTE: Total Payout intentionally does NOT include Pool Payout.
    // The frontend sums them for display: entry["Total Payout"] + entry["Pool Payout"]
  });
}

// ---------------------------------------------------------------------------
// Name matching
// ---------------------------------------------------------------------------

function matchGolferAndAssignPayout(golferName, group, entry, payouts) {
  let payoutName = null;

  if (golferName.includes("højgaard") || golferName.includes("hojgaard")) {
    const isNicolai = golferName.includes("nicolai");
    const isRasmus  = golferName.includes("rasmus");
    payoutName = Object.keys(payouts).find((key) => {
      const k = key.toLowerCase();
      if (!k.includes("højgaard") && !k.includes("hojgaard")) return false;
      if (isNicolai) return k.includes("nicolai");
      if (isRasmus)  return k.includes("rasmus");
      return true;
    });

  } else if (golferName === "scott") {
    payoutName = Object.keys(payouts).find((k) => k.toLowerCase().includes("adam scott"));

  } else if (golferName === "scheffler") {
    payoutName = Object.keys(payouts).find((k) =>
      k.toLowerCase().includes("scottie scheffler") ||
      k.toLowerCase().includes("scotty scheffler")
    );

  } else if (golferName === "kim") {
    const siWooKim   = Object.keys(payouts).find((k) => k.toLowerCase().includes("si woo kim"));
    const tomKim     = Object.keys(payouts).find((k) => k.toLowerCase().includes("tom kim"));
    const michaelKim = Object.keys(payouts).find((k) => k.toLowerCase().includes("michael kim"));
    payoutName = siWooKim || tomKim || michaelKim;

  } else {
    payoutName = Object.keys(payouts).find((key) => {
      const k = key.toLowerCase();
      return (
        k === golferName ||
        k.includes(" " + golferName + " ") ||
        k.startsWith(golferName + " ") ||
        k.endsWith(" " + golferName)
      );
    });

    if (!payoutName) {
      payoutName = Object.keys(payouts).find(
        (key) =>
          key.toLowerCase().includes(golferName) ||
          golferName.includes(key.toLowerCase())
      );
    }
  }

  if (payoutName) {
    entry[group + " Payout"] = payouts[payoutName];
  }
}

// ---------------------------------------------------------------------------
// Tie distribution
// ---------------------------------------------------------------------------

function distributeTiePayout(tieBuffer, startIndex, payoutStructure, payouts) {
  const total = tieBuffer.reduce((sum, _, i) => {
    return sum + (payoutStructure[(startIndex + i + 1).toString()] || 0);
  }, 0);
  const avg = total / tieBuffer.length;
  tieBuffer.forEach((name) => { payouts[name] = avg; });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Raw total before pool-position payout is added, used for sorting. */
function calculateRawTotal(entry) {
  let total = 0;
  Object.keys(entry).forEach((key) => {
    if (key.endsWith("Payout") && key !== "Pool Payout") {
      total += entry[key] || 0;
    }
  });
  return total;
}

module.exports = {
  updateEntryObjectsWithPayouts,
  calculatePayoutsByTotal,
  adjustValuesAndCalculateTotal,
  enhancePlayerData,
};
