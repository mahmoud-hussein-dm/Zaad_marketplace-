const fs = require('fs');
const path = require('path');
const seed = require('./data/seedData');

const dbPath = path.join(__dirname, 'data', 'database.json');

fs.writeFileSync(dbPath, JSON.stringify(seed, null, 2));
console.log('Database seeded at', dbPath);
