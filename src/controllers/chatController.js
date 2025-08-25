const chatService = require('../services/chatservice'); // sessions
const messageService = require('../services/messageService'); // messages
const aiResponseService = require('../services/aiResponseService'); // AI

class ChatController {
    async createSession(req, res, next) {
        try {
            const { customerId, title } = req.body;

            if (!customerId) {
                return res.status(400).json({
                    success: false,
                    error: 'Customer ID is required'
                });
            }

            const session = await chatService.createSession(customerId, title);

            res.status(201).json({
                success: true,
                data: { session },
                message: 'Chat session created successfully'
            });
        } catch (error) {
            next(error);
        }
    }

    async getSessions(req, res, next) {
        try {
            const { customerId, limit } = req.query;

            if (!customerId) {
                return res.status(400).json({
                    success: false,
                    error: 'Customer ID is required'
                });
            }

            const sessions = await chatService.getUserSessions(customerId, limit ? parseInt(limit) : 20);

            res.status(200).json({
                success: true,
                data: { sessions }
            });
        } catch (error) {
            next(error);
        }
    }

    async getMessages(req, res, next) {
        try {
            const { sessionId } = req.params;
            const { customerId, limit, offset } = req.query;

            if (!customerId) {
                return res.status(400).json({
                    success: false,
                    error: 'Customer ID is required'
                });
            }

            const session = await chatService.getSessionById(sessionId);
            if (!session || session.customer_id !== customerId) {
                return res.status(404).json({
                    success: false,
                    error: 'Session not found or access denied'
                });
            }

            const messages = await messageService.getChatHistory(
                sessionId,
                limit ? parseInt(limit) : 50,
                offset ? parseInt(offset) : 0
            );

            res.status(200).json({
                success: true,
                data: { messages, session }
            });
        } catch (error) {
            next(error);
        }
    }

    async sendMessage(req, res, next) {
        try {
            const { sessionId, customerId, content, messageType } = req.body;

            if (!sessionId || !customerId || !content) {
                return res.status(400).json({
                    success: false,
                    error: 'Session ID, customer ID, and content are required'
                });
            }

            const session = await chatService.getSessionById(sessionId);
            if (!session || session.customer_id !== customerId) {
                return res.status(404).json({
                    success: false,
                    error: 'Session not found or access denied'
                });
            }

            // Save user message via messageService
            const message = await messageService.saveMessage(sessionId, content, 'customer', messageType);

            // Generate AI response via aiResponseService
            const aiResponseText = await aiResponseService.getAIResponse(content, sessionId);

            // Save AI response via messageService
            const aiResponse = await messageService.saveMessage(sessionId, aiResponseText, 'ai', 'text');

            res.status(200).json({
                success: true,
                data: { userMessage: message, aiMessage: aiResponse }
            });
        } catch (error) {
            next(error);
        }
    }

    async deleteSession(req, res, next) {
        try {
            const { sessionId } = req.params;
            const { customerId } = req.query;

            if (!customerId) {
                return res.status(400).json({
                    success: false,
                    error: 'Customer ID is required'
                });
            }

            await chatService.deleteSession(sessionId, customerId);

            res.status(200).json({
                success: true,
                message: 'Session deleted successfully'
            });
        } catch (error) {
            next(error);
        }
    }

    // NEW WEEK 2 METHODS
    async updateSessionTitle(req, res, next) {
        try {
            const { sessionId } = req.params;
            const { title, customerId } = req.body;

            if (!title || !customerId) {
                return res.status(400).json({
                    success: false,
                    error: 'Title and customer ID are required'
                });
            }

            const session = await chatService.getSessionById(sessionId);
            if (!session || session.customer_id !== customerId) {
                return res.status(404).json({
                    success: false,
                    error: 'Session not found or access denied'
                });
            }

            const updatedSession = await chatService.updateSessionTitle(sessionId, title);

            res.status(200).json({
                success: true,
                data: { session: updatedSession },
                message: 'Session title updated successfully'
            });
        } catch (error) {
            next(error);
        }
    }

    async getSessionWithMessages(req, res, next) {
        try {
            const { sessionId } = req.params;
            const { customerId } = req.query;

            if (!customerId) {
                return res.status(400).json({
                    success: false,
                    error: 'Customer ID is required'
                });
            }

            const sessionData = await chatService.getSessionWithMessages(sessionId, customerId);

            res.status(200).json({
                success: true,
                data: sessionData
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new ChatController();
