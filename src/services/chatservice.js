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
                    metadata: metadata || null,
                    created_at: now
                }
            });
            
            // Update session updated_at
            await prisma.chat_sessions.update({
                where: { id: sessionId },
                data: { 
                    updated_at: new Date()
                }
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

    // NEW WEEK 2 METHODS
    async updateSessionTitle(sessionId, title) {
        try {
            return await prisma.chat_sessions.update({
                where: { id: sessionId },
                data: { 
                    title, 
                    updated_at: new Date() 
                }
            });
        } catch (error) {
            console.error('Error updating session title:', error);
            throw error;
        }
    }

    async getSessionWithMessages(sessionId, customerId) {
        try {
            const session = await prisma.chat_sessions.findFirst({
                where: { 
                    id: sessionId,
                    customer_id: customerId 
                },
                include: {
                    messages: {
                        orderBy: { created_at: 'asc' }
                    }
                }
            });
            
            if (!session) {
                throw new Error('Session not found or access denied');
            }
            
            return session;
        } catch (error) {
            console.error('Error getting session with messages:', error);
            throw error;
        }
    }

    async getAIResponse(message, sessionId) {
        try {
            console.log(`Getting AI response for message: "${message}" in session: ${sessionId}`);
            
            // Generate AI response based on the message
            let aiResponse;
            const lowerMessage = message.toLowerCase();
            
            // Enhanced rule-based responses for FoodyBuddy
            if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('hey')) {
                aiResponse = "Hello! Welcome to FoodyBuddy! I'm your food assistant. How can I help you today? I can help with menu recommendations, order placement, and answer any food-related questions!";
            } 
            else if (lowerMessage.includes('recommend') || lowerMessage.includes('suggest') || lowerMessage.includes('popular')) {
                aiResponse = "Today's Recommendations!\n\nMOST POPULAR:\n• Margherita Pizza - $12.99 (Fresh basil, mozzarella, San Marzano tomatoes)\n• Classic Beef Burger - $8.99 (Our signature burger with crispy fries)\n• Spaghetti Carbonara - $12.99 (Authentic Italian recipe)\n\nBEST VALUE:\n• Lunch Combo - $9.99 (Any pasta + drink + garlic bread)\n• Pizza Deal - $16.99 (Large pizza + 2 drinks)\n\nHEALTHY OPTIONS:\n• Caesar Salad with Grilled Chicken - $9.99\n• Veggie Burger - $8.49\n\nWhat sounds good to you? I can tell you more about any of these!";
            }
            else if (lowerMessage.includes('deal') || lowerMessage.includes('offer') || lowerMessage.includes('special')) {
                aiResponse = "Current Deals & Specials!\n\nLIMITED TIME OFFERS:\n• Family Feast - $24.99 (2 Large pizzas + 4 drinks + garlic bread) - SAVE $8!\n• Lunch Special - $7.99 (11AM-3PM) - Any burger + fries + drink\n• Student Discount - 15% off with valid ID\n\nDAILY SPECIALS:\n• Monday: Pizza Monday - Buy 1 Get 1 Half Off\n• Wednesday: Wings Wednesday - $0.50 per wing\n• Friday: Fish Friday - Fresh fish dishes starting $11.99\n\nDELIVERY:\n• Free delivery on orders over $25\n• $2.99 delivery fee for smaller orders\n\nWhich deal interests you most?";
            }
            else if (lowerMessage.includes('menu') || lowerMessage.includes('food') || lowerMessage.includes('eat')) {
                aiResponse = "Here are our popular menu categories!\n\nPIZZA ($12.99 - $18.99)\n- Margherita, Pepperoni, BBQ Chicken, Veggie Supreme\n\nBURGERS ($8.99 - $12.99)\n- Classic Beef, Chicken Deluxe, Veggie Burger, BBQ Bacon\n\nPASTA ($10.99 - $14.99)\n- Spaghetti Carbonara, Penne Arrabbiata, Fettuccine Alfredo\n\nSALADS ($7.99 - $9.99)\n- Caesar, Greek, Garden Fresh, Chicken Caesar\n\nWhat type of food sounds good to you?";
            } 
            else if (lowerMessage.includes('pizza')) {
                aiResponse = "Great choice! Our pizzas are made fresh daily:\n\n• Margherita - $12.99 (Fresh basil, mozzarella, tomato)\n• Pepperoni - $14.99 (Classic pepperoni with cheese)\n• BBQ Chicken - $16.99 (BBQ sauce, chicken, red onions)\n• Veggie Supreme - $15.99 (Bell peppers, mushrooms, olives)\n• Meat Lovers - $18.99 (Pepperoni, sausage, bacon, ham)\n\nWhich pizza would you like to order? I can also help with custom toppings!";
            } 
            else if (lowerMessage.includes('burger')) {
                aiResponse = "Awesome! Our burgers are juicy and delicious:\n\n• Classic Beef - $8.99 (Lettuce, tomato, onion, pickle)\n• Chicken Deluxe - $9.99 (Grilled chicken, avocado, bacon)\n• Veggie Burger - $8.49 (Plant-based patty, fresh veggies)\n• BBQ Bacon - $11.99 (BBQ sauce, crispy bacon, onion rings)\n• Double Cheese - $12.99 (Two patties, double cheese)\n\nAll burgers come with crispy fries! Which one catches your eye?";
            } 
            else if (lowerMessage.includes('pasta')) {
                aiResponse = "Perfect! Our pasta dishes are made with authentic Italian recipes:\n\n• Spaghetti Carbonara - $12.99 (Eggs, bacon, parmesan)\n• Penne Arrabbiata - $10.99 (Spicy tomato sauce, herbs)\n• Fettuccine Alfredo - $11.99 (Creamy white sauce, parmesan)\n• Lasagna - $14.99 (Layered with meat sauce and cheese)\n• Pasta Primavera - $11.49 (Fresh vegetables, light sauce)\n\nWhich pasta dish would you like to try?";
            } 
            else if (lowerMessage.includes('order') || lowerMessage.includes('buy') || lowerMessage.includes('purchase')) {
                aiResponse = "Excellent! I'd love to help you place an order.\n\nTo get started:\n1. Tell me what items you'd like\n2. I'll confirm the details and prices\n3. We'll proceed to checkout\n\nWhat would you like to add to your cart?";
            } 
            else if (lowerMessage.includes('price') || lowerMessage.includes('cost') || lowerMessage.includes('how much')) {
                aiResponse = "Here are our price ranges!\n\nPizza: $12.99 - $18.99\nBurgers: $8.99 - $12.99\nPasta: $10.99 - $14.99\nSalads: $7.99 - $9.99\nDrinks: $1.99 - $3.99\nDesserts: $4.99 - $7.99\n\nFree delivery on orders over $25! What specific item would you like to know about?";
            }
            else if (lowerMessage.includes('delivery') || lowerMessage.includes('pickup')) {
                aiResponse = "We offer both delivery and pickup!\n\nDELIVERY:\n- Free delivery on orders $25+\n- $2.99 delivery fee for smaller orders\n- Average time: 25-35 minutes\n- We deliver within 5 miles\n\nPICKUP:\n- Always free\n- Ready in 15-20 minutes\n- Call when you arrive for curbside service\n\nWhich option works better for you?";
            } 
            else if (lowerMessage.includes('thank') || lowerMessage.includes('thanks')) {
                aiResponse = "You're very welcome! I'm here whenever you need help with your FoodyBuddy order. Anything else I can assist you with?";
            } 
            else if (lowerMessage.includes('help')) {
                aiResponse = "I'm here to help! I can assist you with:\n\n- Menu Information - Browse our full menu\n- Order Placement - Help you order your favorites\n- Pricing - Get costs for any items\n- Delivery Info - Delivery times and areas\n- Recommendations - Suggest popular items\n- Questions - Answer anything about our food\n\nWhat would you like help with?";
            } 
            else {
                aiResponse = `Thanks for your message! I'm your FoodyBuddy assistant and I'd love to help you with our delicious food options!\n\nI can help you with menu information, place orders, check prices, or answer any questions about our food.\n\nYou said: "${message}"\n\nWhat would you like to know more about? Just say "menu" to see our full selection!`;
            }
            
            console.log(`AI Response generated: ${aiResponse.substring(0, 100)}...`);
            return aiResponse;
            
        } catch (error) {
            console.error('Error in getAIResponse:', error);
            return "Sorry, I'm having trouble processing your request right now. Please try again in a moment.";
        }
    }
}

module.exports = new ChatService();