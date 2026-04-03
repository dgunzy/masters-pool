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
 * Parses CSV content into an array of record objects.
 * @param {string} csvContent
 * @returns {Promise<Array>}
 */
function parseCsvContent(csvContent) {
  return new Promise((resolve, reject) => {
    csv.parse(
      csvContent,
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
 * @param {Array} records
 * @returns {Array}
 */
function processRecords(records) {
  const headers = records.length > 0 ? Object.keys(records[0]) : [];

  return headers
    .filter((header) => header !== "Entry")
    .map((header) => {
      const entryObject = { name: header };
      records.forEach((record) => {
        entryObject[record.Entry] = record[header];
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
