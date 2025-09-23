const { readDatabase, updateDatabase } = require('../utils/dataStore');
const { ensureRole } = require('./userService');
const walletService = require('./walletService');

function requireAdmin(userId) {
  if (!ensureRole(userId, 'ADMIN') && !ensureRole(userId, 'REVIEWER')) {
    throw new Error('admin-only');
  }
}

function summarizeDashboard(actorId) {
  requireAdmin(actorId);
  const { listings, users, moderationQueue, disputes, orders, ledger, config } = readDatabase();
  const flaggedListings = listings.filter((listing) => listing.status === 'FLAGGED');
  const pendingModeration = moderationQueue.filter((item) => item.status === 'PENDING');
  const openDisputes = disputes.filter((item) => item.status === 'OPEN' || item.status === 'UNDER_REVIEW');
  const bumpRevenue = ledger
    .filter((entry) => entry.reason === 'BUMP')
    .reduce((total, entry) => total + Number(entry.amountSDG), 0);

  const deliveredOrders = orders.filter((order) => order.status === 'DELIVERED_CONFIRMED');
  const gmvCodExpected = orders
    .filter((order) => ['PLACED', 'AWAITING_HANDOVER', 'DELIVERED_CONFIRMED'].includes(order.status))
    .reduce((total, order) => total + Number(order.priceSDG), 0);

  const confirmationLags = deliveredOrders
    .map((order) => {
      const placed = order.timeline.find((step) => step.status === 'PLACED');
      const delivered = order.timeline.find((step) => step.status === 'DELIVERED_CONFIRMED');
      if (!placed || !delivered) {
        return 0;
      }
      return new Date(delivered.at) - new Date(placed.at);
    })
    .filter(Boolean);
  const averageLagHours = confirmationLags.length
    ? Math.round(
        confirmationLags.reduce((total, lag) => total + lag, 0) /
          confirmationLags.length /
          (60 * 60 * 1000)
      )
    : 0;

  const cancellations = orders.filter((order) => order.status === 'CANCELLED');
  const cancellationRate = orders.length ? (cancellations.length / orders.length).toFixed(2) : '0.00';

  const sellerActivityCutoff = Date.now() - 24 * 60 * 60 * 1000;
  const activeSellers = new Set(
    listings
      .filter((listing) => new Date(listing.updatedAt).getTime() >= sellerActivityCutoff)
      .map((listing) => listing.sellerId)
  );

  return {
    flaggedListings,
    pendingModeration,
    openDisputes,
    metrics: {
      bumpRevenue,
      gmvCodExpected,
      averageLagHours,
      cancellationRate: Number(cancellationRate),
      dailyActiveSellers: activeSellers.size,
      usdSdgRate: config.usdSdgRate
    },
    users: users.map((user) => ({
      id: user.id,
      name: user.name,
      strikes: user.strikes,
      roles: user.roles
    }))
  };
}

function resolveDispute(disputeId, actorId, payload) {
  requireAdmin(actorId);
  return updateDatabase((db) => {
    const disputeIndex = db.disputes.findIndex((item) => item.id === disputeId);
    if (disputeIndex === -1) {
      throw new Error('dispute-not-found');
    }
    const dispute = db.disputes[disputeIndex];
    db.disputes[disputeIndex].status = 'RESOLVED';
    db.disputes[disputeIndex].resolution = payload.resolution;
    db.disputes[disputeIndex].updatedAt = new Date().toISOString();

    const orderIndex = db.orders.findIndex((item) => item.id === dispute.orderId);
    if (orderIndex !== -1) {
      db.orders[orderIndex].status = payload.orderStatus || 'RESOLVED';
      db.orders[orderIndex].timeline.push({
        status: 'RESOLVED',
        at: new Date().toISOString(),
        note: payload.resolution
      });
      db.orders[orderIndex].updatedAt = new Date().toISOString();
    }

    if (payload.outcome === 'buyer_refund' && orderIndex !== -1) {
      walletService.markCodCancelled(db.orders[orderIndex].sellerId, dispute.orderId);
    }

    return db.disputes[disputeIndex];
  });
}

module.exports = {
  summarizeDashboard,
  resolveDispute
};
