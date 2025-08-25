const chatService = require('./chatservice');
const aiResponseService = require('./aiResponseService');
const { v4: uuidv4 } = require('uuid');

console.log('SocketService: Loading...');

module.exports = (io) => {
    console.log('SocketService: Initializing...');
    
    io.on('connection', (socket) => {
        console.log(`SocketService: Client connected: ${socket.id}`);

        // Send welcome message
        socket.emit('message', {
            id: uuidv4(),
            message: 'Connected to FoodyBuddy! Send me a message.',
            sender: 'ai',
            timestamp: new Date()
        });

        // Handle customer authentication
        socket.on('authenticate', async (data) => {
            console.log('SocketService: Authentication received:', data);
            
            try {
                const { phoneNumber } = data;
                
                if (!phoneNumber) {
                    console.log('SocketService: No phone number provided');
                    socket.emit('error', { message: 'Phone number is required' });
                    return;
                }

                console.log(`SocketService: Authenticating customer ${phoneNumber}`);
                
                // Store customer info
                socket.customerId = phoneNumber;
                
                // CREATE SESSION IN DATABASE (this was missing!)
                const session = await chatService.createSession(phoneNumber, `Chat ${new Date().toLocaleDateString()}`);
                const sessionId = session.id;
                
                socket.sessionId = sessionId;
                socket.join(sessionId);

                console.log(`SocketService: Database session created ${sessionId} for ${phoneNumber}`);

                // Send success
                socket.emit('authenticated', { 
                    success: true, 
                    sessionId: sessionId,
                    message: 'Connected successfully! How can I help you today?' 
                });

            } catch (error) {
                console.error('SocketService: Authentication error:', error);
                socket.emit('error', { message: 'Authentication failed' });
            }
        });

        // Handle incoming messages
        socket.on('message', async (data) => {
            console.log('SocketService: MESSAGE RECEIVED!', data);
            
            try {
                const { message } = data;
                
                if (!message || !message.trim()) {
                    console.log('SocketService: Empty message received');
                    return;
                }

                console.log(`SocketService: Processing message: "${message}"`);

                // Get or create session in database
                let sessionId = socket.sessionId;
                if (!sessionId) {
                    console.log('SocketService: No session found, creating emergency session...');
                    const customerId = socket.customerId || '+1234567890';
                    const session = await chatService.createSession(customerId, 'Emergency Chat');
                    sessionId = session.id;
                    socket.sessionId = sessionId;
                    console.log(`SocketService: Emergency database session created: ${sessionId}`);
                }

                // Don't echo customer message - frontend handles this
                console.log('SocketService: Processing customer message (no echo needed)');

                // Get AI response directly
                console.log('SocketService: Calling aiResponseService.getAIResponse...');
                const aiResponse = await aiResponseService.getAIResponse(message.trim(), sessionId);
                console.log('SocketService: AI Response received:', aiResponse);

                if (aiResponse && aiResponse.trim()) {
                    const aiMessage = {
                        id: uuidv4(),
                        message: aiResponse.trim(),
                        sender: 'ai',
                        timestamp: new Date(),
                        sessionId: sessionId
                    };

                    socket.emit('message', aiMessage);
                    console.log('SocketService: Real AI response sent');
                }

            } catch (error) {
                console.error('SocketService: Error processing message:', error);
                
                socket.emit('message', {
                    id: uuidv4(),
                    message: "Error occurred! Check console.",
                    sender: 'ai',
                    timestamp: new Date()
                });
            }
        });

        socket.on('disconnect', () => {
            console.log(`SocketService: Client disconnected: ${socket.id}`);
        });

        socket.on('error', (error) => {
            console.error('SocketService: Socket error:', error);
        });
    });

    console.log('SocketService: Initialized successfully');
};