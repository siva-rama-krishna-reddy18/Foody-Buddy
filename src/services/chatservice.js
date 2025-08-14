const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

class ChatService {
    async createSession(customerId, title = null) {
        try {
            const now = new Date();
            const session = await prisma.chat_sessions.create({
                data: {
                    id: uuidv4(),
                    customer_id: customerId,
                    title: title || `Chat ${new Date().toLocaleDateString()}`,
                    created_at: now,
                    updated_at: now
                }
            });
            return session;
        } catch (error) {
            console.error('Error creating session:', error);
            throw error;
        }
    }
    
    async getUserSessions(customerId, limit = 20) {
        try {
            const sessions = await prisma.chat_sessions.findMany({
                where: { customer_id: customerId },
                include: {
                    _count: {
                        select: { 
                            messages: true 
                        }
                    }
                },
                orderBy: { updated_at: 'desc' },
                take: limit
            });
            return sessions;
        } catch (error) {
            console.error('Error getting user sessions:', error);
            throw error;
        }
    }
    
    async saveMessage(sessionId, content, sender, messageType = 'text', metadata = null) {
        try {
            const now = new Date();
            const message = await prisma.messages.create({
                data: {
                    id: uuidv4(),
                    session_id: sessionId,
                    content,
                    sender,
                    message_type: messageType,
                    metadata,
                    created_at: now
                }
            });
            
            // Update session updated_at
            await prisma.chat_sessions.update({
                where: { id: sessionId },
                data: { updated_at: new Date() }
            });
            
            return message;
        } catch (error) {
            console.error('Error saving message:', error);
            throw error;
        }
    }
    
    async getChatHistory(sessionId, limit = 50, offset = 0) {
        try {
            const messages = await prisma.messages.findMany({
                where: { session_id: sessionId },
                orderBy: { created_at: 'asc' },
                take: limit,
                skip: offset
            });
            return messages;
        } catch (error) {
            console.error('Error getting chat history:', error);
            throw error;
        }
    }
    
    async getSessionById(sessionId) {
        try {
            return await prisma.chat_sessions.findUnique({
                where: { id: sessionId },
                select: {
                    id: true,
                    customer_id: true,
                    title: true,
                    created_at: true,
                    updated_at: true
                }
            });
        } catch (error) {
            console.error('Error getting session by ID:', error);
            throw error;
        }
    }
    
    async deleteSession(sessionId, customerId) {
        try {
            const session = await prisma.chat_sessions.findFirst({
                where: { id: sessionId, customer_id: customerId }
            });
            
            if (!session) {
                throw new Error('Session not found or access denied');
            }
            
            await prisma.chat_sessions.delete({
                where: { id: sessionId }
            });
            
            return true;
        } catch (error) {
            console.error('Error deleting session:', error);
            throw error;
        }
    }
}

module.exports = new ChatService();

