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
