/**
 * Updates entry objects with calculated payouts
 * @param {Object} payouts - Object containing payouts by player name
 * @param {string} year - Year for the data (2024 or 2025)
 */
function updateEntryObjectsWithPayouts(payouts, year) {
  global[`entryObjects${year}`].forEach((entry) => {
    Object.keys(entry).forEach((group) => {
      // Handle different naming conventions between 2024 and 2025
      if (year === "2024") {
        if (
          group.startsWith("Group") ||
          group === "Mutt" ||
          group === "Old Mutt" ||
          group === "WC" ||
          group === "1RL"
        ) {
          const golferName = entry[group].toLowerCase();
          matchGolferAndAssignPayout(golferName, group, entry, payouts);
        }
      } else if (year === "2025") {
        if (group.startsWith("Group") || group === "WC" || group === "1RL") {
          const golferName = entry[group].toLowerCase();
          matchGolferAndAssignPayout(golferName, group, entry, payouts);
        }
      }
    });
  });

  // For 2025, check for first round leaders
  if (year === "2025") {
    // Call first round leader function if the first round data is available
    const leaderboardData = global[`golfData${year}`];
    if (
      leaderboardData &&
      leaderboardData.leaderboardRows &&
      leaderboardData.leaderboardRows.length > 0 &&
      leaderboardData.leaderboardRows[0].rounds &&
      leaderboardData.leaderboardRows[0].rounds.length > 0
    ) {
      updateFirstRoundLeaderPayouts(year);
    }
  }

  // Apply special rules and calculate totals
  adjustValuesAndCalculateTotal(year);
}

/**
 * Helper function to match golfer names and assign payouts
 * @param {string} golferName - Lowercase golfer name to match
 * @param {string} group - Group key
 * @param {Object} entry - Entry object to update
 * @param {Object} payouts - Payouts by player name
 */
function matchGolferAndAssignPayout(golferName, group, entry, payouts) {
  // For cases with identical last names (like Højgaard), require more specific matching
  if (golferName.includes("højgaard")) {
    const payoutName = Object.keys(payouts).find((payoutKey) => {
      const payoutLower = payoutKey.toLowerCase();
      // Must match both first and last name for Højgaard twins
      if (payoutLower.includes("højgaard")) {
        const isNicolai =
          golferName.includes("nicolai") && payoutLower.includes("nicolai");
        const isRasmus =
          golferName.includes("rasmus") && payoutLower.includes("rasmus");
        return isNicolai || isRasmus;
      }
      return false;
    });

    if (payoutName) {
      entry[group + " Payout"] = payouts[payoutName];
    }
  } else {
    // Regular matching for other golfers
    const payoutName = Object.keys(payouts).find(
      (payoutKey) =>
        payoutKey.toLowerCase().includes(golferName.toLowerCase()) ||
        golferName.includes(payoutKey.toLowerCase())
    );

    if (payoutName) {
      entry[group + " Payout"] = payouts[payoutName];
    }
  }
}

/**
 * Applies special payout rules and calculates total payouts
 * @param {string} year - Year for the data (2024 or 2025)
 */
function adjustValuesAndCalculateTotal(year) {
  global[`entryObjects${year}`].forEach((entry) => {
    let totalPayout = 0;

    // Apply year-specific adjustments
    if (year === "2024") {
      // 2024 rules
      Object.keys(entry).forEach((group) => {
        if (group === "1RL Payout") {
          entry[group] = 0;
          if (entry["1RL"].toLowerCase().includes("dechambeau")) {
            entry[group] = 500000;
          }
        } else if (group === "Mutt Payout" || group === "Old Mutt Payout") {
          entry[group] = entry[group] * 2;
        }

        if (group.endsWith("Payout")) {
          totalPayout += entry[group] || 0;
        }
      });
    } else if (year === "2025") {
      // 2025 rules with updated group structure
      Object.keys(entry).forEach((group) => {
        if (group === "1RL Payout") {
          // 1RL payout is now handled by the updateFirstRoundLeaderPayouts function
          // We don't modify it here, just add it to the total
        } else if (group === "Group 9 (M) Payout") {
          // Mutt - Double the prize money for Group 9
          entry[group] = (entry[group] || 0) * 2;
        } else if (group === "Group 10 (OM) Payout") {
          // Old Mutt - Triple the prize money for Group 10
          entry[group] = (entry[group] || 0) * 3;
        }

        if (group.endsWith("Payout")) {
          totalPayout += entry[group] || 0;
        }
      });
    }

    // Attach the total payout to the entry
    entry["Total Payout"] = totalPayout;
  });
}

/**
 * Calculates payouts for players based on leaderboard position
 * @param {Array} leaderboardRows - Array of player data from API
 * @param {Object} payoutStructure - Structure of payouts by position
 * @returns {Object} - Payouts by player name
 */
function calculatePayoutsByTotal(leaderboardRows, payoutStructure) {
  const activePlayers = leaderboardRows.filter(
    (player) => player.status !== "cut"
  );

  // Sort players by their total score
  const sortedLeaderboard = activePlayers.sort(
    (a, b) => parseFloat(a.total) - parseFloat(b.total)
  );

  // Initialize payouts object
  const payouts = {};

  // Track variables for handling ties
  let lastTotal = null;
  let playersProcessed = 0;
  let tieBuffer = [];

  sortedLeaderboard.forEach((player, index) => {
    const total = player.total;
    const playerName = `${player.firstName} ${player.lastName}`;

    // Check for ties
    if (total === lastTotal) {
      tieBuffer.push(playerName);
    } else {
      // Not a tie, resolve any previous ties
      if (tieBuffer.length > 0) {
        distributeTiePayout(
          tieBuffer,
          playersProcessed - tieBuffer.length,
          payoutStructure,
          payouts
        );
        tieBuffer = [];
      }

      // Add current player to payouts
      const currentPayoutPosition = playersProcessed + 1;
      payouts[playerName] =
        payoutStructure[currentPayoutPosition.toString()] || 0;
      lastTotal = total;
      tieBuffer.push(playerName);
    }

    // Increment processed counter
    playersProcessed++;

    // Handle the last player(s) in case of tie
    if (index === sortedLeaderboard.length - 1 && tieBuffer.length > 0) {
      distributeTiePayout(
        tieBuffer,
        playersProcessed - tieBuffer.length,
        payoutStructure,
        payouts
      );
    }
  });

  return payouts;
}

/**
 * Distributes payouts for tied players
 * @param {Array} tieBuffer - Array of tied player names
 * @param {number} startIndex - Start index for calculating positions
 * @param {Object} payoutStructure - Structure of payouts by position
 * @param {Object} payouts - Payouts object to update
 */
function distributeTiePayout(tieBuffer, startIndex, payoutStructure, payouts) {
  // Calculate the average payout for the tied positions
  const totalPayoutForTies = tieBuffer.reduce((sum, _, index) => {
    const payoutPosition = startIndex + index + 1;
    return sum + (payoutStructure[payoutPosition.toString()] || 0);
  }, 0);

  const averagePayout = totalPayoutForTies / tieBuffer.length;

  // Distribute the average payout to each tied player
  tieBuffer.forEach((playerName) => {
    payouts[playerName] = averagePayout;
  });
}

/**
 * Determines the first round leader(s) and updates entries with 1RL payouts
 * This function should be called after the first round is complete
 * @param {string} year - Year of the tournament (should be "2025")
 * @returns {Array} - Array of first round leaders' names
 */
function updateFirstRoundLeaderPayouts(year) {
  // This function should only be used for 2025
  if (year !== "2025") {
    console.log("First round leader function is only for 2025 data");
    return [];
  }

  const leaderboardData = global[`golfData${year}`];
  if (!leaderboardData || !leaderboardData.leaderboardRows) {
    console.log(
      "No leaderboard data available to determine first round leaders"
    );
    return [];
  }

  // Get player scores for round 1
  const playerRound1Scores = leaderboardData.leaderboardRows
    .map((player) => {
      // Make sure rounds array exists and has at least one entry
      const round1Score =
        player.rounds && player.rounds.length > 0
          ? player.rounds[0].score
          : null;
      return {
        name: `${player.firstName} ${player.lastName}`,
        score: round1Score,
      };
    })
    .filter((player) => player.score !== null);

  // If no round 1 scores are available yet, return empty array
  if (playerRound1Scores.length === 0) {
    console.log("No round 1 scores available yet");
    return [];
  }

  // Find the lowest score for round 1
  const lowestScore = Math.min(
    ...playerRound1Scores.map((player) => player.score)
  );

  // Find all players with the lowest score
  const firstRoundLeaders = playerRound1Scores
    .filter((player) => player.score === lowestScore)
    .map((player) => player.name);

  console.log(`First round leaders for ${year}:`, firstRoundLeaders);

  // Update entries that correctly picked first round leaders
  updateEntriesWithFirstRoundLeaderPayouts(firstRoundLeaders, year);

  return firstRoundLeaders;
}

/**
 * Updates entries with first round leader payouts
 * @param {Array} firstRoundLeaders - Array of names of first round leaders
 * @param {string} year - Year of the tournament
 */
function updateEntriesWithFirstRoundLeaderPayouts(firstRoundLeaders, year) {
  if (!firstRoundLeaders || firstRoundLeaders.length === 0) {
    console.log("No first round leaders to process");
    return;
  }

  const firstRoundLeaderPayout = 500000; // $500,000 for correct 1RL pick

  global[`entryObjects${year}`].forEach((entry) => {
    // Get the 1RL pick for this entry
    const firstRoundLeaderPick = entry["1RL"];

    if (!firstRoundLeaderPick) return;

    // Check if the entry's 1RL pick matches any of the first round leaders
    const hasCorrectPick = firstRoundLeaders.some(
      (leader) =>
        leader.toLowerCase().includes(firstRoundLeaderPick.toLowerCase()) ||
        firstRoundLeaderPick.toLowerCase().includes(leader.toLowerCase())
    );

    // Update the entry with the payout if they got it right
    if (hasCorrectPick) {
      entry["1RL Payout"] = firstRoundLeaderPayout;
      console.log(
        `Entry ${entry.name} gets 1RL payout for picking ${firstRoundLeaderPick}`
      );
    } else {
      entry["1RL Payout"] = 0;
    }
  });
}

module.exports = {
  updateEntryObjectsWithPayouts,
  calculatePayoutsByTotal,
  adjustValuesAndCalculateTotal,
  updateFirstRoundLeaderPayouts,
};
