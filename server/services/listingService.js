const { readDatabase, updateDatabase } = require('../utils/dataStore');
const { normalizeText } = require('../utils/strings');
const { smartPricing, checklist, suggestCategory } = require('./aiPricingService');
const { scanListing, enqueueModeration } = require('./aiModerationService');
const { generateId } = require('../utils/id');
const { getConfig } = require('./configService');
const walletService = require('./walletService');
const { pushNotification } = require('./notificationService');

function decorateListing(listing, locale = 'ar') {
  const { users, stores, config, reviews } = readDatabase();
  const seller = users.find((user) => user.id === listing.sellerId);
  const store = stores.find((item) => item.id === listing.storeId);
  const sellerReviews = reviews.filter((review) => review.revieweeId === listing.sellerId);
  const avgRating = sellerReviews.length
    ? sellerReviews.reduce((total, review) => total + review.rating, 0) / sellerReviews.length
    : seller?.rating || null;

  const usdRate = config.usdSdgRate || 600;
  const priceUSD = parseFloat((listing.priceSDG / usdRate).toFixed(2));

  const now = new Date();
  const isItemBumped = listing.bumpedUntil && new Date(listing.bumpedUntil) > now;
  const isStoreBumped = store?.bumpedUntil && new Date(store.bumpedUntil) > now;

  return {
    ...listing,
    title: listing.title?.[locale] || listing.title?.ar || listing.title?.en,
    description: listing.description?.[locale] || listing.description?.ar || listing.description?.en,
    seller: seller
      ? {
          id: seller.id,
          name: seller.name,
          rating: avgRating ? Number(avgRating.toFixed(2)) : null,
          city: seller.city
        }
      : null,
    store: store
      ? {
          id: store.id,
          name: store.name?.[locale] || store.name?.ar || store.name?.en,
          logo: store.logo,
          bumpedUntil: store.bumpedUntil
        }
      : null,
    priceUSD,
    isBumped: Boolean(isItemBumped || isStoreBumped),
    bumpExpiresAt: listing.bumpedUntil,
    storeBumpExpiresAt: store?.bumpedUntil || null
  };
}

function listListings(filters = {}, locale = 'ar') {
  const { listings, config } = readDatabase();
  const now = new Date();
  let result = filters.includeAll ? [...listings] : listings.filter((listing) => listing.status === 'PUBLISHED');

  if (filters.sellerId) {
    result = result.filter((listing) => listing.sellerId === filters.sellerId);
  }

  if (filters.category) {
    result = result.filter((listing) => listing.category === filters.category);
  }

  if (filters.city) {
    result = result.filter((listing) => listing.city === filters.city);
  }

  if (filters.condition) {
    result = result.filter((listing) => listing.condition === filters.condition);
  }

  if (filters.minPrice) {
    result = result.filter((listing) => listing.priceSDG >= Number(filters.minPrice));
  }

  if (filters.maxPrice) {
    result = result.filter((listing) => listing.priceSDG <= Number(filters.maxPrice));
  }

  const query = normalizeText(filters.query || '');
  if (query) {
    result = result.filter((listing) => {
      const title = normalizeText(listing.title.ar || listing.title.en || '');
      const description = normalizeText(listing.description.ar || listing.description.en || '');
      const tags = normalizeText((listing.tags || []).join(' '));
      return title.includes(query) || description.includes(query) || tags.includes(query);
    });
  }

  const decorated = result.map((listing) => decorateListing(listing, locale));

  decorated.sort((a, b) => {
    const aBump = a.isBumped ? new Date(a.bumpExpiresAt || a.storeBumpExpiresAt || 0) : new Date(0);
    const bBump = b.isBumped ? new Date(b.bumpExpiresAt || b.storeBumpExpiresAt || 0) : new Date(0);
    if (aBump.getTime() !== bBump.getTime()) {
      return bBump - aBump;
    }
    if (filters.sort === 'price-asc') {
      return a.priceSDG - b.priceSDG;
    }
    if (filters.sort === 'price-desc') {
      return b.priceSDG - a.priceSDG;
    }
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  return {
    items: decorated,
    total: decorated.length,
    rate: config.usdSdgRate
  };
}

function getListingById(listingId, locale = 'ar') {
  const { listings } = readDatabase();
  const listing = listings.find((item) => item.id === listingId);
  if (!listing) {
    return null;
  }
  return decorateListing(listing, locale);
}

function createListing(input, sellerId) {
  if (!sellerId) {
    throw new Error('missing-seller');
  }
  if (!input.titleAr || !input.descriptionAr || !input.priceSDG || !input.category) {
    throw new Error('missing-fields');
  }
  const config = getConfig();
  const pricing = smartPricing({
    category: input.category,
    condition: input.condition,
    title: input.titleAr
  });
  const qualityChecklist = checklist(input.condition);
  const categorySuggestion = suggestCategory(input.titleAr);

  const moderation = scanListing({
    sellerId,
    title: input.titleAr,
    description: input.descriptionAr,
    tags: input.tags,
    photos: input.photos
  });

  const listing = {
    id: generateId('listing'),
    sellerId,
    storeId: input.storeId || null,
    title: { ar: input.titleAr, en: input.titleEn || input.titleAr },
    description: { ar: input.descriptionAr, en: input.descriptionEn || input.descriptionAr },
    photos: input.photos || [],
    category: input.category || categorySuggestion,
    tags: input.tags || [],
    condition: input.condition || 'GOOD',
    priceSDG: Number(input.priceSDG),
    priceUSD: parseFloat((Number(input.priceSDG) / (config.usdSdgRate || 600)).toFixed(2)),
    city: input.city,
    status: moderation.blocked ? 'FLAGGED' : 'PUBLISHED',
    bumpedUntil: null,
    flags: moderation.blocked ? ['auto-moderation'] : [],
    ai: {
      suggestedCategory: categorySuggestion,
      suggestedPriceMin: pricing.min,
      suggestedPriceMax: pricing.max,
      qualityChecklist
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  return updateDatabase((db) => {
    db.listings.push(listing);
    if (moderation.blocked && moderation.riskSignals.length) {
      moderation.riskSignals.forEach((risk) => enqueueModeration(listing.id, risk));
    }
    return {
      listing,
      moderation,
      pricing
    };
  });
}

function updateListing(listingId, patch, actorId) {
  return updateDatabase((db) => {
    const index = db.listings.findIndex((listing) => listing.id === listingId);
    if (index === -1) {
      throw new Error('listing-not-found');
    }
    if (actorId && db.listings[index].sellerId !== actorId) {
      throw new Error('forbidden');
    }
    db.listings[index] = {
      ...db.listings[index],
      ...patch,
      updatedAt: new Date().toISOString()
    };
    return db.listings[index];
  });
}

function bumpListing(listingId, sellerId) {
  const { config } = readDatabase();
  return updateDatabase((db) => {
    const index = db.listings.findIndex((listing) => listing.id === listingId);
    if (index === -1) {
      throw new Error('listing-not-found');
    }
    const listing = db.listings[index];
    if (listing.sellerId !== sellerId) {
      throw new Error('forbidden');
    }
    const fee = Math.round(listing.priceSDG * (config.itemBumpRate || 0.05));
    walletService.debit(sellerId, fee, 'BUMP', {
      referenceId: listingId,
      kind: 'item',
      durationHours: 72
    });
    const bumpedUntil = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
    db.listings[index].bumpedUntil = bumpedUntil;
    db.listings[index].updatedAt = new Date().toISOString();
    pushNotification(sellerId, 'PROMO', {
      listingId,
      message: 'listing-bumped',
      bumpedUntil
    });
    return {
      listing: db.listings[index],
      fee
    };
  });
}

module.exports = {
  listListings,
  getListingById,
  createListing,
  updateListing,
  bumpListing,
  decorateListing
};
