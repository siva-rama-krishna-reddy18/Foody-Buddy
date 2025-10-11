// src/routes/chat.js
const express = require('express');
const router = express.Router();
const agentService = require('../services/agentService');
const ChatSession = require('../../models/ChatSession');
const { v4: uuidv4 } = require('uuid');

// Health check
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    service: 'chat'
  });
});

// REST endpoint for chat messages
router.post('/chat', async (req, res) => {
  try {
    const { customerId, message } = req.body;

    if (!customerId || !message) {
      return res.status(400).json({ 
        error: 'customerId and message are required' 
      });
    }

    console.log(`[Chat API] Message from ${customerId}: ${message}`);

    // Process message through agent
    const response = await agentService.processMessage(customerId, message);

    res.json({
      success: true,
      text: response.aiText,
      intent: response.intent,
      products: response.productList || [],
      cart: response.cartData || null,
      orderData: response.orderData || null,
      payment: response.payment || null,
      suggestions: response.meta?.suggestions || [],
      timestamp: response.meta?.timestamp || new Date().toISOString()
    });

  } catch (error) {
    console.error('[Chat API] Error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// Create new chat session
router.post('/sessions', async (req, res) => {
  try {
    const { customerId } = req.body;

    if (!customerId) {
      return res.status(400).json({ error: 'customerId is required' });
    }

    const sessionId = uuidv4();

    const session = await ChatSession.create({
      session_id: sessionId,
      customer_id: customerId,
      created_at: new Date(),
      updated_at: new Date(),
      messages: []
    });

    res.json({
      success: true,
      sessionId: session.session_id
    });

  } catch (error) {
    console.error('[Chat API] Create session error:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// Get all sessions for a customer
router.get('/sessions', async (req, res) => {
  try {
    const { customerId } = req.query;

    if (!customerId) {
      return res.status(400).json({ error: 'customerId is required' });
    }

    const sessions = await ChatSession.find({ customer_id: customerId })
      .sort({ updated_at: -1 })
      .limit(10)
      .lean();

    res.json({
      success: true,
      sessions: sessions.map(s => ({
        sessionId: s.session_id,
        createdAt: s.created_at,
        updatedAt: s.updated_at,
        messageCount: s.messages?.length || 0
      }))
    });

  } catch (error) {
    console.error('[Chat API] Get sessions error:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// Get chat history for a session
router.get('/sessions/:sessionId/messages', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await ChatSession.findOne({ session_id: sessionId }).lean();

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({
      success: true,
      sessionId: session.session_id,
      messages: session.messages || []
    });

  } catch (error) {
    console.error('[Chat API] Get history error:', error);
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
});

module.exports = router;