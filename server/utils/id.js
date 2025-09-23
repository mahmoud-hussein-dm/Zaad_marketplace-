function randomSegment(length = 6) {
  return Math.random().toString(36).substring(2, 2 + length);
}

function generateId(prefix = 'id') {
  const time = Date.now().toString(36);
  return `${prefix}-${time}-${randomSegment(4)}`;
}

module.exports = {
  generateId
};
