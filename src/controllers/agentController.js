// controllers/agentController.js
const chatService = require('../services/chatservice');        // session lookups
const messageService = require('../services/messageService');  // message persistence
const AgentService = require('../services/agentService');
const agentService = new AgentService(); // Instantiate the class
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

      console.log(`[Controller] Processing chat request for customer: ${customerId}, session: ${sessionId}`);

      // 2) Let the agent respond (intent routing + catalog + vectors + context)
      const out = await agentService.respond({ sessionId, customerId, text });
      
      // ADD DEBUG LOG TO SEE WHAT AGENT SERVICE RETURNS
      console.log('[Controller] Agent service result:', JSON.stringify(out, null, 2));

      // Extract cartData and orderData first
      const cartData = (() => {
        if (out?.cartData && typeof out.cartData === 'object') {
          return out.cartData;
        }
        return null;
      })();

      const orderData = (() => {
        if (out?.orderData && typeof out.orderData === 'object') {
          return out.orderData;
        }
        return null;
      })();

      // Extract aiText properly - don't override empty strings for interactive components
      const aiText = (() => {
        if (typeof out?.aiText === 'object' && out.aiText?.text) {
          // If aiText is a cart object, extract the text field
          return out.aiText.text;
        }
        // If aiText is defined (including empty string), use it as-is
        if (out?.aiText !== undefined) {
          return out.aiText;
        }
        // Only use fallback if no interactive data is present
        if (!orderData && !cartData && !out?.payment) {
          return "Sorry, I didn't catch that. Could you rephrase?";
        }
        // Return empty string for interactive components
        return "";
      })();

      // Extract other fields
      const intent      = toStr(out?.intent) || 'GENERAL';
      const productList = Array.isArray(out?.productList) ? out.productList : [];
      const addToCart   = out?.addToCart && typeof out.addToCart === 'object' ? out.addToCart : null;
      const payment     = out?.payment && typeof out.payment === 'object' ? out.payment : null;
      const extraMeta   = out?.meta && typeof out.meta === 'object' ? out.meta : {};

      // 3) Skip message persistence to avoid foreign key errors
      console.log('[Controller] Message persistence disabled to avoid database errors');

      const finalResponse = {
        success: true,
        data: {
          userMessage: 'processed',
          aiMessage: 'generated',
          aiText,
          intent,
          productList,
          addToCart,
          cartData,
          orderData, 
          payment,
          meta: extraMeta
        }
      };
      
      // ADD DEBUG LOG TO SEE FINAL RESPONSE
      console.log('[Controller] Final response:', JSON.stringify(finalResponse, null, 2));

      return res.status(200).json(finalResponse);
    } catch (err) {
      console.error('[Controller] Chat error:', err);
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * POST /api/v1/chat/reindex
   * Rebuilds product embeddings (pgvector) from your products table.
   */
  async reindex(req, res, next) {
    try {
      const result = await reindexAllProducts(); // { ok, fail, total }
      return res.status(200).json({
        success: true,
        data: result,
        message: 'Embeddings rebuilt'
      });
    } catch (err) {
      console.error('[Controller] Reindex error:', err);
      return res.status(500).json({
        success: false,
        error: 'Reindex failed'
      });
    }
  }
}

module.exports = new AgentController();