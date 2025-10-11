// src/services/chatService.js
const { v4: uuidv4 } = require('uuid');
const ChatSession = require('../../models/ChatSession');
const Message = require('../../models/Message');

const messageService = require('./messageService');
const aiResponseService = require('./aiResponseService');

class ChatService {
  // ---- Session APIs (authoritative here) ----
  async createSession(customerId, title = null) {
    try {
      const now = new Date();
      return await ChatSession.create({
        id: uuidv4(),
        customer_id: customerId,
        title: title || `Chat ${new Date().toLocaleDateString()}`,
        created_at: now,
        updated_at: now
      });
    } catch (error) {
      console.error('Error creating session:', error);
      throw error;
    }
  }

  async getUserSessions(customerId, limit = 20) {
    try {
      const sessions = await ChatSession.find({ customer_id: customerId })
        .sort({ updated_at: -1 })
        .limit(limit)
        .lean();

      // Add message count for each session
      const sessionsWithCount = await Promise.all(
        sessions.map(async (session) => {
          const messageCount = await Message.countDocuments({ session_id: session.id });
          return {
            ...session,
            _count: {
              messages: messageCount
            }
          };
        })
      );

      return sessionsWithCount;
    } catch (error) {
      console.error('Error getting user sessions:', error);
      throw error;
    }
  }

  async getSessionById(sessionId) {
    try {
      return await ChatSession.findOne({ id: sessionId })
        .select('id customer_id title created_at updated_at')
        .lean();
    } catch (error) {
      console.error('Error getting session by ID:', error);
      throw error;
    }
  }

  async deleteSession(sessionId, customerId) {
    try {
      const session = await ChatSession.findOne({
        id: sessionId,
        customer_id: customerId
      });

      if (!session) {
        throw new Error('Session not found or access denied');
      }

      // Delete all messages in this session first
      await Message.deleteMany({ session_id: sessionId });

      // Delete the session
      await ChatSession.deleteOne({ id: sessionId });

      return true;
    } catch (error) {
      console.error('Error deleting session:', error);
      throw error;
    }
  }

  async updateSessionTitle(sessionId, title) {
    try {
      return await ChatSession.findOneAndUpdate(
        { id: sessionId },
        { 
          title, 
          updated_at: new Date() 
        },
        { new: true }
      );
    } catch (error) {
      console.error('Error updating session title:', error);
      throw error;
    }
  }

  async getSessionWithMessages(sessionId, customerId) {
    try {
      const session = await ChatSession.findOne({
        id: sessionId,
        customer_id: customerId
      }).lean();

      if (!session) {
        throw new Error('Session not found or access denied');
      }

      // Get messages for this session
      const messages = await Message.find({ session_id: sessionId })
        .sort({ created_at: 1 })
        .lean();

      return {
        ...session,
        messages
      };
    } catch (error) {
      console.error('Error getting session with messages:', error);
      throw error;
    }
  }

  // ---- Backward-compatibility pass-throughs ----
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

  // Kept for compatibility
  async getAIResponse(message, sessionId, options) {
    return aiResponseService.getAIResponse(message, sessionId, options);
  }
}

module.exports = new ChatService();