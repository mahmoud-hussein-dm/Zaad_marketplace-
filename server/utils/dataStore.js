const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'database.json');

function readDatabase() {
  const raw = fs.readFileSync(dbPath, 'utf-8');
  return JSON.parse(raw);
}

function writeDatabase(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

function updateDatabase(mutator) {
  const data = readDatabase();
  const result = mutator(data);
  writeDatabase(data);
  return result;
}

module.exports = {
  readDatabase,
  writeDatabase,
  updateDatabase
};
