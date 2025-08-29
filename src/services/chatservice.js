const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');

const messageService = require('./messageService');          // delegate for messages
const aiResponseService = require('./aiResponseService');    // delegate for AI (compat)

const prisma = new PrismaClient();

class ChatService {
  // ---- Session APIs (authoritative here) ----
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
    } catch (error) {
      console.error('Error creating session:', error);
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
    } catch (error) {
      console.error('Error getting user sessions:', error);
      throw error;
    }
  }

  async getSessionById(sessionId) {
    try {
      return await prisma.chat_sessions.findUnique({
        where: { id: sessionId },
        select: { id: true, customer_id: true, title: true, created_at: true, updated_at: true }
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
      if (!session) throw new Error('Session not found or access denied');

      await prisma.chat_sessions.delete({ where: { id: sessionId } });
      return true;
    } catch (error) {
      console.error('Error deleting session:', error);
      throw error;
    }
  }

  async updateSessionTitle(sessionId, title) {
    try {
      return await prisma.chat_sessions.update({
        where: { id: sessionId },
        data: { title, updated_at: new Date() }
      });
    } catch (error) {
      console.error('Error updating session title:', error);
      throw error;
    }
  }

  async getSessionWithMessages(sessionId, customerId) {
    try {
      const session = await prisma.chat_sessions.findFirst({
        where: { id: sessionId, customer_id: customerId },
        include: { messages: { orderBy: { created_at: 'asc' } } }
      });
      if (!session) throw new Error('Session not found or access denied');
      return session;
    } catch (error) {
      console.error('Error getting session with messages:', error);
      throw error;
    }
  }

  // ---- Backward-compatibility pass-throughs (prefer using messageService directly) ----
  async saveMessage(sessionId, content, sender, messageType = 'text', metadata = null) {
    return messageService.saveMessage(sessionId, content, sender, messageType, metadata);
  }

  async getChatHistory(sessionId, limit = 50, offset = 0) {
    return messageService.getChatHistory(sessionId, limit, offset);
  }

  async updateMessage(messageId, content, customerId, metadata = null) {
    return messageService.updateMessage(messageId, content, customerId, metadata);
  }

  async deleteMessage(messageId, customerId) {
    return messageService.deleteMessage(messageId, customerId);
  }

  // Kept for compatibility; controllers should call aiResponseService directly or via orchestrator
  async getAIResponse(message, sessionId, options) {
    return aiResponseService.getAIResponse(message, sessionId, options);
  }
}

module.exports = new ChatService();
