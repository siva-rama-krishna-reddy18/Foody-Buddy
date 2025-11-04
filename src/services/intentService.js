// src/services/intentService.js
const DEBUG = process.env.NODE_ENV === 'development';

async function classifyIntent(message) {
  try {
    const lowerMessage = message.toLowerCase().trim();
    
    console.log(`[Intent] Classifying: "${message}"`);
    
    //  CHECKOUT - JSON FORMAT - Check this FIRST before any other checks
    if (message.trim().startsWith('{') && message.includes('"action"') && message.includes('Proceed to pay')) {
      console.log('[Intent]  Matched CHECKOUT (JSON format)');
      return 'CHECKOUT';
    }
    
    //  SILENT CART REQUEST
    if (message === 'get_cart_silent') {
      console.log('[Intent]  SILENT CART REQUEST');
      return 'VIEW_CART';
    }
    
    //  PAYMENT SUCCESS
    if (message === 'PAYMENT SUCCESSFUL.PREPARING YOUR ORDER') {
      console.log('[Intent]  EXACT MATCH: PAYMENT SUCCESSFUL.PREPARING YOUR ORDER');
      return 'PAYMENT_SUCCESS';
    }
    
    //  QUANTITY UPDATE - Add one more, increase quantity
    if (/\b(add one more|add another|increase.*quantity)\b/i.test(lowerMessage)) {
      console.log('[Intent]  Matched INCREASE_QUANTITY');
      return 'ADD_TO_CART';
    }
    
    //  QUANTITY UPDATE - Remove one, decrease quantity
    if (/\b(remove one|decrease.*quantity)\b/i.test(lowerMessage)) {
      console.log('[Intent]  Matched DECREASE_QUANTITY');
      return 'DECREASE_QUANTITY';
    }
    
    //  REMOVE ALL - Complete removal
    if (/\b(remove all|remove product.*from cart)\b/i.test(lowerMessage)) {
      console.log('[Intent]  Matched REMOVE_ALL');
      return 'REMOVE_FROM_CART';
    }
    
    //  APPLY COUPON
    if (/\b(apply coupon|use coupon|add coupon)\b/i.test(lowerMessage)) {
      console.log('[Intent]  Matched APPLY_COUPON');
      return 'APPLY_COUPON';
    }

    //  REMOVE COUPON
    if (/\b(remove coupon|delete coupon|clear coupon)\b/i.test(lowerMessage)) {
      console.log('[Intent]  Matched REMOVE_COUPON');
      return 'REMOVE_COUPON';
    }
    
    //  REORDER
    if (/\breorder\s+\d{4,}\b/i.test(message) || 
        /\breorder\s+#?\d{4,}\b/i.test(message) ||
        lowerMessage.startsWith('reorder ')) {
      console.log('[Intent]  Matched REORDER');
      return 'REORDER';
    }
    
    //  VIEW ORDER DETAILS
    if (/\b(show|view|see|details|status|check|track).*order.*\d{4,}\b/i.test(message) ||
        /\border.*\d{4,}.*(show|view|see|details|status|check|track)\b/i.test(message) ||
        /\bdetails.*of.*order.*\d{4,}\b/i.test(message) ||
        /\bstatus.*of.*order.*\d{4,}\b/i.test(message)) {
      console.log('[Intent]  Matched TRACK_ORDER (view details)');
      return 'TRACK_ORDER';
    }
    
    // Menu patterns
    if (/\b(menu|view.*menu|show.*menu|browse.*menu)\b/i.test(lowerMessage) ||
        lowerMessage === 'add more items' ||
        lowerMessage === 'browse items' ||
        lowerMessage === 'shop more' ||
        lowerMessage === 'continue shopping') {
      console.log('[Intent]  Matched RECOMMEND (menu)');
      return 'RECOMMEND';
    }
    
    // Greeting patterns
    if (/^(hi|hello|hey|good morning|good evening|greetings)\b/i.test(lowerMessage)) {
      console.log('[Intent]  Matched GREETING');
      return 'GREETING';
    }
    
   
    // Pattern 1: "i want veg/non-veg/vegan"
    if (/\b(i want|show me|looking for|give me|get me)\b.*(veg|vegetarian|non-veg|non veg|nonveg|vegan|meat|chicken|fish|seafood|halal)\b/i.test(lowerMessage)) {
      console.log('[Intent]  Matched DIETARY_SEARCH (want pattern)');
      return 'DIETARY_SEARCH';
    }
    
    // Pattern 2: "veg items", "vegetarian food", "non-veg dishes"
    if (/\b(veg|vegetarian|non-veg|non veg|nonveg|vegan|halal)\b.*(items|dishes|food|options|menu|meals)\b/i.test(lowerMessage)) {
      console.log('[Intent]  Matched DIETARY_SEARCH (items pattern)');
      return 'DIETARY_SEARCH';
    }
    
    // Pattern 3: "only veg/vegetarian"
    if (/\b(only|just)\b.*(veg|vegetarian|non-veg|vegan)\b/i.test(lowerMessage)) {
      console.log('[Intent]  Matched DIETARY_SEARCH (only pattern)');
      return 'DIETARY_SEARCH';
    }
    
    // Pattern 4: "do you have veg/non-veg"
    if (/\b(do you have|any|got any)\b.*(veg|vegetarian|non-veg|vegan|halal)\b/i.test(lowerMessage)) {
      console.log('[Intent]  Matched DIETARY_SEARCH (query pattern)');
      return 'DIETARY_SEARCH';
    }
    
    //  Track Orders - EXACT MATCHES FIRST
    if (lowerMessage === 'track orders' || 
        lowerMessage === 'my orders' ||
        lowerMessage === 'order history' ||
        lowerMessage === 'view order history' ||
        lowerMessage === 'show my orders' ||
        lowerMessage === 'view my orders' ||
        lowerMessage === 'track this order' ||
        lowerMessage === 'view all orders' ||
        lowerMessage === 'show all orders' ||
        lowerMessage === 'all orders') {
      console.log('[Intent]  Matched ORDER_STATUS (exact)');
      return 'ORDER_STATUS';
    }
    
    // Track Orders - PATTERN MATCHES
    if (/\btrack.*orders?\b/i.test(lowerMessage) ||
        /\bmy.*orders?\b/i.test(lowerMessage) ||
        /\border.*history\b/i.test(lowerMessage) ||
        /\ball.*orders?\b/i.test(lowerMessage) ||
        /\bview.*all.*orders?\b/i.test(lowerMessage)) {
      console.log('[Intent]  Matched ORDER_STATUS (pattern)');
      return 'ORDER_STATUS';
    }
    
    // Track specific order by number
    if (/\b(track|check|status).*order.*\d{4,}\b/i.test(message) || 
        /\border.*\d{4,}.*\b(track|status)\b/i.test(message)) {
      console.log('[Intent]  Matched TRACK_ORDER');
      return 'TRACK_ORDER';
    }
    
    // Menu and Today's Specials
    if (/\b(today.*special|special.*today|show.*special|today'?s?\s+special)\b/i.test(lowerMessage) ||
        lowerMessage === "today's specials" ||
        lowerMessage === 'todays specials') {
      console.log('[Intent]  Matched RECOMMEND (specials)');
      return 'RECOMMEND';
    }
    
    //  PLACE NEW ORDER
    if (lowerMessage === 'place new order' || 
        lowerMessage === 'place another order' ||
        lowerMessage === 'order again') {
      console.log('[Intent]  Matched RECOMMEND (new order)');
      return 'RECOMMEND';
    }
        //  CONFIRM ORDER / PAYMENT 
    if (/\b(confirm( my)? order|place( my)? order|finalize( my)? order|ready to pay|proceed to checkout|complete payment)\b/i.test(lowerMessage)) {
      console.log('[Intent]  Matched CONFIRM_ORDER (checkout/payment)');
      return 'CHECKOUT';
    }

    
    // Checkout - REGULAR TEXT FORMAT
    if (/\b(checkout|pay|payment|proceed.*pay|complete.*order)\b/i.test(lowerMessage)) {
      console.log('[Intent]  Matched CHECKOUT');
      return 'CHECKOUT';
    }
    
    // Cart patterns - ADD TO CART
    if (/\b(add.*to.*cart|put.*in.*cart)\b/i.test(lowerMessage)) {
      console.log('[Intent]  Matched ADD_TO_CART');
      return 'ADD_TO_CART';
    }
    
    // VIEW CART
    if (/^(show.*cart|view.*cart|see.*cart|my.*cart|cart)$/i.test(lowerMessage)) {
      console.log('[Intent]  Matched VIEW_CART');
      return 'VIEW_CART';
    }
    
    // REMOVE FROM CART
    if (/\bremove.*from.*cart\b/i.test(lowerMessage)) {
      console.log('[Intent]  Matched REMOVE_FROM_CART');
      return 'REMOVE_FROM_CART';
    }
    
    // CLEAR CART
    if (/^(clear.*cart|empty.*cart|remove.*all)$/i.test(lowerMessage)) {
      console.log('[Intent]  Matched CLEAR_CART');
      return 'CLEAR_CART';
    }
    
    // Search - LAST
    if (/^(search|find)\b/i.test(lowerMessage) ||
        /\b(chicken|rice|biryani|curry|soup|food|dish)\b/i.test(lowerMessage)) {
      console.log('[Intent]  Matched SEARCH');
      return 'SEARCH';
    }
    
    // Preference learning
    if (/\b(love|like|hate|prefer|favorite|favourite|dislike)\b/i.test(lowerMessage)) {
      console.log('[Intent]  Matched LEARN_PREFERENCE');
      return 'LEARN_PREFERENCE';
    }
    
    console.log('[Intent]  No match, returning UNKNOWN');
    return 'UNKNOWN';
    
  } catch (error) {
    console.error('[Intent] Classification error:', error);
    return 'UNKNOWN';
  }
}

//  NEW: Extract dietary preference from message
function extractDietaryType(message) {
  const lowerMessage = message.toLowerCase();
  
  // Vegetarian
  if (/\b(veg(?!an)|vegetarian)\b/i.test(lowerMessage) && 
      !/\b(non-veg|non veg|nonveg)\b/i.test(lowerMessage)) {
    console.log('[Intent]  Dietary type: VEGETARIAN');
    return 'vegetarian';
  }
  
  // Non-vegetarian
  if (/\b(non-veg|non veg|nonveg|meat|chicken|fish|seafood|halal)\b/i.test(lowerMessage)) {
    console.log('[Intent]  Dietary type: NON-VEGETARIAN');
    return 'non-vegetarian';
  }
  
  // Vegan
  if (/\b(vegan|plant-based)\b/i.test(lowerMessage)) {
    console.log('[Intent]  Dietary type: VEGAN');
    return 'vegan';
  }
  
  return null;
}

function extractEntities(message) {
  const entities = {};
  
  // Extract order ID
  const orderIdMatch = message.match(/\b(\d{4,})\b/);
  if (orderIdMatch) {
    entities.orderId = orderIdMatch[1];
  }
  
  // Extract product ID if present
  const productIdMatch = message.match(/product\s+([a-f0-9]{24})/i);
  if (productIdMatch) {
    entities.productId = productIdMatch[1];
  }
  
  //  Extract coupon code
  if (message.toLowerCase().includes('coupon')) {
    const words = message.trim().split(/\s+/);
    const lastWord = words[words.length - 1];
    
    if (/^[A-Z0-9]{4,}$/i.test(lastWord)) {
      entities.couponCode = lastWord.toUpperCase();
      console.log('[Entities] 💳 Extracted coupon code:', entities.couponCode);
    }
  }
  
  //  NEW: Extract dietary type
  entities.dietaryType = extractDietaryType(message);
  
  return entities;
}

module.exports = {
  classifyIntent,
  extractEntities,
  extractDietaryType
};