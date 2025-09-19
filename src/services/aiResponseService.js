// services/aiResponseService.js
const { HfInference } = require('@huggingface/inference');

/** ───────────── Env + Defaults ───────────── */
const HF_API_KEY  = process.env.HUGGING_FACE_API_KEY || '';
const HF_MODEL_ID = process.env.HF_MODEL_ID || 'mistralai/Mistral-7B-Instruct-v0.2';

// Turn this off to hard-disable HF calls (useful if credits run out)
const AI_USE_HF   = String(process.env.AI_USE_HF ?? 'true').toLowerCase() !== 'false';

// Debug logs for raw/sanitized outputs, prehandler hits, etc.
const DEBUG_AI    = String(process.env.DEBUG_AI ?? 'false').toLowerCase() === 'true';

const GEN_MAX_NEW_TOKENS = Number(process.env.HF_GEN_MAX_NEW_TOKENS || 220);
const GEN_TEMPERATURE    = Number(process.env.HF_GEN_TEMPERATURE || 0.3);
const GEN_TOP_P          = Number(process.env.HF_GEN_TOP_P || 0.85);

/** ───────────── System Prompt ───────────── */
function buildSystemPrompt() {
  return [
    'You are FoodyBuddy, the in-house ordering assistant for the FoodyBuddy restaurant only.',
    'Do NOT recommend or mention other restaurants, delivery apps, or nearby places.',
    'Never mention location access. If location is relevant, ask for city/postal code politely.',
    'Only use FoodyBuddy’s menu/context. Be concise and help build the order.',
    'If the user just says “hi/hello”, greet and ask what they’d like to order.',
    'Output must NOT include any meta markers (e.g., <|assistant|>, <|user|>, [/ASS], [/ASSIST]).',
  ].join(' ');
}

/** ───────────── Stop Sequences ─────────────
 * We include common “next turn” markers and the odd variants seen in logs.
 */
const STOP = [
  '\nUser:', '\nYou:', '\nHuman:',
  '\n[/USER]', '\n[USER]', '\n[/ASS]', '\n[/ASSIST]',
  '[/USER|>', '[/ASSIST|>',
  '<|assistant|>', '<|user|>', '<|system|>',
];

/** ───────────── Brand Guard ───────────── */
const BANNED = [
  /browse.*app|discover tab/i,
  /unable to see your location|i can't see your location/i,
  /pizza palace|fresh greens|spice route/i, // external brands seen in earlier logs
];

function enforceBrand(out) {
  if (!out) return out;
  if (BANNED.some(rx => rx.test(out))) {
    return 'Here are some FoodyBuddy picks to get started: • Paneer Tikka Masala • Veg Biryani • Aloo Gobi. Which would you like and how many?';
  }
  return out;
}

/** ───────────── Prehandler (no HF call) ─────────────
 * Catch common intents and give useful, brand-safe replies.
 * Your orchestrator should handle DB listings; this only nudges the user.
 */
function prehandle(userMsg) {
  const t = (userMsg || '').toLowerCase().trim();

  // Strong signals that the user mentioned a specific dish → let orchestrator handle it
  const hasSpecificDish = /\b(chicken tikka masala|paneer tikka masala|palak paneer|aloo gobi|chana pindi|chana masala|veg fried rice|manchurian|korma|biryani|samosa|naan|dal|sambar|butter chicken|goat curry)\b/i.test(t);
  if (hasSpecificDish) return null;

  // Non-veg first (avoid matching the "veg" inside "non-veg")
  
  const isNonVegWord = /\bnon[-\s]*veg\b/i.test(t);
  const hasMeatWord  = /\b(chicken|goat|mutton|fish|egg|eggs?)\b/i.test(t);
  const isNonVeg     = isNonVegWord || hasMeatWord;

  const isVeg        = /\bveg(?:etarian)?\b/i.test(t) && !isNonVegWord;

  // Greetings
  if (/^(hi|hello|hey)\b/.test(t)) {
    return 'Welcome to FoodyBuddy! What can I get started for you today?';
  }

  // Generic dinner ask
  // if (/can i get some food|suggest.*dinner|recommend.*(food|dinner)|hungry|what.*(eat|for dinner)/i.test(t)) {
    // return 'Are you in the mood for vegetarian or non-veg? Any spice preference? I can list options you can add to your cart.';
  // }

  // Generic cuisine nudge (only when no specific dish was found)
  // if (/\bindian\b/.test(t)) {
    // return 'We have great Indian options. Say “veg” or “non-veg” and I’ll list a few to add to your cart.';
  // }

  /*if (isNonVeg) {
  return 'Non-veg, got it! Popular picks: Chicken Tikka Masala, Chicken or Goat Biryani. Which one and how many?';
}




  if (isVeg) {
    return 'Vegetarian—great choice! Popular picks: Paneer Tikka Masala, Palak Paneer, Aloo Gobi, Chana Pindi. Tell me which one and how many.';
  }
  */
  if (/menu|show.*menu|list.*menu/i.test(t)) {
    return 'Tell me “veg” or “non-veg,” or name a dish (biryani, paneer, tikka), and I’ll show items you can add to your cart.';
  }

  return null; // let the LLM handle small talk; orchestrator will have run first anyway
}


/** ───────────── Sanitizer ─────────────
 * Strip meta tokens, control tags (incl. odd variants), leaked rules,
 * and cut off if the model starts writing the next user turn.
 */
function sanitizeAssistant(text) {
  if (!text) return '';

  let out = text;

  // Remove <|assistant|>, <|user|>, <|system|>
  out = out.replace(/<\|(assistant|user|system)\|>/gi, '');

  // Remove bracketed control tags and variants like [/ASSIST|>], [/USER|>], [USER], [/ASS]
  out = out.replace(/\[(\/)?(ASSIST|ASS|USER)[^\]]*\]/gi, '');

  // Remove leaked rules anywhere
  out = out.replace(/You are FoodyBuddy[\s\S]*?$/gi, '');

  // Defensive: strip stray control junk at start of lines
  out = out.replace(/^[\s|>\/-]+/gm, '');

  // Cut if it started writing the next turn
  const cuts = ['\nUser:', '\nYou:', '\nHuman:'];
  let end = out.length;
  for (const c of cuts) {
    const i = out.indexOf(c);
    if (i !== -1) end = Math.min(end, i);
  }
  out = out.slice(0, end).trim();

  // Collapse excessive blank lines
  out = out.replace(/\n{3,}/g, '\n\n');

  if (DEBUG_AI) console.debug('[AI][SANITIZED]', JSON.stringify(out));
  return out;
}

/** ───────────── System + User Builders ───────────── */
function buildSystemContent(options = {}) {
  const base = buildSystemPrompt();
  const hints = [];
  if (options?.intent) hints.push(`User intent hint: ${options.intent}`);
  if (Array.isArray(options?.context) && options.context.length) {
    hints.push(`FoodyBuddy context:\n${options.context.join('\n')}`);
  }
  return hints.length ? `${base}\n\n${hints.join('\n\n')}` : base;
}
function buildUserContent(userMessage) {
  return (userMessage || '').trim();
}

/** ───────────── Service Class ───────────── */
class AIResponseService {
  constructor() {
    if (!HF_API_KEY && AI_USE_HF) {
      console.warn('HUGGING_FACE_API_KEY is not set. AI replies will fail unless AI_USE_HF=false.');
    }
    this.hf    = (AI_USE_HF && HF_API_KEY) ? new HfInference(HF_API_KEY) : null;
    this.model = HF_MODEL_ID;
    console.log('[AI] Using model (chatCompletion):', AI_USE_HF && HF_API_KEY ? this.model : '(HF disabled)');
  }

  /**
   * Generate a brand-safe response. Prefer your orchestrator for menu flows;
   * this class is for small talk / fallback.
   * @param {string} message - user text
   * @param {string} sessionId
   * @param {{intent?: string, context?: string[]}} options
   * @returns {Promise<string>}
   */
  async getAIResponse(message, sessionId, options = {}) {
    try {
      const userMsg = (message || '').trim();
      if (!userMsg) return 'Could you please share your message again?';

      // 1) Pre-handle trivial/common intents without calling the model
      const pre = prehandle(userMsg);
      if (DEBUG_AI) console.debug('[AI][PREHIT]', !!pre, 'text:', userMsg);
      if (pre) return pre;

      // 2) If HF is disabled or missing, return a brand-safe fallback
      if (!this.hf) {
        return 'Here are some FoodyBuddy picks to get started: • Paneer Tikka Masala • Veg Biryani • Aloo Gobi. Which would you like and how many?';
      }

      // 3) Build message array (single system turn)
      const systemContent = buildSystemContent(options);
      const userContent   = buildUserContent(userMsg);
      const messages = [
        { role: 'system', content: systemContent },
        { role: 'user',   content: userContent  }
      ];

      // 4) Call HF chat
      const result = await this.hf.chatCompletion({
        model: this.model,
        messages,
        max_tokens: GEN_MAX_NEW_TOKENS,
        temperature: GEN_TEMPERATURE,
        top_p: GEN_TOP_P,
        stop: STOP
      });

      const raw = (result?.choices?.[0]?.message?.content || '').trim();
      if (DEBUG_AI) console.debug('[AI][RAW]', JSON.stringify(raw));

      const clean = enforceBrand(sanitizeAssistant(raw));
      return clean || 'Here are some FoodyBuddy picks to get started: • Paneer Tikka Masala • Veg Biryani • Aloo Gobi. Which would you like and how many?';
    } catch (err) {
      // 5) Graceful fallback on any provider error (credits, network, etc.)
      console.error('HuggingFace getAIResponse error:', err?.message || err);
      const pre = prehandle(message);
      if (pre) return pre;
      return 'Here are some FoodyBuddy picks to get started: • Paneer Tikka Masala • Veg Biryani • Aloo Gobi. Which would you like and how many?';
    }
  }
}

module.exports = new AIResponseService();
