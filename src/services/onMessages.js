// services/dialogRouter.js
const orchestrator = require('../services/orchestratorService');
const ai = require('../services/aiResponseService');
const messageService = require('../services/messageService');

async function onUserMessage({ sessionId, customerId, content }) {
  const o = await orchestrator.respondToMessage({ sessionId, customerId, content });

  if (o && (o.productList?.length || o.addToCart || o.intent !== 'GENERAL')) {
    await messageService.saveMessage(sessionId, o.aiText, 'ai', 'text', {
      intent: o.intent,
      ...(o.productList?.length ? { kind: 'product_list', items: o.productList } : {}),
      ...(o.addToCart ? { addToCart: o.addToCart } : {})
    });
    return;
  }

  const txt = await ai.getAIResponse(content, sessionId, { intent: o?.intent || 'GENERAL' });
  await messageService.saveMessage(sessionId, txt, 'ai', 'text', { intent: o?.intent || 'GENERAL' });
}

module.exports = { onUserMessage };
