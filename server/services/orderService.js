const { readDatabase, updateDatabase } = require('../utils/dataStore');
const { decorateListing } = require('./listingService');
const { generateId } = require('../utils/id');
const walletService = require('./walletService');
const { pushNotification } = require('./notificationService');

const ORDER_TRANSITIONS = {
  PLACED: ['AWAITING_HANDOVER', 'CANCELLED', 'DISPUTED'],
  AWAITING_HANDOVER: ['DELIVERED_CONFIRMED', 'DISPUTED', 'CANCELLED'],
  DELIVERED_CONFIRMED: [],
  DISPUTED: ['RESOLVED'],
  CANCELLED: []
};

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function decorateOrder(order, locale = 'ar') {
  const { users, disputes, listings } = readDatabase();
  const buyer = users.find((user) => user.id === order.buyerId);
  const seller = users.find((user) => user.id === order.sellerId);
  const listingRecord = listings.find((item) => item.id === order.listingId) || null;
  const listing = listingRecord ? decorateListing(listingRecord, locale) : null;
  const dispute = disputes.find((item) => item.orderId === order.id) || null;
  return {
    ...order,
    buyer: buyer ? { id: buyer.id, name: buyer.name, phone: buyer.phone } : null,
    seller: seller ? { id: seller.id, name: seller.name, phone: seller.phone } : null,
    listing,
    dispute
  };
}

function createOrder(listingId, buyerId) {
  const { listings } = readDatabase();
  const listing = listings.find((item) => item.id === listingId);
  if (!listing) {
    throw new Error('listing-not-found');
  }
  if (listing.status !== 'PUBLISHED') {
    throw new Error('listing-unavailable');
  }
  if (listing.sellerId === buyerId) {
    throw new Error('seller-cannot-buy');
  }

  const otp = generateOtp();

  const order = {
    id: generateId('order'),
    buyerId,
    sellerId: listing.sellerId,
    listingId,
    priceSDG: listing.priceSDG,
    priceUSD: listing.priceUSD,
    deliveryMethod: 'seller-arranged-COD',
    status: 'PLACED',
    otp,
    timeline: [
      { status: 'PLACED', at: new Date().toISOString(), note: 'order-created' }
    ],
    disputeId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  walletService.recordCodExpected(listing.sellerId, listing.priceSDG, order.id);

  return updateDatabase((db) => {
    db.orders.push(order);
    const listingIndex = db.listings.findIndex((item) => item.id === listingId);
    if (listingIndex !== -1) {
      db.listings[listingIndex].status = 'PUBLISHED';
      db.listings[listingIndex].updatedAt = new Date().toISOString();
    }
    pushNotification(listing.sellerId, 'ORDER', {
      orderId: order.id,
      message: 'new-order-placed'
    });
    pushNotification(buyerId, 'ORDER', {
      orderId: order.id,
      message: 'order-created',
      otp
    });
    return order;
  });
}

function getOrders(filter = {}, locale = 'ar') {
  const { orders } = readDatabase();
  let result = orders;
  if (filter.userId && filter.role === 'buyer') {
    result = result.filter((order) => order.buyerId === filter.userId);
  }
  if (filter.userId && filter.role === 'seller') {
    result = result.filter((order) => order.sellerId === filter.userId);
  }
  return result
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((order) => decorateOrder(order, locale));
}

function advanceStatus(orderId, actorId, payload = {}) {
  return updateDatabase((db) => {
    const index = db.orders.findIndex((order) => order.id === orderId);
    if (index === -1) {
      throw new Error('order-not-found');
    }
    const order = db.orders[index];
    let actorRole;
    if (actorId === order.sellerId) {
      actorRole = 'seller';
    } else if (actorId === order.buyerId) {
      actorRole = 'buyer';
    } else {
      throw new Error('forbidden');
    }
    const nextStatus = payload.status;
    if (!nextStatus || !ORDER_TRANSITIONS[order.status]?.includes(nextStatus)) {
      throw new Error('invalid-transition');
    }
    if (nextStatus === 'AWAITING_HANDOVER' && actorRole !== 'seller') {
      throw new Error('only-seller-can-advance');
    }
    if (nextStatus === 'DELIVERED_CONFIRMED') {
      if (actorRole !== 'buyer') {
        throw new Error('only-buyer-can-confirm');
      }
      if (order.otp !== payload.otp) {
        throw new Error('invalid-otp');
      }
      walletService.markCodSettled(order.sellerId, order.id);
      const listingIndex = db.listings.findIndex((item) => item.id === order.listingId);
      if (listingIndex !== -1) {
        db.listings[listingIndex].status = 'SOLD';
        db.listings[listingIndex].updatedAt = new Date().toISOString();
      }
    }
    db.orders[index].status = nextStatus;
    db.orders[index].timeline = order.timeline.concat({
      status: nextStatus,
      at: new Date().toISOString(),
      note: payload.note || null
    });
    db.orders[index].updatedAt = new Date().toISOString();

    pushNotification(order.sellerId, 'ORDER', {
      orderId: order.id,
      message: `status-${nextStatus}`
    });
    pushNotification(order.buyerId, 'ORDER', {
      orderId: order.id,
      message: `status-${nextStatus}`
    });

    return db.orders[index];
  });
}

function openDispute(orderId, actorId, payload) {
  const { orders } = readDatabase();
  const order = orders.find((item) => item.id === orderId);
  if (!order) {
    throw new Error('order-not-found');
  }
  if (actorId !== order.buyerId && actorId !== order.sellerId) {
    throw new Error('forbidden');
  }
  return updateDatabase((db) => {
    const existing = db.disputes.find((item) => item.orderId === orderId);
    if (existing) {
      return existing;
    }
    const dispute = {
      id: generateId('dispute'),
      orderId,
      party: actorId === order.buyerId ? 'buyer' : 'seller',
      reason: payload.reason,
      evidence: payload.evidence || [],
      status: 'OPEN',
      resolution: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.disputes.push(dispute);
    const orderIndex = db.orders.findIndex((item) => item.id === orderId);
    if (orderIndex !== -1) {
      db.orders[orderIndex].status = 'DISPUTED';
      db.orders[orderIndex].disputeId = dispute.id;
      db.orders[orderIndex].timeline.push({
        status: 'DISPUTED',
        at: new Date().toISOString(),
        note: payload.reason
      });
    }
    pushNotification(order.sellerId, 'DISPUTE', {
      orderId,
      message: 'dispute-opened'
    });
    pushNotification(order.buyerId, 'DISPUTE', {
      orderId,
      message: 'dispute-opened'
    });
    return dispute;
  });
}

module.exports = {
  createOrder,
  getOrders,
  advanceStatus,
  openDispute,
  decorateOrder
};
