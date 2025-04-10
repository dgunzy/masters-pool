// /**
//  * Determines the first round leader(s) and updates entries with 1RL payouts
//  * This function should be called after the first round is complete
//  * @param {string} year - Year of the tournament (should be "2025")
//  * @returns {Array} - Array of first round leaders' names
//  */
// function updateFirstRoundLeaderPayouts(year) {
//   // This function should only be used for 2025
//   if (year !== "2025") {
//     console.log("First round leader function is only for 2025 data");
//     return [];
//   }

//   const leaderboardData = global[`golfData${year}`];
//   if (!leaderboardData || !leaderboardData.leaderboardRows) {
//     console.log(
//       "No leaderboard data available to determine first round leaders"
//     );
//     return [];
//   }

//   // Get player scores for round 1
//   const playerRound1Scores = leaderboardData.leaderboardRows
//     .map((player) => {
//       // Make sure rounds array exists and has at least one entry
//       const round1Score =
//         player.rounds && player.rounds.length > 0
//           ? player.rounds[0].score
//           : null;
//       return {
//         name: `${player.firstName} ${player.lastName}`,
//         score: round1Score,
//       };
//     })
//     .filter((player) => player.score !== null);

//   // If no round 1 scores are available yet, return empty array
//   if (playerRound1Scores.length === 0) {
//     console.log("No round 1 scores available yet");
//     return [];
//   }

//   // Find the lowest score for round 1
//   const lowestScore = Math.min(
//     ...playerRound1Scores.map((player) => player.score)
//   );

//   // Find all players with the lowest score
//   const firstRoundLeaders = playerRound1Scores
//     .filter((player) => player.score === lowestScore)
//     .map((player) => player.name);

//   console.log(`First round leaders for ${year}:`, firstRoundLeaders);

//   // Update entries that correctly picked first round leaders
//   updateEntriesWithFirstRoundLeaderPayouts(firstRoundLeaders, year);

//   return firstRoundLeaders;
// }

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

  // Recalculate total payouts
  adjustValuesAndCalculateTotal(year);
}

module.exports = {
  updateFirstRoundLeaderPayouts,
  updateEntriesWithFirstRoundLeaderPayouts,
};
