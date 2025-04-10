/**
 * Utility functions for processing player data
 */

/**
 * Calculate ownership percentage of each player in the pool by group
 * @param {Array} entryObjects - Array of entry objects from the CSV
 * @returns {Object} - Object with groups as keys and player ownership data as values
 */
function calculatePlayerOwnership(entryObjects) {
  const totalEntries = entryObjects.length;
  const groupPlayerCounts = {};

  // Initialize groups
  entryObjects.forEach((entry) => {
    Object.keys(entry).forEach((key) => {
      if (
        (key.startsWith("Group") || key === "WC" || key === "1RL") &&
        !key.includes("Payout") &&
        !key.includes("_data")
      ) {
        if (!groupPlayerCounts[key]) {
          groupPlayerCounts[key] = {};
        }
      }
    });
  });

  // Count occurrences of each player within each group
  entryObjects.forEach((entry) => {
    Object.keys(groupPlayerCounts).forEach((groupKey) => {
      const playerName = entry[groupKey];
      if (!playerName) return;

      const normalizedName = playerName.toLowerCase();

      if (!groupPlayerCounts[groupKey][normalizedName]) {
        groupPlayerCounts[groupKey][normalizedName] = 0;
      }

      groupPlayerCounts[groupKey][normalizedName]++;
    });
  });

  // Convert counts to percentages for each group
  const groupOwnershipPercentages = {};

  Object.keys(groupPlayerCounts).forEach((groupKey) => {
    groupOwnershipPercentages[groupKey] = {};

    Object.keys(groupPlayerCounts[groupKey]).forEach((playerName) => {
      const count = groupPlayerCounts[groupKey][playerName];
      groupOwnershipPercentages[groupKey][playerName] =
        (count / totalEntries) * 100;
    });
  });

  return groupOwnershipPercentages;
}

/**
 * Create a map of player data including scores and positions
 * @param {Array} leaderboardRows - Leaderboard data from the API
 * @returns {Object} - Map of player data with normalized names as keys
 */
function createPlayerDataMap(leaderboardRows) {
  const playerDataMap = {};

  leaderboardRows.forEach((player) => {
    const fullName = `${player.firstName} ${player.lastName}`.toLowerCase();
    const lastName = player.lastName.toLowerCase();

    // Store data under both full name and last name for better matching
    const playerData = {
      fullName: `${player.firstName} ${player.lastName}`,
      total: player.total,
      position: player.position,
      thru: player.thru,
      status: player.status,
      round: player.currentRound,
      roundScore: player.currentRoundScore,
    };

    playerDataMap[fullName] = playerData;
    playerDataMap[lastName] = playerData;
  });

  return playerDataMap;
}

/**
 * Enhance entry objects with player data
 * @param {Array} entryObjects - Array of entry objects
 * @param {Object} playerDataMap - Map of player data from leaderboard
 * @param {Object} groupOwnershipPercentages - Map of player ownership percentages by group
 * @returns {Array} - Enhanced entry objects with player data
 */
function enhanceEntriesWithPlayerData(
  entryObjects,
  playerDataMap,
  groupOwnershipPercentages
) {
  return entryObjects.map((entry) => {
    const enhancedEntry = { ...entry };

    // Enhance player data for each group
    Object.keys(entry).forEach((key) => {
      if (
        (key.startsWith("Group") || key === "WC" || key === "1RL") &&
        !key.includes("Payout") &&
        !key.includes("_data")
      ) {
        const playerName = entry[key];
        if (!playerName) return;

        const normalizedName = playerName.toLowerCase();

        // Get group-specific ownership percentage
        let ownershipPercentage = "0%";
        if (
          groupOwnershipPercentages[key] &&
          groupOwnershipPercentages[key][normalizedName]
        ) {
          ownershipPercentage =
            groupOwnershipPercentages[key][normalizedName].toFixed(1) + "%";
        }

        // Create player data object
        enhancedEntry[key + "_data"] = {
          name: playerName,
          ownership: ownershipPercentage,
        };

        // Add tournament data if available
        if (playerDataMap[normalizedName]) {
          Object.assign(enhancedEntry[key + "_data"], {
            score: playerDataMap[normalizedName].total,
            position: playerDataMap[normalizedName].position,
            thru: playerDataMap[normalizedName].thru,
            status: playerDataMap[normalizedName].status,
            round: playerDataMap[normalizedName].round,
            roundScore: playerDataMap[normalizedName].roundScore,
          });
        }
      }
    });

    return enhancedEntry;
  });
}

module.exports = {
  calculatePlayerOwnership,
  createPlayerDataMap,
  enhanceEntriesWithPlayerData,
};
