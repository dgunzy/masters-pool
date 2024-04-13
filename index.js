const express = require('express');
const https = require('https');
const fs = require('fs').promises; // Use the promise-based version of fs
const csv = require('csv-parse');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;
require('dotenv').config();
app.use(express.static('public')); // 'public' is a directory in your project root for static files

global.golfData = {}; // This will hold the API response
global.entryObjects = [];

// const csvContent = fs.readFileSync('masters-pool-2.csv', { encoding: 'utf-8' });
async function fetchCsvContent() {
  try {
    const csvFilePath = 'masters-pool-2.csv'; // Adjust the path to where your CSV file is located
    const csvContent = await fs.readFile(csvFilePath, 'utf-8');
    return csvContent;
  } catch (error) {
    console.error("Error fetching CSV content:", error);
    throw error; // Rethrow to handle it in the calling context
  }
}
function parseCsvContent(csvContent) {
  return new Promise((resolve, reject) => {
    csv.parse(csvContent, {
      columns: true,
      skip_empty_lines: true
    }, (err, records) => {
      if (err) {
        reject(err);
      } else {
        resolve(records);
      }
    });
  });
}
// csv.parse(csvContent, {
//   columns: true, // Use the first line as column headers
//   skip_empty_lines: true
// }, (err, records) => {
//   if (err) {
//     throw err;
//   }

//   // Extract headers (column names) from the first record
//   const headers = records.length > 0 ? Object.keys(records[0]) : [];

//   // Map each header (except 'Entry') to an object
//   const entryObjects = headers.filter(header => header !== 'Entry').map(header => {
//     const entryObject = { name: header };
//     records.forEach(record => {
//       // Use the header to reference the value and 'Entry' for the property name
//       entryObject[record.Entry] = record[header];
//     });
//     return entryObject;
//   });

//   global.entryObjects = entryObjects;  // Now, you can use entryObjects as you need in your application
// });

async function fetchGolfData() {
  // Reset global objects
  global.golfData = {}; 
  global.entryObjects = [];

  // Assume you have a function to asynchronously fetch and read your CSV content
  // This could be fetching from a remote source or reading from a local file
  const csvContent = await fetchCsvContent(); // This fetches the actual CSV content now
  const records = await parseCsvContent(csvContent); // This parses the CSV content
  // Parse the CSV content and populate global.entryObjects
  try {
      const records = await parseCsvContent(csvContent); // Assume this returns the parsed records
      const headers = records.length > 0 ? Object.keys(records[0]) : [];

      global.entryObjects = headers.filter(header => header !== 'Entry').map(header => {
          const entryObject = { name: header };
          records.forEach(record => {
              entryObject[record.Entry] = record[header];
          });
          return entryObject;
      });
  } catch (error) {
      console.error("Error parsing CSV content:", error);
      return; // Exit the function if there's an error parsing the CSV
  }

  // Proceed with fetching the golf data as before
  const options = {
      method: 'GET',
      hostname: process.env.RAPIDAPI_HOST,
      path: '/leaderboard?orgId=1&tournId=014&year=2024',
      headers: {
          'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
          'X-RapidAPI-Host': process.env.RAPIDAPI_HOST
      }
  };

  const request = https.request(options, (response) => {
      let data = '';

      response.on('data', (chunk) => {
          data += chunk;
      });

      response.on('end', () => {
          try {
              const parsedData = JSON.parse(data);
              // console.log(parsedData)

              if (Array.isArray(parsedData.leaderboardRows)) {
                  // Calculate payouts based on the latest data
                  const payouts = calculatePayoutsByTotal(parsedData.leaderboardRows, payoutStructure);

                  // Update the global entryObjects with these payouts
                  updateEntryObjectsWithPayouts(payouts);

                  // Since global.golfData is meant to hold API response, update it as necessary
                  global.golfData = parsedData;

                  console.log("Golf data updated with payouts.");
              } else {
                  console.error("leaderboardRows is missing or not an array");
              }
          } catch (error) {
              console.error("Error parsing golf data:", error);
          }
      });
  });

  request.on('error', (error) => {
      console.error("Error fetching golf data:", error);
  });

  request.end();
}



app.get('/data', (req, res) => {
    if (global.entryObjects) {
        // console.log("Successfully accessed route"); 
        res.json(global.entryObjects);
    } else {
        res.status(503).send('Golf data is not available yet. Please try again later.');
    }
});


fetchGolfData();

// Set up the interval to refresh the data every 15 minutes
setInterval(fetchGolfData, 5 * 60 * 1000);

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
function updateEntryObjectsWithPayouts(payouts) {
    // console.log("Available names in payouts:", Object.keys(payouts));

    global.entryObjects.forEach(entry => {
        Object.keys(entry).forEach(group => {
            if (group.startsWith('Group') || group === 'Mutt' || group === 'Old Mutt' || group === 'WC' || group === '1RL') {
                const golferName = entry[group].toLowerCase(); // Convert entry golferName to lowercase
                
                // Attempt to find a matching name in the payouts object (also in lowercase)
                const payoutName = Object.keys(payouts).find(payoutKey =>
                    payoutKey.toLowerCase().includes(golferName) || golferName.includes(payoutKey.toLowerCase())
                );

                if (payoutName) {
                    // If a partial match is found, update the entry with the payout information
                    entry[group + ' Payout'] = payouts[payoutName];
                } else {
                    // Log the mismatch for further inspection
                    // console.log(`No payout found for: ${golferName}. Attempting to match against:`, Object.keys(payouts).map(key => key.toLowerCase()));
                }
            }
        });
    });
    adjustValuesAndCalculateTotal();

    // Optionally log the updated entryObjects to verify
    // console.log(global.entryObjects);
}

function adjustValuesAndCalculateTotal() {
    global.entryObjects.forEach(entry => {
        let totalPayout = 0; // Initialize total payout for the entry

        // Adjust specific payouts and accumulate the total payout
        Object.keys(entry).forEach(group => {
            if (group === '1RL Payout') {
                entry[group] = 0; // Set '1RL Payout' to 0
                if (entry['1RL'].toLowerCase().includes('dechambeau')) {
                  entry['1RL Payout'] = 500000;// Add $500,000 to the total payout

              }
            } else if (group === 'Mutt Payout') {
                entry[group] = entry[group] * 2; // Double the 'Mutt Payout'
            }
            else if (group === 'Old Mutt Payout') {
              entry[group] = entry[group] * 2; // Double the 'Mutt Payout'
            } 

            // If the group ends with 'Payout', add it to the totalPayout
            if (group.endsWith('Payout')) {
                totalPayout += entry[group];
            }
        });

        // Attach the total payout to the entry
        entry['Total Payout'] = totalPayout;
    });

    // Optionally log the updated entryObjects to verify
    // console.log(global.entryObjects);
}
// Assume 'leaderboard' is an array of player objects that includes their position
function calculatePayoutsByTotal(leaderboardRows, payoutStructure) {
    const activePlayers = leaderboardRows.filter(player => player.status !== 'cut');
    // Sort players by their total score in ascending order (lower is better)
    const sortedLeaderboard = activePlayers.sort((a, b) => parseFloat(a.total) - parseFloat(b.total));
  
    // Initialize an object to hold the payouts
    const payouts = {};
  
    // Keep track of the last total score to handle ties
    let lastTotal = null;
    // Keep track of how many players have been processed (for payout indexing)
    let playersProcessed = 0;
    // Keep track of tied players to adjust payouts accordingly
    let tieBuffer = [];
  
    sortedLeaderboard.forEach((player, index) => {
      const total = player.total; // The 'total' value for the current player
      const playerName = `${player.firstName} ${player.lastName}`;
  
      // Check for a tie with the previous player
      if (total === lastTotal) {
        // Add the current player to the tie buffer
        tieBuffer.push(playerName);
      } else {
        // Not a tie, or the first player being processed
        // First, resolve any ties from the tieBuffer
        if (tieBuffer.length > 0) {
          distributeTiePayout(tieBuffer, playersProcessed - tieBuffer.length, payoutStructure, payouts);
          tieBuffer = []; // Clear the buffer for the next set of ties
        }
  
        // Add the current player to the payouts (will adjust later if it turns out to be a tie)
        const currentPayoutPosition = playersProcessed + 1; // Position in the payout structure
        payouts[playerName] = payoutStructure[currentPayoutPosition.toString()] || 0;
        lastTotal = total; // Update the last total for the next iteration
        tieBuffer.push(playerName); // Add current player to tie buffer in case the next one ties
      }
  
      // Always increment the count of players processed
      playersProcessed++;
  
      // Handle the last player(s) in case they are part of a tie
      if (index === sortedLeaderboard.length - 1 && tieBuffer.length > 0) {
        distributeTiePayout(tieBuffer, playersProcessed - tieBuffer.length, payoutStructure, payouts);
      }
    });
  
    return payouts;
  }
  
  function distributeTiePayout(tieBuffer, startIndex, payoutStructure, payouts) {
    // Calculate the average payout for the tied positions
    const totalPayoutForTies = tieBuffer.reduce((sum, _, index) => {
      const payoutPosition = startIndex + index + 1; // Adjusted position for payout
      return sum + (payoutStructure[payoutPosition.toString()] || 0);
    }, 0);
    const averagePayout = totalPayoutForTies / tieBuffer.length;
  
    // Distribute the average payout to each tied player
    tieBuffer.forEach(playerName => {
      payouts[playerName] = averagePayout;
    });
  }
  
  const payoutStructure = {
    "1": 3600000,
    "2": 2160000,
    "3": 1360000,
    "4": 960000,
    "5": 800000,
    "6": 720000,
    "7": 670000,
    "8": 620000,
    "9": 580000,
    "10": 540000,
    "11": 500000,
    "12": 460000,
    "13": 420000,
    "14": 380000,
    "15": 360000,
    "16": 340000,
    "17": 320000,
    "18": 300000,
    "19": 280000,
    "20": 260000,
    "21": 240000,
    "22": 224000,
    "23": 208000,
    "24": 192000,
    "25": 176000,
    "26": 160000,
    "27": 154000,
    "28": 148000,
    "29": 142000,
    "30": 136000,
    "31": 130000,
    "32": 124000,
    "33": 118000,
    "34": 113000,
    "35": 108000,
    "36": 103000,
    "37": 98000,
    "38": 94000,
    "39": 90000,
    "40": 86000,
    "41": 82000,
    "42": 78000,
    "43": 74000,
    "44": 70000,
    "45": 66000,
    "46": 62000,
    "47": 58000,
    "48": 54800,
    "49": 52000,
    "50": 50400
};
  

  