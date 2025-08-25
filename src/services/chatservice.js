const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

class ChatSessionService {
    async createSession(customerId, title = null) {
        try {
            const now = new Date();
            return await prisma.chat_sessions.create({
                data: {
                    id: uuidv4(),
                    customer_id: customerId,
                    title: title || `Chat ${new Date().toLocaleDateString()}`,
                    created_at: now,
                    updated_at: now
                }
            });
        } catch (err) {
            const error = new Error('Failed to create chat session');
            error.statusCode = 500;
            error.isServiceError = true;
            throw error;
        }
    }

    async getUserSessions(customerId, limit = 20) {
        try {
            return await prisma.chat_sessions.findMany({
                where: { customer_id: customerId },
                include: { _count: { select: { messages: true } } },
                orderBy: { updated_at: 'desc' },
                take: limit
            });
        } catch (err) {
            const error = new Error('Failed to fetch user sessions');
            error.statusCode = 500;
            error.isServiceError = true;
            throw error;
        }
    }

    async getSessionById(sessionId) {
        try {
            const session = await prisma.chat_sessions.findUnique({
                where: { id: sessionId },
                select: { id: true, customer_id: true, title: true, created_at: true, updated_at: true }
            });
            if (!session) {
                const error = new Error('Session not found');
                error.statusCode = 404;
                error.isServiceError = true;
                throw error;
            }
            return session;
        } catch (err) {
            if (err.isServiceError) throw err;
            const error = new Error('Failed to fetch session');
            error.statusCode = 500;
            error.isServiceError = true;
            throw error;
        }
    }

    async deleteSession(sessionId, customerId) {
        try {
            const session = await prisma.chat_sessions.findFirst({
                where: { id: sessionId, customer_id: customerId }
            });
            if (!session) {
                const error = new Error('Session not found or access denied');
                error.statusCode = 404;
                error.isServiceError = true;
                throw error;
            }
            await prisma.chat_sessions.delete({ where: { id: sessionId } });
            return true;
        } catch (err) {
            if (err.isServiceError) throw err;
            const error = new Error('Failed to delete session');
            error.statusCode = 500;
            error.isServiceError = true;
            throw error;
        }
    }

    async updateSessionTitle(sessionId, title) {
        try {
            return await prisma.chat_sessions.update({
                where: { id: sessionId },
                data: { title, updated_at: new Date() }
            });
        } catch (err) {
            const error = new Error('Failed to update session title');
            error.statusCode = 500;
            error.isServiceError = true;
            throw error;
        }
    }

    async getSessionWithMessages(sessionId, customerId) {
        try {
            const session = await prisma.chat_sessions.findFirst({
                where: { id: sessionId, customer_id: customerId },
                include: { messages: { orderBy: { created_at: 'asc' } } }
            });
            if (!session) {
                const error = new Error('Session not found or access denied');
                error.statusCode = 404;
                error.isServiceError = true;
                throw error;
            }
            return session;
        } catch (err) {
            if (err.isServiceError) throw err;
            const error = new Error('Failed to fetch session with messages');
            error.statusCode = 500;
            error.isServiceError = true;
            throw error;
        }
    }
}

module.exports = new ChatSessionService();
