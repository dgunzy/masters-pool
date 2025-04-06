/**
 * Updates entry objects with calculated payouts
 * @param {Object} payouts - Object containing payouts by player name
 * @param {string} year - Year for the data (2024 or 2025)
 */
function updateEntryObjectsWithPayouts(payouts, year) {
  global[`entryObjects${year}`].forEach((entry) => {
    Object.keys(entry).forEach((group) => {
      if (
        group.startsWith("Group") ||
        group === "Mutt" ||
        group === "Old Mutt" ||
        group === "WC" ||
        group === "1RL"
      ) {
        const golferName = entry[group].toLowerCase();

        // Try to find a matching name in the payouts object
        const payoutName = Object.keys(payouts).find(
          (payoutKey) =>
            payoutKey.toLowerCase().includes(golferName) ||
            golferName.includes(payoutKey.toLowerCase())
        );

        if (payoutName) {
          entry[group + " Payout"] = payouts[payoutName];
        }
      }
    });
  });

  // Apply special rules and calculate totals
  adjustValuesAndCalculateTotal(year);
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
      // 2025 rules - currently the same as 2024, but kept separate for future modifications
      Object.keys(entry).forEach((group) => {
        if (group === "1RL Payout") {
          entry[group] = 0;
          // For 2025, you can modify this condition to match the first-round leader
          // For now, using the same logic as 2024
          if (entry["1RL"].toLowerCase().includes("dechambeau")) {
            entry[group] = 500000;
          }
        } else if (group === "Mutt Payout" || group === "Old Mutt Payout") {
          entry[group] = (entry[group] || 0) * 2;
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

module.exports = {
  updateEntryObjectsWithPayouts,
  calculatePayoutsByTotal,
  adjustValuesAndCalculateTotal,
};
