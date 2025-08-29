// Map number words to quantities
const NUMBER_WORDS = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

// Common variants of dishes seen in chats (feel free to expand)
const KNOWN_DISHES_RX =
  /\b(chicken\s*tik+?a?\s*masala|paneer\s*tik+?a?\s*masala|palak\s*paneer|aloo\s*gobi|chana\s*(pindi|masala)|biryani|samosa|manchurian|fried\s*rice|korma|dal|sambar|butter\s*chicken|goat\s*curry)\b/i;

function parseQuantity(text) {
  const t = (text || '').toLowerCase();

  // numeric forms: "2", "3x", "2 pcs", "2 pieces"
  const mNum = t.match(/(?:^|\s)(\d{1,2})\s*(?:x|pcs?|pieces?)?\b/);
  if (mNum) return Math.max(1, parseInt(mNum[1], 10));

  // word forms: "one", "two", ...
  const mWord = t.match(new RegExp(`\\b(${Object.keys(NUMBER_WORDS).join('|')})\\b`));
  if (mWord) return NUMBER_WORDS[mWord[1]];

  return 1;
}

/**
 * Light slot extraction for cart flows.
 */
function extractSlots(text) {
  const t = (text || '').toLowerCase();
  const quantity = parseQuantity(t);

  const dishMatch = t.match(KNOWN_DISHES_RX);
  const dish = dishMatch ? dishMatch[0] : null;

  const vegetarian = /\bveg(?:etarian)?\b/i.test(t) && !/\bnon[-\s]*veg\b/i.test(t);
  const nonveg = /\bnon[-\s]*veg\b/i.test(t) || /\b(chicken|goat|mutton|fish|egg|eggs?)\b/i.test(t);

  return { quantity, dish, vegetarian, nonveg };
}

/**
 * Decide if we should hit the product catalog / RAG.
 */
function needsProductRAG(intent) {
  return ['LIST_ITEMS', 'ADD_TO_CART', 'ASK_DEALS', 'RECOMMEND'].includes(intent);
}

/**
 * Core intent classifier used by orchestrator.
 * Returns { intent, filters? }
 */
function classify(text) {
  const t = (text || '').toLowerCase().trim();

  if (/^(hi|hello|hey)\b/.test(t)) return { intent: 'GREETING' };

  // polite closers / acknowledgements
  if (/\b(thanks|thank you|ty|appreciate (it)?|thx)\b/i.test(t)) {
    return { intent: 'THANKS' };
  }

  // simple small talk
  if (/\b(how are you|what'?s up|whats up|how'?s it going)\b/i.test(t)) {
    return { intent: 'SMALL_TALK' };
  }

  // hard block for items we don't sell
  if (/\b(pizza|burger|pasta|sushi|taco)s?\b/i.test(t)) {
    return { intent: 'NOT_AVAILABLE', filters: { queryText: t } };
  }

  const namedDish = /\b(chicken\s*tik+?a?\s*masala|paneer\s*tik+?a?\s*masala|palak\s*paneer|aloo\s*gobi|chana\s*(pindi|masala)|biryani|biriyani|mandi|samosa|manchurian|fried\s*rice|korma|dal|sambar|butter\s*chicken|goat\s*curry)\b/i.test(t);
  const mentionsQty = /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b/i.test(t);
  const orderVerbs  = /\b(add|order|i(?:'| )?ll take|get me|can i get|i want|please give me|give me|take|place|buy|make|prepare)\b/i.test(t);

  if ((orderVerbs || mentionsQty) && namedDish) {
    return { intent: 'ADD_TO_CART', filters: { namedDish: true } };
  }

  if (/\b(check\s*out|checkout|proceed(?:\s*to\s*checkout)?|place (?:the )?order|complete (?:the )?order|pay(?:ment)?)\b/i.test(t)) {
    return { intent: 'CHECKOUT' };
  }

  if (/\b(yes|yeah|yep|sure|okay|ok|please do|go ahead|proceed)\b/i.test(t)) {
    return { intent: 'AFFIRM' };
  }

  // Show menu / list available items
  if (/\b(show|list|available|menu)\b.*\b(dish(?:es)?|menu|items)\b/i.test(t)) {
    return { intent: 'LIST_ITEMS', filters: { queryText: t } };
  }

  // Deals
  if (/deal|promo|offer|bogo|buy\s*one\s*get\s*one/i.test(t)) {
    return { intent: 'ASK_DEALS' };
  }

  // Dietary / dish types
  const vegetarian = /\bveg(?:etarian)?\b/i.test(t) && !/\bnon[-\s]*veg\b/i.test(t);
  const nonveg = /\bnon[-\s]*veg\b/i.test(t) || /\b(chicken|goat|mutton|fish|egg|eggs?)\b/i.test(t);
  const dishTypes = [];
  if (/\bbirya?ni\b/i.test(t)) dishTypes.push('biryani');
  if (/\bmandi\b/i.test(t)) dishTypes.push('mandi');
  if (/\bcurry|masala|korma|butter chicken|dal|chana|palak|sambar\b/i.test(t)) dishTypes.push('curry');
  if (/\broti|naan|paratha|bread\b/i.test(t)) dishTypes.push('roti');

  if (vegetarian || nonveg || namedDish || dishTypes.length || /\bindian\b/.test(t)) {
    return { intent: 'LIST_ITEMS', filters: { vegetarian, nonveg, namedDish, dishTypes, queryText: t } };
  }

  return { intent: 'GENERAL' };
}
/**
 * Optional: intent with a coarse confidence for agentService.
 */
function classifyIntent(text) {
  const out = classify(text);
  let confidence = 0.6;

  switch (out.intent) {
    case 'GREETING': confidence = 0.95; break;
    case 'ASK_DEALS': confidence = 0.85; break;
    case 'ADD_TO_CART': confidence = 0.9; break;
    case 'LIST_ITEMS': confidence = 0.8; break;
    default: confidence = 0.6;
  }

  return { intent: out.intent, confidence, filters: out.filters || null };
}

module.exports = {
  // keep prior exports used by orchestrator
  classify,
  parseQuantity,

  // additional exports expected by agentService
  classifyIntent,
  extractSlots,
  needsProductRAG,
};
