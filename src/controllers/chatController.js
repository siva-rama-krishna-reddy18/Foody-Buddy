const chatService = require('../services/chatservice');

class ChatController {
    async createSession(req, res) {
        try {
            const customerId = req.user.phone;  // Use phone as customer ID
            const { title } = req.body;
            
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
            const customerId = req.user.phone;  // Use phone as customer ID
            const { limit } = req.query;
            
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
            const { limit, offset } = req.query;
            
            // Verify session ownership - use customer_id field
            const session = await chatService.getSessionById(sessionId);
            if (!session || session.customer_id !== req.user.phone) {
                return res.status(404).json({
                    success: false,
                    error: 'Session not found'
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
            const { sessionId, content, messageType } = req.body;
            
            if (!sessionId || !content) {
                return res.status(400).json({
                    success: false,
                    error: 'Session ID and content are required'
                });
            }
            
            // Verify session ownership - use customer_id field
            const session = await chatService.getSessionById(sessionId);
            if (!session || session.customer_id !== req.user.phone) {
                return res.status(404).json({
                    success: false,
                    error: 'Session not found'
                });
            }
            
            const message = await chatService.saveMessage(sessionId, content, 'customer', messageType);
            
            // Enhanced AI response for FoodyBuddy
            const aiResponse = await chatService.saveMessage(
                sessionId,
                `Hello ${req.user.name}! I received your message: "${content}". I'm your FoodyBuddy AI assistant, and I have access to information about 82 delicious food products and can help you based on your order history. How can I help you with food recommendations today?`,
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
            const customerId = req.user.phone;
            
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
}

module.exports = new ChatController();

