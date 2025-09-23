const { readDatabase, updateDatabase } = require('../utils/dataStore');
const walletService = require('./walletService');
const { pushNotification } = require('./notificationService');

function bumpStore(storeId, userId) {
  const { config, stores } = readDatabase();
  const store = stores.find((item) => item.id === storeId);
  if (!store) {
    throw new Error('store-not-found');
  }
  if (store.userId !== userId) {
    throw new Error('forbidden');
  }
  const usdRate = config.usdSdgRate || 600;
  const feeSDG = Math.round((config.storeBumpUsd || 5) * usdRate);
  walletService.debit(userId, feeSDG, 'BUMP', {
    referenceId: storeId,
    kind: 'store',
    durationDays: 7
  });
  const bumpedUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  return updateDatabase((db) => {
    const index = db.stores.findIndex((item) => item.id === storeId);
    db.stores[index].bumpedUntil = bumpedUntil;
    db.stores[index].updatedAt = new Date().toISOString();
    pushNotification(userId, 'PROMO', {
      storeId,
      message: 'store-bumped',
      bumpedUntil
    });
    return {
      store: db.stores[index],
      fee: feeSDG
    };
  });
}

module.exports = {
  bumpStore
};
