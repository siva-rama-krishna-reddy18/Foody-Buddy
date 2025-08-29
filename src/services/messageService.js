// src/services/messageService.js
const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

/**
 * Persist a chat message and bump the session's updated_at.
 */
async function saveMessage(sessionId, content, sender, messageType = 'text', metadata = null) {
  const id = uuidv4();

  const msg = await prisma.messages.create({
    data: {
      id,
      session_id: sessionId,
      content,
      sender,                    // 'customer' | 'ai' | 'system'
      message_type: messageType, // 'text' by default
      metadata                   // JSON or null
    }
  });

  // Keep session fresh in lists
  await prisma.chat_sessions.update({
    where: { id: sessionId },
    data: { updated_at: new Date() }
  });

  return msg;
}

/**
 * Read chronological history (paged).
 */
async function getChatHistory(sessionId, limit = 50, offset = 0) {
  return prisma.messages.findMany({
    where: { session_id: sessionId },
    orderBy: { created_at: 'asc' },
    take: limit,
    skip: offset
  });
}

/**
 * Update one message (authz: session must belong to customerId).
 */
async function updateMessage(messageId, content, customerId, metadata = null) {
  const msg = await prisma.messages.findUnique({ where: { id: messageId } });
  if (!msg) throw new Error('Message not found');

  const session = await prisma.chat_sessions.findUnique({
    where: { id: msg.session_id },
    select: { customer_id: true }
  });
  if (!session || session.customer_id !== customerId) throw new Error('Access denied');

  const updated = await prisma.messages.update({
    where: { id: messageId },
    data: { content, metadata }
  });

  await prisma.chat_sessions.update({
    where: { id: msg.session_id },
    data: { updated_at: new Date() }
  });

  return updated;
}

/**
 * Delete one message (authz: session must belong to customerId).
 */
async function deleteMessage(messageId, customerId) {
  const msg = await prisma.messages.findUnique({ where: { id: messageId } });
  if (!msg) throw new Error('Message not found');

  const session = await prisma.chat_sessions.findUnique({
    where: { id: msg.session_id },
    select: { customer_id: true }
  });
  if (!session || session.customer_id !== customerId) throw new Error('Access denied');

  await prisma.messages.delete({ where: { id: messageId } });

  await prisma.chat_sessions.update({
    where: { id: msg.session_id },
    data: { updated_at: new Date() }
  });

  return true;
}

module.exports = {
  saveMessage,
  getChatHistory,
  updateMessage,
  deleteMessage,
};
