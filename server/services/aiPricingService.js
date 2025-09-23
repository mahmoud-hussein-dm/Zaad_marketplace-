const { readDatabase } = require('../utils/dataStore');
const { normalizeText } = require('../utils/strings');

function smartPricing({ category, condition, title }) {
  const { listings, config } = readDatabase();
  const cohort = listings.filter((listing) => {
    if (listing.status !== 'PUBLISHED' && listing.status !== 'SOLD') {
      return false;
    }
    const sameCategory = category ? listing.category === category : true;
    const sameCondition = condition ? listing.condition === condition : true;
    const similarTitle = title
      ? normalizeText(listing.title.ar || listing.title.en || '').includes(
          normalizeText(title)
        )
      : true;
    return sameCategory && sameCondition && similarTitle;
  });

  if (!cohort.length) {
    return {
      min: 0,
      max: 0,
      average: 0,
      comparableCount: 0
    };
  }

  const sum = cohort.reduce((total, item) => total + Number(item.priceSDG || 0), 0);
  const avg = sum / cohort.length;
  const min = Math.min(...cohort.map((item) => Number(item.priceSDG || 0)));
  const max = Math.max(...cohort.map((item) => Number(item.priceSDG || 0)));

  return {
    min: Math.round(min * 0.95),
    max: Math.round(max * 1.05),
    average: Math.round(avg),
    comparableCount: cohort.length,
    suggestedUSD: parseFloat((avg / (config.usdSdgRate || 600)).toFixed(2))
  };
}

function checklist(condition) {
  const base = [
    'التقط صوراً واضحة من عدة زوايا',
    'اكتب وصفاً صادقاً يشمل العيوب البسيطة',
    'جهز التغليف المناسب للتسليم'
  ];

  const extrasByCondition = {
    NEW: ['أرفق إثبات الشراء إن وجد'],
    LIKE_NEW: ['اذكر سبب البيع السريع'],
    GOOD: ['بين علامات الاستخدام بوضوح'],
    FAIR: ['حدد ما إذا كانت هناك أعطال تحتاج إلى تصليح'],
    POOR: ['انصح المشتري بما يحتاج إلى استبدال قبل الاستخدام']
  };

  return [...base, ...(extrasByCondition[condition] || [])];
}

function suggestCategory(title) {
  const { config } = readDatabase();
  const normalized = normalizeText(title);
  const rules = [
    { match: ['هاتف', 'iphone', 'جوال', 'mobile'], category: 'electronics' },
    { match: ['فستان', 'dress', 'حقيبة', 'bag'], category: 'women-fashion' },
    { match: ['حذاء', 'sneaker', 'حقيبة رياضية'], category: 'sports' },
    { match: ['طاولة', 'كرسي', 'couch'], category: 'home-garden' },
    { match: ['عطر', 'makeup', 'مكياج'], category: 'beauty' },
    { match: ['طفل', 'رضيع', 'toy'], category: 'kids' }
  ];
  for (const rule of rules) {
    if (rule.match.some((word) => normalized.includes(normalizeText(word)))) {
      return rule.category;
    }
  }
  return config.categories?.[0]?.id || 'women-fashion';
}

module.exports = {
  smartPricing,
  checklist,
  suggestCategory
};
