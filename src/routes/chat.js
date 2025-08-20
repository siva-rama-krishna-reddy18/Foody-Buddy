const express = require('express');
const chatController = require('../controllers/chatController');

const router = express.Router();

// Existing routes
router.post('/sessions', chatController.createSession);
router.get('/sessions', chatController.getSessions);
router.get('/messages/:sessionId', chatController.getMessages);
router.post('/messages', chatController.sendMessage);
router.delete('/sessions/:sessionId', chatController.deleteSession);

// NEW Week 2 routes
router.put('/sessions/:sessionId/title', chatController.updateSessionTitle);
router.get('/sessions/:sessionId/details', chatController.getSessionWithMessages);

module.exports = router;