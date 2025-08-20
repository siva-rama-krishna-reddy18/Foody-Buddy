const chatService = require('../services/chatservice');

class MessageController {
    async updateMessage(req, res) {
        try {
            const { messageId } = req.params;
            const { content, customerId, metadata } = req.body;
            
            if (!content || !customerId) {
                return res.status(400).json({
                    success: false,
                    error: 'Content and customer ID are required'
                });
            }
            
            const updatedMessage = await chatService.updateMessage(messageId, content, customerId, metadata);
            
            res.status(200).json({
                success: true,
                data: { message: updatedMessage },
                message: 'Message updated successfully'
            });
        } catch (error) {
            console.error('Update message error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    async deleteMessage(req, res) {
        try {
            const { messageId } = req.params;
            const { customerId } = req.query;
            
            if (!customerId) {
                return res.status(400).json({
                    success: false,
                    error: 'Customer ID is required'
                });
            }
            
            await chatService.deleteMessage(messageId, customerId);
            
            res.status(200).json({
                success: true,
                message: 'Message deleted successfully'
            });
        } catch (error) {
            console.error('Delete message error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    async getMessageHistory(req, res) {
        try {
            const { sessionId } = req.params;
            const { customerId, limit, offset } = req.query;
            
            if (!customerId) {
                return res.status(400).json({
                    success: false,
                    error: 'Customer ID is required'
                });
            }
            
            const messages = await chatService.getChatHistory(
                sessionId, 
                limit ? parseInt(limit) : 50, 
                offset ? parseInt(offset) : 0,
                customerId
            );
            
            res.status(200).json({
                success: true,
                data: { messages }
            });
        } catch (error) {
            console.error('Get message history error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
}

module.exports = new MessageController();