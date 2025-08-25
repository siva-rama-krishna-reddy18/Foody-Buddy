const express = require('express');
const chatController = require('../controllers/chatController');
const messageController = require('../controllers/messageController');

const router = express.Router();

// ---------------------
// Chat Session Routes
// ---------------------

// Create a new chat session
router.post('/sessions', chatController.createSession);

// Get all chat sessions for a customer
router.get('/sessions', chatController.getSessions);

// Get a single session with messages
router.get('/sessions/:sessionId/details', chatController.getSessionWithMessages);

// Update session title
router.put('/sessions/:sessionId/title', chatController.updateSessionTitle);

// Delete a chat session
router.delete('/sessions/:sessionId', chatController.deleteSession);

// ---------------------
// Message Routes
// ---------------------

// Send a new message (user -> AI)
router.post('/messages', chatController.sendMessage);

// Get all messages in a session
router.get('/messages/:sessionId', chatController.getMessages);

// Update a specific message
router.put('/messages/:messageId', messageController.updateMessage);

// Delete a specific message
router.delete('/messages/:messageId', messageController.deleteMessage);

// Get message history for a session with optional limit/offset
router.get('/messages/history/:sessionId', messageController.getMessageHistory);

module.exports = router;
