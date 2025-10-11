// src/services/messageService.js
const { v4: uuidv4 } = require('uuid');
const Message = require('../../models/Message');
const ChatSession = require('../../models/ChatSession');

/**
 * Persist a chat message and bump the session's updated_at.
 */
async function saveMessage(sessionId, content, sender, messageType = 'text', metadata = null) {
  const id = uuidv4();

  const msg = await Message.create({
    id,
    session_id: sessionId,
    content,
    sender,                    // 'customer' | 'ai' | 'system'
    message_type: messageType, // 'text' by default
    metadata,                  // JSON or null
    created_at: new Date()
  });

  // Keep session fresh in lists
  await ChatSession.findOneAndUpdate(
    { id: sessionId },
    { updated_at: new Date() }
  );

  return msg;
}

/**
 * Read chronological history (paged).
 */
async function getChatHistory(sessionId, limit = 50, offset = 0) {
  return Message.find({ session_id: sessionId })
    .sort({ created_at: 1 })
    .limit(limit)
    .skip(offset)
    .lean();
}

/**
 * Update one message (authz: session must belong to customerId).
 */
async function updateMessage(messageId, content, customerId, metadata = null) {
  const msg = await Message.findOne({ id: messageId }).lean();
  if (!msg) throw new Error('Message not found');

  const session = await ChatSession.findOne({ id: msg.session_id })
    .select('customer_id')
    .lean();
    
  if (!session || session.customer_id !== customerId) {
    throw new Error('Access denied');
  }

  const updateData = { content };
  if (metadata !== null) {
    updateData.metadata = metadata;
  }

  const updated = await Message.findOneAndUpdate(
    { id: messageId },
    updateData,
    { new: true }
  );

  await ChatSession.findOneAndUpdate(
    { id: msg.session_id },
    { updated_at: new Date() }
  );

  return updated;
}

/**
 * Delete one message (authz: session must belong to customerId).
 */
async function deleteMessage(messageId, customerId) {
  const msg = await Message.findOne({ id: messageId }).lean();
  if (!msg) throw new Error('Message not found');

  const session = await ChatSession.findOne({ id: msg.session_id })
    .select('customer_id')
    .lean();
    
  if (!session || session.customer_id !== customerId) {
    throw new Error('Access denied');
  }

  await Message.deleteOne({ id: messageId });

  await ChatSession.findOneAndUpdate(
    { id: msg.session_id },
    { updated_at: new Date() }
  );

  return true;
}

module.exports = {
  saveMessage,
  getChatHistory,
  updateMessage,
  deleteMessage,
};