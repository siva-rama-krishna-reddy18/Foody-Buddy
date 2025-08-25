class AIResponseService {
    async getAIResponse(message, sessionId) {
        try {
            console.log(`Getting AI response for message: "${message}" in session: ${sessionId}`);

            const lowerMessage = message.toLowerCase();
            let aiResponse;

            // Rule-based responses
            if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('hey')) {
                aiResponse = "Hello! Welcome to FoodyBuddy! I'm your food assistant. How can I help you today? I can help with menu recommendations, order placement, and answer any food-related questions!";
            } 
            else if (lowerMessage.includes('recommend') || lowerMessage.includes('suggest') || lowerMessage.includes('popular')) {
                aiResponse = "Today's Recommendations!\n\nMOST POPULAR:\n• Margherita Pizza - $12.99 ...";
            }
            else if (lowerMessage.includes('deal') || lowerMessage.includes('offer') || lowerMessage.includes('special')) {
                aiResponse = "Current Deals & Specials!\n\nLIMITED TIME OFFERS:\n• Family Feast - $24.99 ...";
            }
            else if (lowerMessage.includes('menu') || lowerMessage.includes('food') || lowerMessage.includes('eat')) {
                aiResponse = "Here are our popular menu categories!\n\nPIZZA ($12.99 - $18.99)...";
            }
            else if (lowerMessage.includes('pizza')) {
                aiResponse = "Great choice! Our pizzas are made fresh daily:\n• Margherita - $12.99 ...";
            }
            else if (lowerMessage.includes('burger')) {
                aiResponse = "Awesome! Our burgers are juicy and delicious:\n• Classic Beef - $8.99 ...";
            }
            else if (lowerMessage.includes('pasta')) {
                aiResponse = "Perfect! Our pasta dishes are made with authentic Italian recipes:\n• Spaghetti Carbonara - $12.99 ...";
            }
            else if (lowerMessage.includes('order') || lowerMessage.includes('buy') || lowerMessage.includes('purchase')) {
                aiResponse = "Excellent! I'd love to help you place an order.\n\nTo get started: ...";
            }
            else if (lowerMessage.includes('price') || lowerMessage.includes('cost') || lowerMessage.includes('how much')) {
                aiResponse = "Here are our price ranges!\n\nPizza: $12.99 - $18.99 ...";
            }
            else if (lowerMessage.includes('delivery') || lowerMessage.includes('pickup')) {
                aiResponse = "We offer both delivery and pickup!\n\nDELIVERY: ...";
            }
            else if (lowerMessage.includes('thank') || lowerMessage.includes('thanks')) {
                aiResponse = "You're very welcome! I'm here whenever you need help with your FoodyBuddy order.";
            }
            else if (lowerMessage.includes('help')) {
                aiResponse = "I'm here to help! I can assist you with:\n- Menu Information ...";
            } 
            else {
                aiResponse = `Thanks for your message! I'm your FoodyBuddy assistant ...\nYou said: "${message}"\nWhat would you like to know more about? Just say "menu" to see our full selection!`;
            }

            console.log(`AI Response generated: ${aiResponse.substring(0, 100)}...`);
            return aiResponse;

        } catch (err) {
            console.error('Error in AIResponseService.getAIResponse:', err);
            const error = new Error('Failed to generate AI response');
            error.statusCode = 500;
            error.isServiceError = true;
            throw error;
        }
    }
}

module.exports = new AIResponseService();
