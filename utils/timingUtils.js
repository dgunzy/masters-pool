/**
 * Utility functions for tournament timing and scheduling.
 * All values are driven by environment variables so they can be changed
 * via a single PR to the gitops deployment manifest.
 *
 * Required env vars (with defaults):
 *   TOURNAMENT_START_DATE  e.g. "2026-04-09"
 *   TOURNAMENT_END_DATE    e.g. "2026-04-12"
 *   TOURNAMENT_START_HOUR  e.g. "07:30"  (24h, Eastern)
 *   TOURNAMENT_END_HOUR    e.g. "19:30"  (24h, Eastern)
 *   TOURNAMENT_TIMEZONE    e.g. "America/New_York"
 *   POLL_INTERVAL_ACTIVE        ms, default 300000   (5 min)
 *   POLL_INTERVAL_OFF_HOURS     ms, default 3600000  (1 hr)
 *   POLL_INTERVAL_OFF_SEASON    ms, default 36000000 (10 hr)
 */

function getTournamentConfig() {
  const startDate = process.env.TOURNAMENT_START_DATE || "2026-04-09";
  const endDate   = process.env.TOURNAMENT_END_DATE   || "2026-04-12";
  const tz        = process.env.TOURNAMENT_TIMEZONE   || "America/New_York";

  const [startHour, startMin] = (process.env.TOURNAMENT_START_HOUR || "07:30")
    .split(":").map(Number);
  const [endHour, endMin]     = (process.env.TOURNAMENT_END_HOUR   || "19:30")
    .split(":").map(Number);

  return { startDate, endDate, tz, startHour, startMin, endHour, endMin };
}

/**
 * Returns the current date/time expressed in the tournament timezone.
 */
function nowInTz(tz) {
  return new Date(new Date().toLocaleString("en-US", { timeZone: tz }));
}

/**
 * Check if the current time is within tournament playing hours.
 */
function isDuringTournamentHours() {
  const { tz, startHour, startMin, endHour, endMin } = getTournamentConfig();
  const local = nowInTz(tz);
  const h = local.getHours();
  const m = local.getMinutes();

  const afterStart  = h > startHour || (h === startHour && m >= startMin);
  const beforeEnd   = h < endHour   || (h === endHour   && m <= endMin);
  return afterStart && beforeEnd;
}

/**
 * Check if today falls within the configured tournament dates.
 */
function isDuringTournamentDates() {
  const { tz, startDate, endDate } = getTournamentConfig();
  const local = nowInTz(tz);

  // Build midnight-local boundaries from the date strings
  const start = new Date(`${startDate}T00:00:00`);
  const end   = new Date(`${endDate}T23:59:59`);

  // Strip time from local for a pure date comparison
  const today = new Date(
    local.getFullYear(),
    local.getMonth(),
    local.getDate()
  );
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endDay   = new Date(end.getFullYear(),   end.getMonth(),   end.getDate());

  return today >= startDay && today <= endDay;
}

/**
 * Determine the appropriate poll interval based on tournament timing.
 */
function determinePollInterval() {
  const active    = parseInt(process.env.POLL_INTERVAL_ACTIVE     || "300000");
  const offHours  = parseInt(process.env.POLL_INTERVAL_OFF_HOURS  || "3600000");
  const offSeason = parseInt(process.env.POLL_INTERVAL_OFF_SEASON || "36000000");

  if (isDuringTournamentDates() && isDuringTournamentHours()) {
    console.log("Tournament in progress — polling every", active / 60000, "min");
    return active;
  }

  if (isDuringTournamentDates()) {
    console.log("Tournament day but outside active hours — polling every", offHours / 3600000, "hr");
    return offHours;
  }

  console.log("Tournament not in progress — polling every", offSeason / 3600000, "hr");
  return offSeason;
}

/**
 * Check whether the tournament start date/time has passed.
 */
function hasTournamentStarted() {
  const { startDate, tz, startHour, startMin } = getTournamentConfig();
  // Treat the start as the configured start hour on start date in the tournament TZ
  const tzOffset = tz === "America/New_York" ? "-04:00" : "-05:00"; // rough DST handling
  const tournamentStart = new Date(
    `${startDate}T${String(startHour).padStart(2, "0")}:${String(startMin).padStart(2, "0")}:00${tzOffset}`
  );
  return new Date() >= tournamentStart;
}

module.exports = {
  getTournamentConfig,
  isDuringTournamentHours,
  isDuringTournamentDates,
  determinePollInterval,
  hasTournamentStarted,
};
