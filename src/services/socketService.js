// src/services/socketService.js
const chatService = require('./chatservice');
const messageService = require('./messageService');
const orchestratorService = require('./orchestratorService');   // 👈 use orchestrator first
const aiResponseService = require('./aiResponseService');        // fallback for GENERAL
const { v4: uuidv4 } = require('uuid');

console.log('SocketService: Loading...');

module.exports = (io) => {
  console.log('SocketService: Initializing...');

  io.on('connection', (socket) => {
  if (!socket.greeted) {
    socket.greeted = true;
    socket.emit('message', {
      id: uuidv4(),
      message: 'Connected to FoodyBuddy! Send me a message.',
      sender: 'ai',
      timestamp: new Date()
    });
  }


    // ---- AUTH ----
    socket.on('authenticate', async (data) => {
      try {
        const phoneNumber = String(data?.phoneNumber || '').trim();
        if (!phoneNumber) {
          socket.emit('error', { message: 'Phone number is required' });
          return;
        }

        socket.customerId = phoneNumber;

        const session = await chatService.createSession(
          phoneNumber,
          `Chat ${new Date().toLocaleDateString()}`
        );
        const sessionId = session.id;

        socket.sessionId = sessionId;
        socket.join(sessionId);

        socket.emit('authenticated', {
          success: true,
          sessionId,
          message: 'Connected successfully! How can I help you today?'
        });
      } catch (err) {
        console.error('SocketService: Authentication error:', err);
        socket.emit('error', { message: 'Authentication failed' });
      }
    });

    // ---- MESSAGE ----
    socket.on('message', async (data) => {
      console.log('SocketService: MESSAGE RECEIVED!', data);
      try {
        const incomingText = String(data?.message || '').trim();
        const incomingCustomerId = data?.customerId;
        const incomingSessionId = data?.sessionId;

        if (!incomingText) return;

        // Resolve a session
        let sessionId = socket.sessionId || incomingSessionId;
        if (!sessionId) {
          const cid = socket.customerId || incomingCustomerId || '+1234567890';
          const session = await chatService.createSession(cid, 'Emergency Chat');
          sessionId = session.id;
          socket.sessionId = sessionId;
          socket.join(sessionId);
          console.log(`SocketService: Emergency database session created: ${sessionId}`);
        }

        // Persist user message
        await messageService.saveMessage(sessionId, incomingText, 'customer', 'text');

        const customerId = socket.customerId || incomingCustomerId || null;

        // 1) Orchestrate DB-grounded reply
        let out = await orchestratorService.respondToMessage({
          sessionId,
          customerId,
          content: incomingText
        });

        // 2) If orchestrator returns GENERAL or empty, fallback to HF small-talk
        if (!out || out.intent === 'GENERAL') {
          const aiText = await aiResponseService.getAIResponse(incomingText, sessionId, { intent: 'GENERAL' });
          out = {
            aiText: (aiText || '').trim() || "I can help with the FoodyBuddy menu and ordering. What sounds good?",
            productList: [],
            intent: 'GENERAL'
          };
        }

        // Persist AI message with structured metadata
        const aiMeta = {
          intent: out.intent,
          ...(Array.isArray(out.productList) && out.productList.length
              ? { kind: 'product_list', items: out.productList }
              : {}),
          ...(out.addToCart ? { addToCart: out.addToCart } : {})
        };

        const aiMsg = await messageService.saveMessage(sessionId, out.aiText, 'ai', 'text', aiMeta);

        // Emit AI message (you can also broadcast: io.to(sessionId).emit(...))
        socket.emit('message', {
          id: aiMsg.id,
          message: aiMsg.content,
          sender: 'ai',
          timestamp: aiMsg.created_at,
          sessionId,
          // Optional: send structured data for a rich UI
          ...(aiMeta.kind ? { kind: aiMeta.kind, items: aiMeta.items } : {}),
          ...(aiMeta.addToCart ? { addToCart: aiMeta.addToCart } : {})
        });

        console.log(`SocketService: Sent AI (${out.intent})`);
      } catch (error) {
        console.error('SocketService: Error processing message:', error);
        socket.emit('message', {
          id: uuidv4(),
          message: 'Sorry, something went wrong. Please try again.',
          sender: 'ai',
          timestamp: new Date()
        });
      }
    });

    socket.on('disconnect', () => {
      console.log(`SocketService: Client disconnected: ${socket.id}`);
    });

    socket.on('error', (err) => {
      console.error('SocketService: Socket error:', err);
    });
  });

  console.log('SocketService: Initialized successfully');
};
