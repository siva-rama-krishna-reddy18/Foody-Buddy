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

    // *** NEW METHOD - This is what was missing! ***
    async getAIResponse(message, sessionId) {
        try {
            console.log(`Getting AI response for message: "${message}" in session: ${sessionId}`);
            
            // First, save the customer's message to database
            await this.saveMessage(sessionId, message, 'customer');
            
            // Get recent conversation history for context (last 10 messages)
            const recentHistory = await this.getChatHistory(sessionId, 10);
            
            // Generate AI response based on the message
            let aiResponse;
            const lowerMessage = message.toLowerCase();
            
            // Simple rule-based responses for FoodyBuddy
            if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('hey')) {
                aiResponse = "Hello! Welcome to FoodyBuddy! 🍕 I'm your food assistant. How can I help you today? I can help with menu recommendations, order placement, and answer any food-related questions!";
            } 
            else if (lowerMessage.includes('menu') || lowerMessage.includes('food') || lowerMessage.includes('eat')) {
                aiResponse = "Here are our popular menu categories:\n\n🍕 **Pizza** - Starting from $12.99\n🍔 **Burgers** - Starting from $8.99\n🍜 **Pasta** - Starting from $10.99\n🥗 **Salads** - Starting from $7.99\n🍗 **Chicken** - Starting from $9.99\n🌮 **Mexican** - Starting from $6.99\n\nWhat type of food are you in the mood for?";
            } 
            else if (lowerMessage.includes('pizza')) {
                aiResponse = "Great choice! 🍕 Our pizza menu includes:\n\n• **Margherita** - $12.99\n• **Pepperoni** - $14.99\n• **BBQ Chicken** - $16.99\n• **Vegetarian** - $13.99\n• **Meat Lovers** - $18.99\n\nWhich pizza would you like to order? I can also customize toppings for you!";
            } 
            else if (lowerMessage.includes('burger')) {
                aiResponse = "Perfect! 🍔 Our burger selection:\n\n• **Classic Beef** - $8.99\n• **Cheeseburger** - $9.99\n• **Chicken Burger** - $9.49\n• **Veggie Burger** - $8.49\n• **BBQ Bacon** - $11.99\n\nAll burgers come with fries. Which one sounds good to you?";
            } 
            else if (lowerMessage.includes('order') || lowerMessage.includes('buy') || lowerMessage.includes('purchase')) {
                aiResponse = "Excellent! I'd love to help you place an order. 🛒\n\nTo get started:\n1. Tell me what items you'd like\n2. I'll confirm the details and prices\n3. We'll proceed to checkout\n\nWhat would you like to add to your cart?";
            } 
            else if (lowerMessage.includes('price') || lowerMessage.includes('cost') || lowerMessage.includes('how much')) {
                aiResponse = "Our prices are very competitive! 💰\n\n**Quick Price Guide:**\n• Appetizers: $4.99 - $8.99\n• Main dishes: $8.99 - $18.99\n• Desserts: $3.99 - $6.99\n• Drinks: $1.99 - $4.99\n\nWhat specific item would you like the price for?";
            } 
            else if (lowerMessage.includes('delivery') || lowerMessage.includes('pickup')) {
                aiResponse = "We offer both delivery and pickup! 🚗\n\n**Delivery:**\n• Free delivery on orders over $25\n• $2.99 delivery fee for smaller orders\n• Average delivery time: 25-35 minutes\n\n**Pickup:**\n• Always free\n• Ready in 15-20 minutes\n• Call when you arrive for curbside pickup\n\nWhich option works better for you?";
            } 
            else if (lowerMessage.includes('thank') || lowerMessage.includes('thanks')) {
                aiResponse = "You're very welcome! 😊 I'm here to help whenever you need assistance with your food orders. Is there anything else I can help you with today?";
            } 
            else {
                // Generic helpful response
                aiResponse = `Thanks for your message! I'm FoodyBuddy's AI assistant, and I'm here to help you with:\n\n🍽️ **Menu recommendations**\n📝 **Placing orders**\n💰 **Pricing information**\n🚗 **Delivery & pickup options**\n❓ **Any food-related questions**\n\nYou said: "${message}"\n\nWhat would you like to know more about?`;
            }
            
            // Save the AI response to database
            await this.saveMessage(sessionId, aiResponse, 'ai');
            
            console.log(`AI Response generated and saved: ${aiResponse.substring(0, 100)}...`);
            return aiResponse;
            
        } catch (error) {
            console.error('Error in getAIResponse:', error);
            
            // Save error message to database
            const errorResponse = "Sorry, I'm having trouble processing your request right now. Please try again in a moment. 🤖";
            
            try {
                await this.saveMessage(sessionId, errorResponse, 'ai');
            } catch (saveError) {
                console.error('Error saving error message:', saveError);
            }
            
            return errorResponse;
        }
    }
}

module.exports = new ChatService();