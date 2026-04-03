const { adjustValuesAndCalculateTotal } = require("./dataProcessor");

/**
 * Updates entries with first round leader payouts.
 *
 * @param {Array}  firstRoundLeaders - Array of player name strings who led after round 1
 * @param {string} year              - Active year string (e.g. "2026")
 */
function updateEntriesWithFirstRoundLeaderPayouts(firstRoundLeaders, year) {
  if (!firstRoundLeaders || firstRoundLeaders.length === 0) {
    console.log("No first round leaders to process");
    return;
  }

  const frlPayout = parseInt(process.env.FIRST_ROUND_LEADER_PAYOUT || "500000");

  global[`entryObjects${year}`].forEach((entry) => {
    const pick = entry["1RL"];
    if (!pick) return;

    const hasCorrectPick = firstRoundLeaders.some(
      (leader) =>
        leader.toLowerCase().includes(pick.toLowerCase()) ||
        pick.toLowerCase().includes(leader.toLowerCase())
    );

    entry["1RL Payout"] = hasCorrectPick ? frlPayout : 0;

    if (hasCorrectPick) {
      console.log(`Entry ${entry.name} gets 1RL payout for picking ${pick}`);
    }
  });

  adjustValuesAndCalculateTotal(year);
}

module.exports = {
  updateEntriesWithFirstRoundLeaderPayouts,
};
