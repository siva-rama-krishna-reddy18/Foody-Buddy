// controllers/agentController.js
const chatService = require('../services/chatservice');        // session lookups
const messageService = require('../services/messageService');  // message persistence
const agentService = require('../services/agentService');      // proxy -> orchestrator
const { reindexAllProducts } = require('../services/vectorService'); // vectors admin

function toStr(x) {
  if (x == null) return '';
  return typeof x === 'string' ? x : String(x);
}

class AgentController {
  /**
   * POST /api/v1/chat/chat
   * Body: { sessionId, customerId, text }
   */
  async chat(req, res, next) {
    try {
      const sessionId  = toStr(req.body?.sessionId).trim();
      const customerId = toStr(req.body?.customerId).trim();
      const text       = toStr(req.body?.text).trim();

      if (!sessionId || !customerId || !text) {
        return res.status(400).json({
          success: false,
          error: 'sessionId, customerId, text are required'
        });
      }

      // 1) Authorize session belongs to customer
      const session = await chatService.getSessionById(sessionId);
      if (!session) {
        return res.status(404).json({ success: false, error: 'Session not found' });
      }
      const sessionCustomerId = session.customer_id ?? session.customerId;
      if (sessionCustomerId !== customerId) {
        return res.status(403).json({ success: false, error: 'Access denied for this session' });
      }

      // 2) Persist user message first (history completeness)
      const userMessage = await messageService.saveMessage(
        sessionId,
        text,
        'customer',
        'text',
        null // metadata
      );

      // 3) Let the agent respond (intent routing + catalog + vectors + context)
      const out = await agentService.respond({ sessionId, customerId, text });

      // Enforce shape & defaults
      const aiText      = toStr(out?.aiText) || "Sorry, I didn't catch that. Could you rephrase?";
      const intent      = toStr(out?.intent) || 'GENERAL';
      const productList = Array.isArray(out?.productList) ? out.productList : [];
      const addToCart   = out?.addToCart && typeof out.addToCart === 'object' ? out.addToCart : null;
      const extraMeta   = out?.meta && typeof out.meta === 'object' ? out.meta : null;

      // 4) Persist AI message with structured metadata (drives UI + stateful flow)
      const aiMetadata = {
        intent,
        ...(productList.length ? { kind: 'product_list', items: productList } : {}),
        ...(addToCart ? { addToCart } : {}),
        ...(extraMeta ? { meta: extraMeta } : {}),
      };

      const aiMessage = await messageService.saveMessage(
        sessionId,
        aiText,
        'ai',
        'text',
        aiMetadata
      );

      // 5) Touch session (keeps updated_at fresh; title fallback)
      try {
        await chatService.updateSessionTitle(sessionId, session.title ?? session.id);
      } catch (_) {
        // optional; ignore if your chatService uses a different update method
      }

      return res.status(200).json({
        success: true,
        data: {
          userMessage,
          aiMessage,
          intent,
          productList,
          addToCart
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/chat/reindex
   * Rebuilds product embeddings (pgvector) from your products table.
   */
  async reindex(req, res, next) {
    try {
      // Optional admin guard:
      // if (req.get('x-admin-key') !== process.env.ADMIN_KEY) {
      //   return res.status(403).json({ success: false, error: 'Forbidden' });
      // }

      const result = await reindexAllProducts(); // { ok, fail, total }
      return res.status(200).json({
        success: true,
        data: result,
        message: 'Embeddings rebuilt'
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AgentController();
