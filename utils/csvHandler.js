const fs  = require("fs").promises;
const csv = require("csv-parse");
const path = require("path");

/**
 * Reads a CSV file from an absolute path.
 * Used for the active year, whose CSV is mounted from a ConfigMap volume.
 * @param {string} filePath - Absolute path to CSV file
 */
async function fetchCsvContentFromPath(filePath) {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch (error) {
    console.error(`Error reading CSV from ${filePath}:`, error);
    throw error;
  }
}

/**
 * Reads a CSV file bundled inside the image (historical years).
 * @param {string} year - e.g. "2024" or "2025"
 */
async function fetchCsvContent(year) {
  const csvFilePath = path.join(__dirname, "..", "data", `masters-pool-${year}.csv`);
  return fetchCsvContentFromPath(csvFilePath);
}

/**
 * Strips empty leading rows from CSV content before parsing.
 * Google Forms exports often include blank rows above the header.
 * A row is considered empty if it contains only commas and whitespace.
 */
function stripEmptyLeadingRows(content) {
  const lines = content.split("\n");
  const firstNonEmpty = lines.findIndex(
    (line) => line.replace(/,/g, "").trim().length > 0
  );
  return firstNonEmpty > 0 ? lines.slice(firstNonEmpty).join("\n") : content;
}

/**
 * Parses CSV content into an array of record objects.
 * @param {string} csvContent
 * @returns {Promise<Array>}
 */
function parseCsvContent(csvContent) {
  return new Promise((resolve, reject) => {
    csv.parse(
      stripEmptyLeadingRows(csvContent),
      { columns: true, skip_empty_lines: true },
      (err, records) => {
        if (err) reject(err);
        else resolve(records);
      }
    );
  });
}

/**
 * Converts parsed CSV records into the entry-object format used by the app.
 * The CSV is column-per-participant, row-per-group-slot.
 *
 * Handles real-world Google Forms exports where:
 *   - The first column header may be empty (not "Entry")
 *   - Participant columns may have trailing empty headers
 * @param {Array} records
 * @returns {Array}
 */
function processRecords(records) {
  if (!records.length) return [];

  const keys = Object.keys(records[0]);
  const labelKey = keys[0]; // First column is always the group-label column

  return keys
    .slice(1) // Skip the label column
    .filter((header) => header.trim() !== "") // Drop empty trailing columns
    .map((header) => {
      const entryObject = { name: header };
      records.forEach((record) => {
        const groupLabel = (record[labelKey] || "").trim();
        if (groupLabel) {
          entryObject[groupLabel] = record[header];
        }
      });
      return entryObject;
    });
}

module.exports = {
  fetchCsvContent,
  fetchCsvContentFromPath,
  parseCsvContent,
  processRecords,
};
