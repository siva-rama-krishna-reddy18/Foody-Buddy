const express = require('express');
const chatController = require('../controllers/chatController');

const router = express.Router();

router.post('/sessions', chatController.createSession);
router.get('/sessions', chatController.getSessions);
router.get('/messages/:sessionId', chatController.getMessages);
router.post('/messages', chatController.sendMessage);
router.delete('/sessions/:sessionId', chatController.deleteSession);

module.exports = router;