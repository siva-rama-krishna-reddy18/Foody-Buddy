const chatService = require('../services/chatservice');

class ChatController {
    async createSession(req, res) {
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
            console.error('Create session error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to create chat session'
            });
        }
    }
    
    async getSessions(req, res) {
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
            console.error('Get sessions error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get chat sessions'
            });
        }
    }
    
    async getMessages(req, res) {
        try {
            const { sessionId } = req.params;
            const { customerId, limit, offset } = req.query;
            
            if (!customerId) {
                return res.status(400).json({
                    success: false,
                    error: 'Customer ID is required'
                });
            }
            
            // Verify session ownership
            const session = await chatService.getSessionById(sessionId);
            if (!session || session.customer_id !== customerId) {
                return res.status(404).json({
                    success: false,
                    error: 'Session not found or access denied'
                });
            }
            
            const messages = await chatService.getChatHistory(
                sessionId,
                limit ? parseInt(limit) : 50,
                offset ? parseInt(offset) : 0
            );
            
            res.status(200).json({
                success: true,
                data: { messages, session }
            });
        } catch (error) {
            console.error('Get messages error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get chat messages'
            });
        }
    }
    
    async sendMessage(req, res) {
        try {
            const { sessionId, customerId, content, messageType } = req.body;
            
            if (!sessionId || !customerId || !content) {
                return res.status(400).json({
                    success: false,
                    error: 'Session ID, customer ID, and content are required'
                });
            }
            
            // Verify session ownership
            const session = await chatService.getSessionById(sessionId);
            if (!session || session.customer_id !== customerId) {
                return res.status(404).json({
                    success: false,
                    error: 'Session not found or access denied'
                });
            }
            
            const message = await chatService.saveMessage(sessionId, content, 'customer', messageType);
            
            // Get AI response
            const aiResponseText = await chatService.getAIResponse(content, sessionId);
            const aiResponse = await chatService.saveMessage(
                sessionId,
                aiResponseText,
                'ai',
                'text'
            );
            
            res.status(200).json({
                success: true,
                data: { userMessage: message, aiMessage: aiResponse }
            });
        } catch (error) {
            console.error('Send message error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to send message'
            });
        }
    }
    
    async deleteSession(req, res) {
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
            console.error('Delete session error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    // NEW WEEK 2 METHODS
    async updateSessionTitle(req, res) {
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
            console.error('Update session title error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    async getSessionWithMessages(req, res) {
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
            console.error('Get session with messages error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
}

module.exports = new ChatController();