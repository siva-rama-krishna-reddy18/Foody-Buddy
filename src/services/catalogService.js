// src/services/catalogService.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TZ = 'America/Chicago';

// ---------- tiny utils ----------
function toArr(x) {
  if (!x) return [];
  if (Array.isArray(x)) return x;
  if (typeof x === 'string') {
    try {
      const j = JSON.parse(x);
      if (Array.isArray(j)) return j;
    } catch (_) {}
    return x.split(',').map(s => s.trim()).filter(Boolean);
  }
  return [];
}
function normPrice(p) {
  if (p == null) return null;
  const n = Number(p);
  return Number.isFinite(n) ? n : null;
}
function normalizeDay(date = new Date()) {
  return date.toLocaleString('en-US', { weekday: 'long', timeZone: TZ }).toLowerCase();
}

// ---------- tag helpers ----------
const DISH_TYPES = {
  biryani: [/biryani|biriyani/i],
  mandi: [/mandi/i],
  curry: [/korma|masala\b|dal\b|chana|palak|sambar|curry/i],
  roti: [/roti|naan|paratha|bread/i],
  snack: [/samosa|cutlet|croquette|fritter|pakora|chaat|fries|bhel|jamun|laddu/i],
  indoChinese: [/manchurian|fried\s*rice|chilli\s*paneer/i],
  beverage: [/lassi|soft\s*drinks?|water\s*bottle|tea/i],
};
function isDealName(name = '') {
  return /buy\s*one\s*get\s*one|bogo|family\s*pack|buy\s*1\s*and\s*get\s*1/i.test(name);
}
function isNoiseName(name = '') {
  return /sample|testing|pre-?\s*order|tip(s)?/i.test(name);
}
function isVeg(p) {
  const name = (p.name || '').toLowerCase();
  const bad = /\b(chicken|goat|mutton|fish|egg|eggs?)\b/i;
  if (bad.test(name)) return false;
  if (Array.isArray(p.ingredients) && p.ingredients.some(i => bad.test(String(i)))) return false;
  if (/non[-\s]*veg/i.test(name)) return false;
  return true;
}
function detectDishTypes(p) {
  const name = p.name || '';
  const types = [];
  for (const [k, regs] of Object.entries(DISH_TYPES)) {
    if (regs.some(rx => rx.test(name))) types.push(k);
  }
  if (!types.length && /masala|dal|curry|korma/i.test(p.description || '')) types.push('curry');
  return types;
}
function availableToday(p, day) {
  if (!Array.isArray(p.availableDays) || p.availableDays.length === 0) return true;
  return p.availableDays.map(d => String(d).toLowerCase()).includes(day);
}
function buildTags(p, day) {
  const name = p.name || '';
  return {
    veg: isVeg(p),
    dishTypes: detectDishTypes(p),
    isDeal: isDealName(name) || Number(p.price) === 0,
    isNoise: isNoiseName(name),
    availableToday: availableToday(p, day),
  };
}

// ---------- DB load & normalize ----------
function normalizeProductRow(r) {
  return {
    id: r.id,
    name: r.name ?? r.title ?? '',
    description: r.description ?? null,
    price: normPrice(r.price),
    availableDays: toArr(r.availableDays),
    ingredients: toArr(r.ingredients),
    groups: toArr(r.groups),
    category: r.category ?? null,
  };
}

async function loadProductsFromDb() {
  // Prefer singular model; fall back to plural if it exists in your schema
  try {
    const rows = await prisma.product.findMany(); // no select → avoid missing-field errors
    return rows.map(normalizeProductRow);
  } catch (_) {
    if (prisma.products?.findMany) {
      const rows = await prisma.products.findMany();
      return rows.map(normalizeProductRow);
    }
    throw _;
  }
}

// ---------- group filter ----------
function passesGroup(p, groupId) {
  if (!groupId) return true;
  const groups = p.groups || [];
  if (!groups.length) return true;

  if (groups.includes(`-${groupId}`)) return false;       // explicit exclusion
  if (groups.includes(groupId)) return true;              // explicit inclusion
  if (groups.includes('community')) return true;          // global group

  // If there are only negative flags and none match, hide it
  const hasPositive = groups.some(g => !String(g).startsWith('-'));
  return hasPositive; // show only if some positive tag exists
}

// ---------- public API ----------
async function getCatalog({ groupId = null, day = normalizeDay() } = {}) {
  const raw = await loadProductsFromDb();
  return raw
    .filter(p => passesGroup(p, groupId))
    .map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      price: p.price,
      tags: buildTags(p, day),
      raw: p,
    }));
}

module.exports = { getCatalog, normalizeDay, buildTags };
