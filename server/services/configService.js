const { readDatabase, updateDatabase } = require('../utils/dataStore');

function getConfig() {
  const { config } = readDatabase();
  return config;
}

function updateConfig(patch) {
  return updateDatabase((db) => {
    db.config = { ...db.config, ...patch, updatedAt: new Date().toISOString() };
    return db.config;
  });
}

module.exports = {
  getConfig,
  updateConfig
};
