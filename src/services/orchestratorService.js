// src/services/orchestratorService.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const { searchSimilar } = require('./vectorService');
const { getCatalog, normalizeDay } = require('./catalogService');
const { classify } = require('./intentService');
const ai = require('./aiResponseService'); // fallback only for small talk/general

// ---------- utils ----------
function sanitize(out) {
  if (!out) return '';
  return out
    .replace(/<\|assistant\|>|<\|user\|>|<\|system\|>|\[\/ASSIST\]|\[\/USER\]/gi, '')
    .split(/\n(?:User:|You:|Human:)/)[0]
    .trim();
}

function listToMessage(products, label = 'items') {
  if (!products.length) {
    return { aiText: `I can’t find ${label} available right now. Want to try another category?`, productList: [] };
  }
  const lines = products.slice(0, 10).map(p =>
    `• ${p.name}${p.price != null ? ` — $${Number(p.price)}` : ''}`
  );
  return {
    aiText:
      `Here are some ${label} from FoodyBuddy:\n` +
      lines.join('\n') +
      `\n\nTell me which one you’d like and the quantity.`,
    productList: products.slice(0, 10).map(p => ({
      id: p.id, title: p.name, price: p.price, category: 'Indian'
    }))
  };
}

// Prefer spelled numbers; scrub size/units like "16 oz" before reading digits
function extractQuantityFromText(text) {
  const t = (text || '').toLowerCase();
  const spelled = { one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9, ten:10 };

  // explicit “x2” / “2x”
  const xpat = t.match(/\b(?:x\s*(\d{1,2})|(\d{1,2})\s*x)\b/);
  if (xpat) return Math.max(1, parseInt(xpat[1] || xpat[2], 10));

  // spelled-out wins over digits
  for (const [w,n] of Object.entries(spelled)) {
    if (new RegExp(`\\b${w}\\b`, 'i').test(t)) return n;
  }

  // scrub units/sizes
  const scrub = t
    .replace(/\b\d+\s?(?:oz|ounce|ounces|ml|g|kg|lb|lbs|pound|pounds|litre|liter|ltr)\b/gi, '')
    .replace(/\bpack(?:\s*of)?\s*\d+\b/gi, '')
    .replace(/\b\d+\s?(?:pc|pcs|piece|pieces)\b/gi, '');

  const m = scrub.match(/\b(\d{1,2})\b/);
  return m ? Math.max(1, parseInt(m[1], 10)) : 1;
}

function keepRelevant(rows) {
  // remove $0/testing/samples/tips & de-dupe by name
  let out = rows.filter(r => {
    const priceOk = r.price == null ? true : Number(r.price) > 0;
    const notNoise = !(r.tags?.isNoise);
    return priceOk && notNoise;
  });
  const seen = new Set();
  out = out.filter(r => {
    const k = (r.name || '').trim().toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return out;
}

function scoreCandidate(name, tokens) {
  const n = (name || '').toLowerCase();
  let s = 0;
  for (const t of tokens) if (t.length > 2 && n.includes(t)) s += 1;
  // phrase bonuses
  if (/\bpaneer\b.*\btikka\b.*\bmasala\b/.test(n)) s += 5;
  if (/\bchicken\b.*\btikka\b.*\bmasala\b/.test(n)) s += 3;
  if (/\bchicken\b.*\bmandi\b/.test(n)) s += 3;
  if (/\bchicken\b.*\bbiryani\b/.test(n)) s += 3;
  if (/\bveg\b.*\bbiryani\b/.test(n)) s += 2;
  if (/\bpaneer\b.*\bbiryani\b/.test(n)) s += 2;
  return s;
}

// ---------- history + cart ----------
async function fetchMessagesDesc(sessionId, limit = 20) {
  // Try snake_case table
  try {
    return await prisma.messages.findMany({
      where: { session_id: sessionId },
      orderBy: { created_at: 'desc' },
      take: limit,
      select: { sender: true, content: true, metadata: true, created_at: true }
    });
  } catch (_) {
    // Fallback singular
    return await prisma.message.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { sender: true, content: true, metadata: true, createdAt: true }
    });
  }
}

async function fetchMessagesAsc(sessionId) {
  try {
    return await prisma.messages.findMany({
      where: { session_id: sessionId, sender: 'ai' },
      orderBy: { created_at: 'asc' },
      select: { metadata: true }
    });
  } catch (_) {
    return await prisma.message.findMany({
      where: { sessionId, sender: 'ai' },
      orderBy: { createdAt: 'asc' },
      select: { metadata: true }
    });
  }
}

async function getLastContext(sessionId, limit = 20) {
  const msgs = await fetchMessagesDesc(sessionId, limit);
  const aiMsg = msgs.find(m => m.sender === 'ai');
  const md = aiMsg?.metadata || {};
  const lastIntent = md.intent || null;
  const lastList = md.kind === 'product_list' ? (md.items || []) : [];
  const lastAdd = md.addToCart || null;
  return { lastIntent, lastList, lastAdd };
}

async function getCartFromHistory(sessionId) {
  const msgs = await fetchMessagesAsc(sessionId);
  const cart = new Map(); // productId -> {title, qty}
  for (const m of msgs) {
    const add = m?.metadata?.addToCart;
    if (add && add.productId) {
      const prev = cart.get(add.productId) || { title: add.title, qty: 0 };
      prev.qty += Number(add.quantity || 1);
      cart.set(add.productId, prev);
    }
  }
  return [...cart.entries()].map(([productId, v]) => ({ productId, title: v.title, quantity: v.qty }));
}

// ---------- optional: group by last order ----------
async function getUserGroupId(customerId) {
  try {
    const last = await prisma.orders.findFirst({
      where: { customer_id: customerId },
      orderBy: { created_at: 'desc' },
      select: { group_id: true }
    });
    if (last?.group_id) return last.group_id;
  } catch (_) {}
  try {
    const last = await prisma.order.findFirst({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      select: { groupId: true }
    });
    return last?.groupId || null;
  } catch (_) {
    return null;
  }
}

// ---------- flows ----------
async function handleList(filters, customerId) {
  const day = normalizeDay();
  const groupId = await getUserGroupId(customerId); // optional grouping
  const catalog = await getCatalog({ groupId, day });
  let rows = catalog;

  if (filters?.vegetarian) rows = rows.filter(r => r.tags?.veg);
  if (filters?.nonveg) rows = rows.filter(r => r.tags && !r.tags.veg);

  const wantTypes = new Set(filters?.dishTypes || []);
  if (wantTypes.size) rows = rows.filter(r => r.tags?.dishTypes?.some(t => wantTypes.has(t)));

  // prefer today's items (availableDays)
  rows = rows.filter(r => r.tags?.availableToday !== false);

  rows = keepRelevant(rows)
    .sort((a, b) => (a.price ?? 9e9) - (b.price ?? 9e9));

  const labelParts = [];
  if (filters?.vegetarian) labelParts.push('vegetarian');
  if (wantTypes.size) labelParts.push([...wantTypes].join('/'));
  const label = labelParts.length ? labelParts.join(' ') : 'popular items';

  return listToMessage(
    rows.slice(0, 10).map(r => ({ id: r.id, name: r.name, price: r.price })),
    label
  );
}

async function handleDeals(customerId) {
  const day = normalizeDay();
  const groupId = await getUserGroupId(customerId);
  const catalog = await getCatalog({ groupId, day });

  const deals = keepRelevant(catalog.filter(p => p.tags?.isDeal));
  return listToMessage(
    deals.map(p => ({ id: p.id, name: p.name, price: p.price })),
    'current deals'
  );
}

async function handleRecommend(customerId) {
  const day = normalizeDay();
  const groupId = await getUserGroupId(customerId);
  const catalog = await getCatalog({ groupId, day });

  const picks = [];
  const addType = (type, limit = 2) => {
    const items = catalog.filter(p => p.tags?.dishTypes?.includes(type)).slice(0, limit);
    picks.push(...items);
  };
  addType('biryani', 2);
  addType('curry', 3);
  addType('snack', 2);

  const uniq = Array.from(new Map(picks.map(p => [p.id, p])).values());
  return listToMessage(
    uniq.map(p => ({ id: p.id, name: p.name, price: p.price })),
    'popular picks'
  );
}

function suggestAlternatives(prefix, catalog) {
  const biryani = catalog.filter(p => p.tags?.dishTypes?.includes('biryani')).slice(0, 4);
  const curry   = catalog.filter(p => p.tags?.dishTypes?.includes('curry')).slice(0, 3);
  const snack   = catalog.filter(p => p.tags?.dishTypes?.includes('snack')).slice(0, 3);
  const picks = [...biryani, ...curry, ...snack];

  if (!picks.length) return { aiText: `${prefix} What sounds good—biryani, curry, or snacks?`, productList: [] };

  return listToMessage(
    picks.map(p => ({ id:p.id, name:p.name, price:p.price })),
    'popular picks we do have'
  );
}

async function handleAddToCart(content, customerId) {
  const quantity = extractQuantityFromText(content);
  const t = (content || '').toLowerCase();
  const tokens = t.match(/[a-z0-9]+/g) || [];

  const day = normalizeDay();
  const groupId = await getUserGroupId(customerId);
  const catalogAll = await getCatalog({ groupId, day });
  const catalog = keepRelevant(catalogAll.filter(r => r.tags?.availableToday !== false));

  // hard block for totally out-of-menu asks (pizza, etc.)
  if (/\b(pizza|burger|pasta|sushi|taco)s?\b/i.test(t)) {
    return suggestAlternatives('We don’t have that item on our menu.', catalog);
  }

  // candidate search by tokens
  let candidates = catalog.filter(p =>
    tokens.slice(0, 4).some(tok => (p.name || '').toLowerCase().includes(tok))
  );

  // bias by dish type keywords
  if (/birya?ni/.test(t)) candidates = candidates.filter(p => p.tags?.dishTypes?.includes('biryani'));
  if (/mandi/.test(t))    candidates = candidates.filter(p => p.tags?.dishTypes?.includes('mandi'));
  if (/tikka|masala|butter chicken|korma|dal|chana|palak|sambar/.test(t))
    candidates = candidates.filter(p => p.tags?.dishTypes?.includes('curry'));

  if (candidates.length) {
    candidates.sort((a, b) => scoreCandidate(b.name, tokens) - scoreCandidate(a.name, tokens));
  } else if (/(biryani|mandi|tikka|korma|dal|chana|palak|sambar|samosa|manchurian)/i.test(t) && typeof searchSimilar === 'function') {
    try {
      const hits = await searchSimilar({ query: t, k: 5, ownerType: 'product' });
      const hitIds = new Set((hits || []).map(h => h.owner_id));
      candidates = catalog.filter(p => hitIds.has(p.id));
    } catch (_) { /* ignore vector errors */ }
  }

  const item = candidates[0];
  if (!item) return suggestAlternatives("I couldn't find that item in our menu.", catalog);

  return {
    aiText: `Added **${quantity} × ${item.name}** to your cart. Want anything else or should I proceed to checkout?`,
    productList: [],
    addToCart: { productId: item.id, title: item.name, quantity }
  };
}

async function handleCheckout(sessionId, customerId) {
  const cart = await getCartFromHistory(sessionId);
  if (!cart.length) {
    return {
      aiText: "Your cart is empty right now. Tell me what you'd like to order, and I’ll add it!",
      productList: [],
    };
  }
  const lines = cart.map(i => `• ${i.title} × ${i.quantity}`).join('\n');
  return {
    aiText: `Great—here’s your cart:\n${lines}\n\nPickup or delivery?`,
    productList: [],
  };
}

// ---------- main router ----------
async function respondToMessage({ sessionId, customerId, content }) {
  const { intent, filters } = classify(content);

  switch (intent) {
    case 'GREETING':
      return { aiText: "Welcome to FoodyBuddy! What can I get started for you today?", productList: [], intent };

    case 'THANKS':
      return { aiText: "You're welcome! Want me to proceed to checkout or add anything else?", productList: [], intent: 'THANKS' };

    case 'SMALL_TALK':
      return { aiText: "All good here! I can help you order—try “veg biryani”, “chicken korma”, or say “deals”.", productList: [], intent: 'SMALL_TALK' };

    case 'LIST_ITEMS':
      return { ...(await handleList(filters, customerId)), intent };

    case 'ASK_DEALS':
      return { ...(await handleDeals(customerId)), intent };

    case 'RECOMMEND':
      return { ...(await handleRecommend(customerId)), intent };

    case 'ADD_TO_CART':
      return { ...(await handleAddToCart(content, customerId)), intent };

    case 'CHECKOUT':
      return { ...(await handleCheckout(sessionId, customerId)), intent };

    case 'AFFIRM': {
      const ctx = await getLastContext(sessionId);
      if (ctx.lastIntent === 'ADD_TO_CART' || ctx.lastAdd) {
        return { ...(await handleCheckout(sessionId, customerId)), intent: 'CHECKOUT' };
      }
      if (ctx.lastIntent === 'LIST_ITEMS' && ctx.lastList.length) {
        return {
          aiText: "Which one from the list would you like and how many?",
          productList: ctx.lastList,
          intent: 'LIST_ITEMS'
        };
      }
      return { aiText: "Got it! What would you like to order?", productList: [], intent: 'GENERAL' };
    }

    case 'NOT_AVAILABLE':
      // reuse addToCart logic to propose alternatives from the real menu
      return { ...(await handleAddToCart(content, customerId)), intent: 'NOT_AVAILABLE' };

    default: {
      // fallback to HF for small talk—but sanitize & avoid hallucinated menus
      const raw = await ai.getAIResponse(content, sessionId, { intent: 'GENERAL' });
      const safe = sanitize(raw);
      const looksLikeMenu = /here are some .* (items|picks|dishes)/i.test(safe);
      const aiText = looksLikeMenu
        ? "I’m here to help you order. Ask for a dish (e.g., “veg biryani”) or say “deals”."
        : (safe || "I can help with the FoodyBuddy menu and ordering. What sounds good?");
      return { aiText, productList: [], intent: 'GENERAL' };
    }
  }
}

module.exports = { respondToMessage };
