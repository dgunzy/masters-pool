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

  // Optional playoff override — set both to re-split payouts after a playoff.
  // Leave empty (default) for no override.
  const playoffWinner    = (process.env.PLAYOFF_WINNER     || "").toLowerCase();
  const playoffRunnerUp  = (process.env.PLAYOFF_RUNNER_UP  || "").toLowerCase();

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
        group === "Mutt"          ||  // 2024 named groups
        group === "Old Mutt"      ||
        group === "Champion Mutt" ||  // 2026 name for the ×3 former-champion group
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
 * Optionally applies a playoff override via PLAYOFF_WINNER / PLAYOFF_RUNNER_UP.
 *
 * @param {Array}  leaderboardRows
 * @param {Object} payoutStructure - map of "1" → amount, "2" → amount, …
 * @returns {Object} map of "First Last" → payout amount
 */
function calculatePayoutsByTotal(leaderboardRows, payoutStructure) {
  const activePlayers   = leaderboardRows.filter((p) => p.status !== "cut");
  const sortedLeaderboard = [...activePlayers].sort(
    (a, b) => parseFloat(a.total) - parseFloat(b.total)
  );

  const payouts = {};
  let lastTotal  = null;
  let processed  = 0;
  let tieBuffer  = [];

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

  // Optional playoff override: re-assign 1st/2nd place payouts when a
  // playoff occurred that the leaderboard API doesn't reflect correctly.
  // Set PLAYOFF_WINNER and PLAYOFF_RUNNER_UP env vars (lowercase surnames ok).
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
 * Historical years (2024, 2025) use their original hardcoded rules.
 * The active year uses env-var-driven config.
 */
function adjustValuesAndCalculateTotal(year) {
  const activeYear = process.env.ACTIVE_YEAR || "2026";

  // Sort by total before assigning pool-position payouts
  if (year === activeYear || year === "2025") {
    global[`entryObjects${year}`].sort((a, b) => {
      return calculateRawTotal(b) - calculateRawTotal(a);
    });
  }

  global[`entryObjects${year}`].forEach((entry, index) => {
    let totalPayout = 0;

    if (year === "2024") {
      // ── 2024 rules (frozen) ──────────────────────────────────────────────
      Object.keys(entry).forEach((group) => {
        if (group === "1RL Payout") {
          entry[group] = entry["1RL"] && entry["1RL"].toLowerCase().includes("dechambeau")
            ? 500000
            : 0;
        } else if (group === "Mutt Payout" || group === "Old Mutt Payout") {
          entry[group] = (entry[group] || 0) * 2;
        }
        if (group.endsWith("Payout")) totalPayout += entry[group] || 0;
      });

    } else if (year === "2025") {
      // ── 2025 rules (frozen) ──────────────────────────────────────────────
      Object.keys(entry).forEach((group) => {
        if (group === "1RL Payout") {
          entry[group] = entry["1RL"] && entry["1RL"].toLowerCase().includes("rose")
            ? 500000
            : 0;
        } else if (group === "Group 9 (M) Payout") {
          entry[group] = (entry[group] || 0) * 2;
        } else if (group === "Group 10 (OM) Payout") {
          entry[group] = (entry[group] || 0) * 3;
        }
        if (group.endsWith("Payout")) totalPayout += entry[group] || 0;
      });

      const poolPayouts2025 = require("../data/poolPayouts2025");
      entry["Pool Payout"] = poolPayouts2025[index + 1] || 0;

    } else {
      // ── Active year — all rules from env vars ────────────────────────────
      const { mutGroup, oldMutGroup, mutMult, oldMutMult, poolPayouts, frlWinner, frlPayout } =
        getActiveConfig();

      Object.keys(entry).forEach((group) => {
        if (group === "1RL Payout") {
          entry[group] =
            frlWinner && entry["1RL"] && entry["1RL"].toLowerCase().includes(frlWinner)
              ? frlPayout
              : 0;
        } else if (group.endsWith(" Payout") && group !== "1RL Payout" && group !== "Pool Payout") {
          // Detect Mutt / Old Mutt groups by group number OR by legacy/alternate names
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
        if (group.endsWith("Payout")) totalPayout += entry[group] || 0;
      });

      entry["Pool Payout"] = poolPayouts[index + 1] || 0;
    }

    entry["Total Payout"] = totalPayout;
  });
}

// ---------------------------------------------------------------------------
// Name matching
// ---------------------------------------------------------------------------

/**
 * Matches a golfer name from the CSV to a key in the payouts map, handling
 * known name-collision edge cases (Højgaard twins, Scott/Scheffler, Kim twins).
 */
function matchGolferAndAssignPayout(golferName, group, entry, payouts) {
  let payoutName = null;

  if (golferName.includes("højgaard") || golferName.includes("hojgaard")) {
    // Must match first name to distinguish the twins.
    // Handle both ø and plain-o spellings in CSV and API names.
    const isNicolai = golferName.includes("nicolai");
    const isRasmus  = golferName.includes("rasmus");
    payoutName = Object.keys(payouts).find((key) => {
      const k = key.toLowerCase();
      if (!k.includes("højgaard") && !k.includes("hojgaard")) return false;
      if (isNicolai) return k.includes("nicolai");
      if (isRasmus)  return k.includes("rasmus");
      return true; // No first name given — take the first Højgaard found
    });

  } else if (golferName === "scott") {
    payoutName = Object.keys(payouts).find((k) => k.toLowerCase().includes("adam scott"));

  } else if (golferName === "scheffler") {
    payoutName = Object.keys(payouts).find((k) =>
      k.toLowerCase().includes("scottie scheffler") ||
      k.toLowerCase().includes("scotty scheffler")
    );

  } else if (golferName === "kim") {
    // Multiple Kims possible — prefer Si Woo Kim (most common Masters appearance),
    // then Tom Kim, then Michael Kim.
    const siWooKim   = Object.keys(payouts).find((k) => k.toLowerCase().includes("si woo kim"));
    const tomKim     = Object.keys(payouts).find((k) => k.toLowerCase().includes("tom kim"));
    const michaelKim = Object.keys(payouts).find((k) => k.toLowerCase().includes("michael kim"));
    payoutName = siWooKim || tomKim || michaelKim;

  } else {
    // Precise word-boundary match first, then loose fallback
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
  tieBuffer.forEach((name) => {
    payouts[name] = avg;
  });
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
