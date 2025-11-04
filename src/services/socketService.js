// src/services/socketService.js
// Complete enhanced socket service with enhanced chatbot features

const { Server } = require('socket.io');
const agentService = require('./agentService'); 
const ChatSession = require('../../models/ChatSession');
const Message = require('../../models/Message');
const { v4: uuidv4 } = require('uuid');

const DEBUG = process.env.DEBUG_ORCHESTRATOR === 'true';

class SocketService {
  constructor() {
    this.io = null;
    this.agentService = agentService; // Use imported instance
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
          
          if (data.sender === 'customer' || data.sender === 'user') {
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
    const content = data.content || data.message || data.text;
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
      const response = await this.agentService.processMessage(customerId, content);
      
      // Stop typing indicator
      socket.emit('ai_typing', { typing: false });
      
      // Save AI response to database
      await this.saveMessage(sessionId, customerId, response.aiText, 'ai', {
        intent: response.intent,
        productList: response.productList || [],
        suggestions: response.meta?.suggestions || [],
        cartData: response.cartData,
        orderData: response.orderData
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
          suggestions: response.meta?.suggestions || [],
          cartData: response.cartData,
          orderData: response.orderData,
          addToCart: response.addToCart
        }
      };
      
      socket.emit('message', responseMessage);
      
      // Send specific event types for enhanced UI handling
      if (response.intent === 'VIEW_CART' && response.cartData) {
        socket.emit('cart_updated', response.cartData);
      }
      
      if (response.intent === 'ORDER_STATUS' && response.orderData) {
        socket.emit('order_status', response.orderData);
      }
      
      if (response.intent === 'ADD_TO_CART' && response.addToCart) {
        socket.emit('item_added_to_cart', response.addToCart);
      }
      
      if (DEBUG) {
        console.log(`SocketService: Sent AI response (${response.intent})`);
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
          result = await this.agentService.processMessage(
            customerId,
            `add ${quantity || 1} of product ${productId} to cart`
          );
          break;
          
        case 'remove':
          if (!productId) throw new Error('Product ID required for remove action');
          result = await this.agentService.processMessage(
            customerId,
            `remove product ${productId} from cart`
          );
          break;
          
        case 'clear':
          result = await this.agentService.processMessage(
            customerId,
            'clear my cart'
          );
          break;
          
        case 'view':
        default:
          result = await this.agentService.processMessage(
            customerId,
            'show my cart'
          );
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
      const response = await this.agentService.processMessage(
        customerId,
        orderNumber ? `status of order ${orderNumber}` : 'my recent orders'
      );
      
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
      const messages = await Message.find({
        session_id: sessionId || socket.id
      })
      .sort({ created_at: 1 })
      .limit(50)
      .lean();
      
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
      await ChatSession.findOneAndUpdate(
        { id: sessionId },
        {
          id: sessionId,
          customer_id: customerId,
          title: `Chat ${new Date().toLocaleDateString()}`,
          updated_at: new Date()
        },
        {
          upsert: true,
          setDefaultsOnInsert: true
        }
      );
      
      // Save message
      await Message.create({
        id: uuidv4(),
        session_id: sessionId,
        content: content,
        sender: sender,
        message_type: 'text',
        metadata: metadata,
        created_at: new Date()
      });
      
    } catch (error) {
      if (DEBUG) {
        console.error('SocketService: Message saving error:', error);
      }
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