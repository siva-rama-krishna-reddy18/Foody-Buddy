// services/agentService.js
const { classifyIntent, extractSlots, needsProductRAG } = require('./intentService');
const { respondToMessage } = require('./orchestratorService');
const { searchSimilar } = require('./vectorService');
const aiResponseService = require('./aiResponseService');

function buildContextFromHits(hits) {
  return hits.map(h => {
    const m = h.metadata || {};
    const price = m.price ? `$${m.price}` : '';
    const line1 = `• ${h.owner_id}: ${price}`;
    return `${line1}\n${h.content}`;
  });
}

function extractAction(jsonish) {
  try {
    const m = jsonish.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const obj = JSON.parse(m[0]);
    if (obj && obj.action) return obj;
  } catch (_) {}
  return null;
}

async function respond({ sessionId, customerId, text }) {
  return respondToMessage({ sessionId, customerId, content: text });
}

async function respond({ sessionId, customerId, text }) {
  const { intent, confidence } = await classifyIntent(text);
  const slots = await extractSlots(text);

  let context = [];
  if (needsProductRAG(intent)) {
    const hits = await searchSimilar({ query: text, k: 6, ownerType: 'product' });
    context = ['Related menu items:', ...buildContextFromHits(hits)];
  }

  // Strong rules already live in your aiResponseService system prompt
  const aiText = await aiResponseService.getAIResponse(text, sessionId, {
    intent,
    context
  });

  const action = extractAction(aiText);

  return { intent, confidence, slots, aiText, action };
}

module.exports = { respond };
