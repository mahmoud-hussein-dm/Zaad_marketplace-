const ARABIC_DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED]/g;

const ARABIC_CHAR_MAP = {
  '\u0622': '\u0627',
  '\u0623': '\u0627',
  '\u0625': '\u0627',
  '\u0624': '\u0648',
  '\u0626': '\u064A',
  '\u06C0': '\u0647',
  '\u06CC': '\u064A',
  '\u0649': '\u064A'
};

function normalizeArabic(input = '') {
  return input
    .replace(ARABIC_DIACRITICS, '')
    .split('')
    .map((ch) => ARABIC_CHAR_MAP[ch] || ch)
    .join('')
    .toLowerCase();
}

function normalizeText(input = '') {
  return normalizeArabic(input)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function containsForbiddenKeyword(text = '', forbidden = []) {
  const normalized = normalizeText(text);
  return forbidden.find((word) => normalized.includes(normalizeText(word)));
}

module.exports = {
  normalizeArabic,
  normalizeText,
  containsForbiddenKeyword
};
