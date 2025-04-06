/**
 * Utility functions for tournament timing and scheduling
 */

/**
 * Check if the current time is during tournament hours (7:30 AM - 7:30 PM Eastern Time)
 * @returns {boolean} true if current time is during tournament hours
 */
function isDuringTournamentHours() {
  const now = new Date();

  // Convert to Eastern Time
  const easternTime = new Date(
    now.toLocaleString("en-US", { timeZone: "America/New_York" })
  );
  const hours = easternTime.getHours();
  const minutes = easternTime.getMinutes();

  // Tournament hours: 7:30 AM - 7:30 PM Eastern Time
  const tournamentStartHour = 7;
  const tournamentStartMinute = 30;
  const tournamentEndHour = 19;
  const tournamentEndMinute = 30;

  // Check if current time is during tournament hours
  if (hours > tournamentStartHour && hours < tournamentEndHour) {
    return true;
  } else if (
    hours === tournamentStartHour &&
    minutes >= tournamentStartMinute
  ) {
    return true;
  } else if (hours === tournamentEndHour && minutes <= tournamentEndMinute) {
    return true;
  }

  return false;
}

/**
 * Check if the current date is during the 2025 Masters Tournament (April 10-13, 2025)
 * @returns {boolean} true if current date is during tournament dates
 */
function isDuringTournamentDates() {
  const now = new Date();

  // Convert to Eastern Time
  const easternTime = new Date(
    now.toLocaleString("en-US", { timeZone: "America/New_York" })
  );
  const year = easternTime.getFullYear();
  const month = easternTime.getMonth(); // 0-indexed, so April is 3
  const day = easternTime.getDate();

  // Tournament dates: April 10-13, 2025
  if (year === 2025 && month === 3) {
    return day >= 10 && day <= 13;
  }

  return false;
}

/**
 * Determine the appropriate poll interval based on tournament timing
 * @returns {number} poll interval in milliseconds (5 minutes during tournament, 1 hour otherwise)
 */
function determinePollInterval() {
  const fiveMinutes = 5 * 60 * 1000;
  const oneHour = 60 * 60 * 1000;

  // If it's during tournament dates and hours, poll every 5 minutes
  if (isDuringTournamentDates() && isDuringTournamentHours()) {
    console.log("Tournament in progress - polling every 5 minutes");
    return fiveMinutes;
  }

  // Otherwise, poll every hour
  console.log("Tournament not in progress - polling every hour");
  return oneHour;
}

/**
 * Check if the 2025 tournament has started yet
 * @returns {boolean} true if tournament has started
 */
function hasTournamentStarted() {
  const now = new Date();

  // Tournament start: April 10, 2025
  const tournamentStart = new Date("2025-04-10T00:00:00-04:00");

  return now >= tournamentStart;
}

module.exports = {
  isDuringTournamentHours,
  isDuringTournamentDates,
  determinePollInterval,
  hasTournamentStarted,
};
