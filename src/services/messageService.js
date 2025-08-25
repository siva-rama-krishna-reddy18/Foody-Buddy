const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

class MessageService {
    async saveMessage(sessionId, content, sender, messageType = 'text', metadata = null) {
        try {
            const now = new Date();
            const message = await prisma.messages.create({
                data: { id: uuidv4(), session_id: sessionId, content, sender, message_type: messageType, metadata, created_at: now }
            });

            await prisma.chat_sessions.update({
                where: { id: sessionId },
                data: { updated_at: now }
            });

            return message;
        } catch (err) {
            const error = new Error('Failed to save message');
            error.statusCode = 500;
            error.isServiceError = true;
            throw error;
        }
    }

    async getChatHistory(sessionId, limit = 50, offset = 0) {
        try {
            return await prisma.messages.findMany({
                where: { session_id: sessionId },
                orderBy: { created_at: 'asc' },
                take: limit,
                skip: offset
            });
        } catch (err) {
            const error = new Error('Failed to fetch chat history');
            error.statusCode = 500;
            error.isServiceError = true;
            throw error;
        }
    }

    async updateMessage(messageId, content, customerId, metadata = null) {
        try {
            const message = await prisma.messages.findFirst({
                where: { id: messageId, session: { customer_id: customerId } }
            });
            if (!message) {
                const error = new Error('Message not found or access denied');
                error.statusCode = 404;
                error.isServiceError = true;
                throw error;
            }

            return await prisma.messages.update({
                where: { id: messageId },
                data: { content, metadata }
            });
        } catch (err) {
            if (err.isServiceError) throw err;
            const error = new Error('Failed to update message');
            error.statusCode = 500;
            error.isServiceError = true;
            throw error;
        }
    }

    async deleteMessage(messageId, customerId) {
        try {
            const message = await prisma.messages.findFirst({
                where: { id: messageId, session: { customer_id: customerId } }
            });
            if (!message) {
                const error = new Error('Message not found or access denied');
                error.statusCode = 404;
                error.isServiceError = true;
                throw error;
            }

            await prisma.messages.delete({ where: { id: messageId } });
            return true;
        } catch (err) {
            if (err.isServiceError) throw err;
            const error = new Error('Failed to delete message');
            error.statusCode = 500;
            error.isServiceError = true;
            throw error;
        }
    }

}

module.exports = new MessageService();
