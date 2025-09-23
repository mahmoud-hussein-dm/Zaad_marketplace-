const { readDatabase, updateDatabase } = require('../utils/dataStore');
const { generateId } = require('../utils/id');

function getWallet(userId) {
  const { users, ledger } = readDatabase();
  const user = users.find((item) => item.id === userId);
  if (!user) {
    throw new Error('user-not-found');
  }
  const history = ledger
    .filter((entry) => entry.userId === userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return {
    balanceSDG: user.walletBalanceSDG || 0,
    entries: history
  };
}

function addLedgerEntry(userId, type, amountSDG, reason, metadata = {}, applyToBalance = true) {
  return updateDatabase((db) => {
    const userIndex = db.users.findIndex((user) => user.id === userId);
    if (userIndex === -1) {
      throw new Error('user-not-found');
    }
    if (applyToBalance) {
      const current = db.users[userIndex].walletBalanceSDG || 0;
      const delta = type === 'CREDIT' ? amountSDG : -amountSDG;
      const newBalance = current + delta;
      if (newBalance < 0) {
        throw new Error('insufficient-balance');
      }
      db.users[userIndex].walletBalanceSDG = newBalance;
      db.users[userIndex].updatedAt = new Date().toISOString();
    }
    const entry = {
      id: generateId('ledger'),
      userId,
      type,
      amountSDG,
      reason,
      referenceId: metadata.referenceId || null,
      metadata,
      createdAt: new Date().toISOString()
    };
    db.ledger.push(entry);
    return {
      balance: db.users[userIndex].walletBalanceSDG,
      entry
    };
  });
}

function credit(userId, amountSDG, reason, metadata = {}, applyToBalance = true) {
  return addLedgerEntry(userId, 'CREDIT', amountSDG, reason, metadata, applyToBalance);
}

function debit(userId, amountSDG, reason, metadata = {}) {
  return addLedgerEntry(userId, 'DEBIT', amountSDG, reason, metadata, true);
}

function recordCodExpected(userId, amountSDG, orderId) {
  return addLedgerEntry(
    userId,
    'CREDIT',
    amountSDG,
    'COD_EXPECTED',
    { referenceId: orderId, status: 'pending' },
    false
  );
}

function topUp(userId, amountSDG, method, proofUrl) {
  return credit(
    userId,
    amountSDG,
    'TOP_UP',
    {
      method,
      proofUrl
    },
    true
  );
}

function markCodSettled(userId, orderId) {
  return updateDatabase((db) => {
    const entryIndex = db.ledger.findIndex(
      (item) => item.userId === userId && item.reason === 'COD_EXPECTED' && item.referenceId === orderId
    );
    if (entryIndex !== -1) {
      db.ledger[entryIndex].metadata = {
        ...db.ledger[entryIndex].metadata,
        status: 'settled',
        settledAt: new Date().toISOString()
      };
    }
    return db.ledger[entryIndex];
  });
}

function markCodCancelled(userId, orderId) {
  return updateDatabase((db) => {
    const entryIndex = db.ledger.findIndex(
      (item) => item.userId === userId && item.reason === 'COD_EXPECTED' && item.referenceId === orderId
    );
    if (entryIndex !== -1) {
      db.ledger[entryIndex].metadata = {
        ...db.ledger[entryIndex].metadata,
        status: 'cancelled',
        cancelledAt: new Date().toISOString()
      };
    }
    return db.ledger[entryIndex];
  });
}

module.exports = {
  getWallet,
  addLedgerEntry,
  credit,
  debit,
  recordCodExpected,
  topUp,
  markCodSettled,
  markCodCancelled
};
