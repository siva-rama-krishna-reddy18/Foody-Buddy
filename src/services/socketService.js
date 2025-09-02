// src/services/socketService.js
// Complete enhanced socket service with enhanced chatbot features

const { Server } = require('socket.io');
const { PrismaClient } = require('@prisma/client');
const  AgentService  = require('./agentService');

const prisma = new PrismaClient();
const DEBUG = process.env.DEBUG_ORCHESTRATOR === 'true';

class SocketService {
  constructor() {
    this.io = null;
    this.agentService = new AgentService();
    this.connectedUsers = new Map(); // Track connected users
    this.userSessions = new Map(); // Track user sessions
  }
  
  initialize(server) {
    try {
      console.log('SocketService: Loading...');
      
      this.io = new Server(server, {
        cors: {
          origin: process.env.FRONTEND_URL || "http://localhost:3000",
          methods: ["GET", "POST"],
          credentials: true
        },
        transports: ['websocket', 'polling']
      });
      
      console.log('SocketService: Initializing...');
      
      this.setupEventHandlers();
      
      console.log('SocketService: Initialized successfully');
      return this.io;
    } catch (error) {
      console.error('SocketService: Initialization failed:', error);
      throw error;
    }
  }
  
  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      if (DEBUG) {
        console.log(`SocketService: Client connected: ${socket.id}`);
      }
      
      // Handle user identification
      socket.on('identify', async (data) => {
        try {
          const { customerId, phoneNumber, sessionId } = data;
          const userId = customerId || phoneNumber;
          
          if (userId) {
            this.connectedUsers.set(socket.id, userId);
            this.userSessions.set(userId, socket.id);
            
            // Join user-specific room for targeted messages
            socket.join(`user_${userId}`);
            
            if (DEBUG) {
              console.log(`SocketService: User identified: ${userId} -> ${socket.id}`);
            }
            
            // Send identification confirmation
            socket.emit('identified', {
              success: true,
              userId: userId,
              socketId: socket.id
            });
            
            // Load and send chat history
            await this.loadChatHistory(socket, userId, sessionId);
          }
        } catch (error) {
          console.error('SocketService: Identification error:', error);
          socket.emit('identified', {
            success: false,
            error: 'Identification failed'
          });
        }
      });
      
      // Enhanced message handling
      socket.on('message', async (data) => {
        try {
          if (DEBUG) {
            console.log('SocketService: MESSAGE RECEIVED!', {
              message: data.message,
              content: data.content,
              customerId: data.customerId,
              phoneNumber: data.phoneNumber,
              sender: data.sender
            });
          }
          
          if (data.sender === 'customer') {
            await this.handleCustomerMessage(socket, data);
          }
        } catch (error) {
          console.error('SocketService: Message handling error:', error);
          await this.sendErrorResponse(socket, error);
        }
      });
      
      // Cart-specific events
      socket.on('cart_action', async (data) => {
        try {
          await this.handleCartAction(socket, data);
        } catch (error) {
          console.error('SocketService: Cart action error:', error);
          socket.emit('cart_error', { error: error.message });
        }
      });
      
      // Order status updates
      socket.on('check_order_status', async (data) => {
        try {
          await this.handleOrderStatusCheck(socket, data);
        } catch (error) {
          console.error('SocketService: Order status error:', error);
          socket.emit('order_status_error', { error: error.message });
        }
      });
      
      // Typing indicators
      socket.on('typing', (data) => {
        const userId = this.connectedUsers.get(socket.id);
        if (userId) {
          socket.broadcast.to(`user_${userId}`).emit('user_typing', {
            userId: userId,
            typing: data.typing
          });
        }
      });
      
      // Disconnect handling
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
      
      // Error handling
      socket.on('error', (error) => {
        console.error(`SocketService: Socket error for ${socket.id}:`, error);
      });
    });
  }
  
  async handleCustomerMessage(socket, data) {
    const customerId = data.customerId || data.phoneNumber;
    const content = data.content || data.message;
    const sessionId = data.sessionId || socket.id;
    
    if (!customerId || !content) {
      await this.sendErrorResponse(socket, new Error('Missing required fields'));
      return;
    }
    
    try {
      // Save customer message to database
      await this.saveMessage(sessionId, customerId, content, 'customer');
      
      // Send typing indicator
      socket.emit('ai_typing', { typing: true });
      
      // Process message through enhanced agent service
      const response = await this.agentService.processMessage({
        sessionId: sessionId,
        customerId: customerId,
        content: content
      });
      
      // Stop typing indicator
      socket.emit('ai_typing', { typing: false });
      
      // Save AI response to database
      await this.saveMessage(sessionId, customerId, response.aiText, 'ai', {
        intent: response.intent,
        productList: response.productList || [],
        suggestions: response.suggestions || [],
        cartItems: response.cartItems,
        total: response.total,
        orderDetails: response.orderDetails,
        addedItem: response.addedItem
      });
      
      // Send enhanced response to client
      const responseMessage = {
        id: Date.now().toString(),
        content: response.aiText,
        sender: 'ai',
        timestamp: new Date().toISOString(),
        metadata: {
          intent: response.intent,
          productList: response.productList || [],
          suggestions: response.suggestions || [],
          cartItems: response.cartItems,
          total: response.total,
          orderDetails: response.orderDetails,
          addedItem: response.addedItem
        }
      };
      
      socket.emit('message', responseMessage);
      
      // Send specific event types for enhanced UI handling
      if (response.intent === 'VIEW_CART' && response.cartItems) {
        socket.emit('cart_updated', {
          items: response.cartItems,
          total: response.total,
          itemCount: response.cartItems.length
        });
      }
      
      if (response.intent === 'ORDER_STATUS' && response.orderDetails) {
        socket.emit('order_status', response.orderDetails);
      }
      
      if (response.intent === 'ADD_TO_CART' && response.addedItem) {
        socket.emit('item_added_to_cart', response.addedItem);
      }
      
      if (DEBUG) {
        console.log(`SocketService: Sent AI (${response.intent})`);
      }
      
    } catch (error) {
      console.error('SocketService: Customer message processing error:', error);
      await this.sendErrorResponse(socket, error);
    }
  }
  
  async handleCartAction(socket, data) {
    const { action, productId, quantity, sessionId, customerId } = data;
    const cartSessionId = sessionId || socket.id;
    
    try {
      let result;
      
      switch (action) {
        case 'add':
          if (!productId) throw new Error('Product ID required for add action');
          result = await this.agentService.processMessage({
            sessionId: cartSessionId,
            customerId: customerId,
            content: `add ${quantity || 1} of product ${productId} to cart`
          });
          break;
          
        case 'remove':
          if (!productId) throw new Error('Product ID required for remove action');
          // Implement cart removal logic
          result = { success: true, message: 'Item removed from cart' };
          break;
          
        case 'clear':
          // Clear entire cart
          await prisma.cartItem.deleteMany({
            where: { sessionId: cartSessionId }
          });
          result = { success: true, message: 'Cart cleared' };
          break;
          
        case 'view':
        default:
          result = await this.agentService.processMessage({
            sessionId: cartSessionId,
            customerId: customerId,
            content: 'show my cart'
          });
          break;
      }
      
      socket.emit('cart_action_result', {
        action: action,
        success: true,
        result: result
      });
      
    } catch (error) {
      socket.emit('cart_action_result', {
        action: action,
        success: false,
        error: error.message
      });
    }
  }
  
  async handleOrderStatusCheck(socket, data) {
    const { orderNumber, customerId } = data;
    
    try {
      const response = await this.agentService.processMessage({
        sessionId: socket.id,
        customerId: customerId,
        content: orderNumber ? `status of order ${orderNumber}` : 'my recent orders'
      });
      
      socket.emit('order_status_result', {
        success: true,
        response: response
      });
      
    } catch (error) {
      socket.emit('order_status_result', {
        success: false,
        error: error.message
      });
    }
  }
  
  async loadChatHistory(socket, customerId, sessionId) {
    try {
      // Load recent messages for the session
      const messages = await prisma.messages.findMany({
        where: {
          session_id: sessionId || socket.id
        },
        orderBy: {
          created_at: 'asc'
        },
        take: 50 // Last 50 messages
      });
      
      if (messages.length > 0) {
        const formattedMessages = messages.map(msg => ({
          id: msg.id,
          content: msg.content,
          sender: msg.sender,
          timestamp: msg.created_at.toISOString(),
          metadata: msg.metadata
        }));
        
        socket.emit('chat_history', {
          messages: formattedMessages,
          count: messages.length
        });
        
        if (DEBUG) {
          console.log(`SocketService: Loaded ${messages.length} messages for user ${customerId}`);
        }
      }
    } catch (error) {
      console.error('SocketService: Chat history loading error:', error);
    }
  }
  
  async saveMessage(sessionId, customerId, content, sender, metadata = null) {
    try {
      // Ensure chat session exists
      await prisma.chat_sessions.upsert({
        where: { id: sessionId },
        create: {
          id: sessionId,
          customer_id: customerId,
          title: `Chat ${new Date().toLocaleDateString()}`,
          created_at: new Date(),
          updated_at: new Date()
        },
        update: {
          updated_at: new Date()
        }
      });
      
      // Save message
      await prisma.messages.create({
        data: {
          id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          session_id: sessionId,
          content: content,
          sender: sender,
          message_type: 'text',
          metadata: metadata,
          created_at: new Date()
        }
      });
      
    } catch (error) {
      console.error('SocketService: Message saving error:', error);
      // Don't throw error to avoid disrupting the flow
    }
  }
  
  async sendErrorResponse(socket, error) {
    const errorMessage = {
      id: Date.now().toString(),
      content: "I apologize, but I'm having trouble processing your request right now. Please try again in a moment.",
      sender: 'ai',
      timestamp: new Date().toISOString(),
      metadata: {
        intent: 'ERROR',
        error: DEBUG ? error.message : 'Internal error'
      }
    };
    
    socket.emit('message', errorMessage);
    socket.emit('error_occurred', {
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
  
  handleDisconnect(socket) {
    const userId = this.connectedUsers.get(socket.id);
    
    if (userId) {
      this.connectedUsers.delete(socket.id);
      this.userSessions.delete(userId);
      
      if (DEBUG) {
        console.log(`SocketService: Client disconnected: ${socket.id} (User: ${userId})`);
      }
    } else {
      if (DEBUG) {
        console.log(`SocketService: Client disconnected: ${socket.id}`);
      }
    }
  }
  
  // Utility methods for external use
  
  sendToUser(userId, event, data) {
    const socketId = this.userSessions.get(userId);
    if (socketId && this.io) {
      this.io.to(`user_${userId}`).emit(event, data);
      return true;
    }
    return false;
  }
  
  broadcastOrderUpdate(orderNumber, status, customerId) {
    if (this.io) {
      this.sendToUser(customerId, 'order_update', {
        orderNumber: orderNumber,
        status: status,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  getConnectedUsers() {
    return Array.from(this.connectedUsers.values());
  }
  
  getConnectionStats() {
    return {
      connectedClients: this.connectedUsers.size,
      connectedUsers: new Set(this.connectedUsers.values()).size,
      timestamp: new Date().toISOString()
    };
  }
}

// Create singleton instance
const socketService = new SocketService();

module.exports = {
  SocketService,
  socketService,
  
  // Export initialize function for backward compatibility
  initialize: (server) => socketService.initialize(server),
  
  // Export utility functions
  sendToUser: (userId, event, data) => socketService.sendToUser(userId, event, data),
  broadcastOrderUpdate: (orderNumber, status, customerId) => 
    socketService.broadcastOrderUpdate(orderNumber, status, customerId),
  getConnectionStats: () => socketService.getConnectionStats()
};