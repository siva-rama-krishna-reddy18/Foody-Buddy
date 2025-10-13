// src/services/intentService.js
const DEBUG = process.env.NODE_ENV === 'development';

async function classifyIntent(message) {
  try {
    const lowerMessage = message.toLowerCase().trim();
    
    console.log(`[Intent] Classifying: "${message}"`);
    
    // ✅ SILENT CART REQUEST
    if (message === 'get_cart_silent') {
      console.log('[Intent] ✅ SILENT CART REQUEST');
      return 'VIEW_CART';
    }
    
    // ✅ PAYMENT SUCCESS
    if (message === 'PAYMENT_COMPLETE_CREATE_ORDER') {
      console.log('[Intent] ✅ EXACT MATCH: PAYMENT_COMPLETE_CREATE_ORDER');
      return 'PAYMENT_SUCCESS';
    }
    
    // ✅ REORDER
    if (/\breorder\s+\d{4,}\b/i.test(message) || 
        /\breorder\s+#?\d{4,}\b/i.test(message) ||
        lowerMessage.startsWith('reorder ')) {
      console.log('[Intent] ✅ Matched REORDER');
      return 'REORDER';
    }
    
    // ✅ VIEW ORDER DETAILS
    // In the TRACK_ORDER section, add more patterns
if (/\b(show|view|see|details|status|check|track).*order.*\d{4,}\b/i.test(message) ||
    /\border.*\d{4,}.*(show|view|see|details|status|check|track)\b/i.test(message) ||
    /\bdetails.*of.*order.*\d{4,}\b/i.test(message) ||      // ✅ ADD THIS
    /\bstatus.*of.*order.*\d{4,}\b/i.test(message)) {       // ✅ ADD THIS
  console.log('[Intent] ✅ Matched TRACK_ORDER (view details)');
  return 'TRACK_ORDER';
}
    
    // Add near the Menu section
if (/\b(menu|view.*menu|show.*menu|browse.*menu)\b/i.test(lowerMessage) ||
    lowerMessage === 'add more items' ||           // ✅ ADD THIS
    lowerMessage === 'browse items' ||             // ✅ ADD THIS
    lowerMessage === 'shop more' ||                // ✅ ADD THIS
    lowerMessage === 'continue shopping') {        // ✅ ADD THIS
  console.log('[Intent] ✅ Matched RECOMMEND (menu)');
  return 'RECOMMEND';
}
    // Greeting patterns
    if (/^(hi|hello|hey|good morning|good evening|greetings)\b/i.test(lowerMessage)) {
      console.log('[Intent] ✅ Matched GREETING');
      return 'GREETING';
    }
    
    // ✅ Track Orders - EXACT MATCHES FIRST (including "view all orders")
    if (lowerMessage === 'track orders' || 
        lowerMessage === 'my orders' ||
        lowerMessage === 'order history' ||
        lowerMessage === 'view order history' ||
        lowerMessage === 'show my orders' ||
        lowerMessage === 'view my orders' ||
        lowerMessage === 'track this order' ||
        lowerMessage === 'view all orders' ||  // ✅ ADD THIS
        lowerMessage === 'show all orders' ||  // ✅ ADD THIS
        lowerMessage === 'all orders') {        // ✅ ADD THIS
      console.log('[Intent] ✅ Matched ORDER_STATUS (exact)');
      return 'ORDER_STATUS';
    }
    
    // Track Orders - PATTERN MATCHES
    if (/\btrack.*orders?\b/i.test(lowerMessage) ||
        /\bmy.*orders?\b/i.test(lowerMessage) ||
        /\border.*history\b/i.test(lowerMessage) ||
        /\ball.*orders?\b/i.test(lowerMessage) ||  // ✅ ADD THIS
        /\bview.*all.*orders?\b/i.test(lowerMessage)) {  // ✅ ADD THIS
      console.log('[Intent] ✅ Matched ORDER_STATUS (pattern)');
      return 'ORDER_STATUS';
    }
    
    // Track specific order by number
    if (/\b(track|check|status).*order.*\d{4,}\b/i.test(message) || 
        /\border.*\d{4,}.*\b(track|status)\b/i.test(message)) {
      console.log('[Intent] ✅ Matched TRACK_ORDER');
      return 'TRACK_ORDER';
    }
    
    // Menu and Today's Specials
    if (/\b(today.*special|special.*today|show.*special|today'?s?\s+special)\b/i.test(lowerMessage) ||
        lowerMessage === "today's specials" ||
        lowerMessage === 'todays specials') {
      console.log('[Intent] ✅ Matched RECOMMEND (specials)');
      return 'RECOMMEND';
    }
    
    if (/\b(menu|view.*menu|show.*menu|browse.*menu)\b/i.test(lowerMessage)) {
      console.log('[Intent] ✅ Matched RECOMMEND (menu)');
      return 'RECOMMEND';
    }
    
    // ✅ PLACE NEW ORDER - Should go to menu, not checkout
    if (lowerMessage === 'place new order' || 
        lowerMessage === 'place another order' ||
        lowerMessage === 'order again') {
      console.log('[Intent] ✅ Matched RECOMMEND (new order)');
      return 'RECOMMEND';
    }
    
    // Checkout
    if (/\b(checkout|pay|payment|proceed.*pay|complete.*order)\b/i.test(lowerMessage)) {
      console.log('[Intent] ✅ Matched CHECKOUT');
      return 'CHECKOUT';
    }
    
    // Cart patterns
    if (/\b(add.*to.*cart|put.*in.*cart)\b/i.test(lowerMessage)) {
      console.log('[Intent] ✅ Matched ADD_TO_CART');
      return 'ADD_TO_CART';
    }
    
    if (/^(show.*cart|view.*cart|see.*cart|my.*cart|cart)$/i.test(lowerMessage)) {
      console.log('[Intent] ✅ Matched VIEW_CART');
      return 'VIEW_CART';
    }
    
    if (/\bremove.*from.*cart\b/i.test(lowerMessage)) {
      console.log('[Intent] ✅ Matched REMOVE_FROM_CART');
      return 'REMOVE_FROM_CART';
    }
    
    if (/^(clear.*cart|empty.*cart|remove.*all)$/i.test(lowerMessage)) {
      console.log('[Intent] ✅ Matched CLEAR_CART');
      return 'CLEAR_CART';
    }
    
    // Search - LAST
    if (/^(search|find)\b/i.test(lowerMessage) ||
        /\b(chicken|rice|biryani|curry|soup|food|dish)\b/i.test(lowerMessage)) {
      console.log('[Intent] ✅ Matched SEARCH');
      return 'SEARCH';
    }
    
    // Preference learning
    if (/\b(love|like|hate|prefer|favorite|favourite|dislike)\b/i.test(lowerMessage)) {
      console.log('[Intent] ✅ Matched LEARN_PREFERENCE');
      return 'LEARN_PREFERENCE';
    }
    
    console.log('[Intent] ⚠️ No match, returning UNKNOWN');
    return 'UNKNOWN';
    
  } catch (error) {
    console.error('[Intent] Classification error:', error);
    return 'UNKNOWN';
  }
}

function extractEntities(message) {
  const entities = {};
  
  // Extract order ID
  const orderIdMatch = message.match(/\b(\d{4,})\b/);
  if (orderIdMatch) {
    entities.orderId = orderIdMatch[1];
  }
  
  return entities;
}

module.exports = {
  classifyIntent,
  extractEntities
};