const fs = require("fs").promises;
const csv = require("csv-parse");
const path = require("path");

/**
 * Reads CSV file content
 * @param {string} year - Year of the Masters tournament (2024 or 2025)
 * @returns {Promise<string>} - CSV content as string
 */
async function fetchCsvContent(year) {
  try {
    const csvFilePath = path.join(
      __dirname,
      "..",
      "data",
      `masters-pool-${year}.csv`
    );
    const csvContent = await fs.readFile(csvFilePath, "utf-8");
    return csvContent;
  } catch (error) {
    console.error(`Error fetching CSV content for ${year}:`, error);
    throw error;
  }
}

/**
 * Parses CSV content into structured data
 * @param {string} csvContent - CSV content as string
 * @returns {Promise<Array>} - Parsed records
 */
function parseCsvContent(csvContent) {
  return new Promise((resolve, reject) => {
    csv.parse(
      csvContent,
      {
        columns: true,
        skip_empty_lines: true,
      },
      (err, records) => {
        if (err) {
          reject(err);
        } else {
          resolve(records);
        }
      }
    );
  });
}

/**
 * Processes CSV records into entry objects
 * @param {Array} records - CSV parsed records
 * @param {string} year - Year of the Masters tournament
 * @returns {Array} - Entry objects
 */
function processRecords(records, year) {
  const headers = records.length > 0 ? Object.keys(records[0]) : [];

  const entryObjects = headers
    .filter((header) => header !== "Entry")
    .map((header) => {
      const entryObject = { name: header };
      records.forEach((record) => {
        entryObject[record.Entry] = record[header];
      });
      return entryObject;
    });

  return entryObjects;
}

module.exports = {
  fetchCsvContent,
  parseCsvContent,
  processRecords,
};
