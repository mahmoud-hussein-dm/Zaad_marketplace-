const { containsForbiddenKeyword, normalizeText } = require('../utils/strings');
const { readDatabase, updateDatabase } = require('../utils/dataStore');
const { generateId } = require('../utils/id');

function scanListing(listingInput) {
  const { config, listings } = readDatabase();
  const forbiddenMatches = [];
  const fieldsToInspect = [listingInput.title, listingInput.description]
    .concat(listingInput.tags || [])
    .filter(Boolean)
    .map((value) => (typeof value === 'string' ? value : JSON.stringify(value)));

  for (const text of fieldsToInspect) {
    const match = containsForbiddenKeyword(text, config.forbiddenKeywords || []);
    if (match) {
      forbiddenMatches.push(match);
    }
  }

  const normalizedPhotos = Array.isArray(listingInput.photos) ? listingInput.photos.filter(Boolean) : [];
  const duplicatePhoto = normalizedPhotos.find((photo, index) =>
    normalizedPhotos.indexOf(photo) !== index
  );

  const similarListings = listings.filter(
    (item) =>
      item.sellerId === listingInput.sellerId &&
      normalizeText(item.title.ar || item.title.en || '') ===
        normalizeText(listingInput.title)
  );

  const riskSignals = [];
  if (forbiddenMatches.length) {
    riskSignals.push({ type: 'forbidden-keyword', matches: [...new Set(forbiddenMatches)] });
  }
  if (duplicatePhoto) {
    riskSignals.push({ type: 'duplicate-photo', sample: duplicatePhoto });
  }
  if (similarListings.length > 3) {
    riskSignals.push({ type: 'duplicate-listing', count: similarListings.length });
  }

  const shouldBlock = riskSignals.some((signal) => signal.type === 'forbidden-keyword');

  return {
    blocked: shouldBlock,
    riskSignals,
    action: shouldBlock ? 'queue-review' : riskSignals.length ? 'soft-review' : 'allow'
  };
}

function enqueueModeration(listingId, risk) {
  return updateDatabase((db) => {
    const queueItem = {
      id: generateId('mod'),
      listingId,
      reason: risk.type || 'ai-review',
      aiScores: risk,
      status: 'PENDING',
      reviewerId: null,
      decision: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.moderationQueue.push(queueItem);
    return queueItem;
  });
}

module.exports = {
  scanListing,
  enqueueModeration
};
