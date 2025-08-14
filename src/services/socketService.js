const jwt = require('jsonwebtoken');
const chatService = require('./chatservice');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

module.exports = (io) => {
    // Socket authentication middleware
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token;
            
            if (!token) {
                return next(new Error('Authentication error: No token provided'));
            }
            
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await prisma.user.findUnique({
                where: { id: decoded.userId },
                select: { id: true, email: true, name: true }
            });
            
            if (!user) {
                return next(new Error('Authentication error: User not found'));
            }
            
            socket.userId = user.id;
            socket.user = user;
            next();
        } catch (error) {
            console.error('Socket authentication error:', error);
            next(new Error('Authentication error'));
        }
    });
    
    io.on('connection', (socket) => {
        console.log(` User connected: ${socket.user.name} (${socket.id})`);
        
        // Join user to their personal room for notifications
        socket.join(`user_${socket.userId}`);
        
        // Handle joining a chat session
        socket.on('join-session', async (data) => {
            try {
                const { sessionId } = data;
                
                // Verify session ownership
                const session = await chatService.getSessionById(sessionId);
                if (!session || session.userId !== socket.userId) {
                    socket.emit('error', { message: 'Session not found or access denied' });
                    return;
                }
                
                socket.join(`session_${sessionId}`);
                socket.currentSession = sessionId;
                
                console.log(` User ${socket.user.name} joined session: ${sessionId}`);
                
                // Send session info and recent messages
                const messages = await chatService.getChatHistory(sessionId, 20);
                socket.emit('session-joined', {
                    session,
                    messages
                });
            } catch (error) {
                console.error('Join session error:', error);
                socket.emit('error', { message: 'Failed to join session' });
            }
        });
        
        // Handle sending messages
        socket.on('send-message', async (data) => {
            try {
                const { sessionId, content, messageType = 'text' } = data;
                
                if (!sessionId || !content) {
                    socket.emit('error', { message: 'Session ID and content are required' });
                    return;
                }
                
                // Verify session ownership
                const session = await chatService.getSessionById(sessionId);
                if (!session || session.userId !== socket.userId) {
                    socket.emit('error', { message: 'Session not found or access denied' });
                    return;
                }
                
                // Save user message
                const userMessage = await chatService.saveMessage(sessionId, content, 'user', messageType);
                
                // Broadcast user message to session
                io.to(`session_${sessionId}`).emit('new-message', {
                    message: userMessage,
                    type: 'user'
                });
                
                // Simulate AI processing (replace with actual AI in Week 2)
                setTimeout(async () => {
                    try {
                        const aiResponse = `Echo: ${content}`;
                        const aiMessage = await chatService.saveMessage(sessionId, aiResponse, 'ai', 'text');
                        
                        io.to(`session_${sessionId}`).emit('new-message', {
                            message: aiMessage,
                            type: 'ai'
                        });
                    } catch (error) {
                        console.error('AI response error:', error);
                        socket.emit('error', { message: 'Failed to generate AI response' });
                    }
                }, 1000);
                
            } catch (error) {
                console.error('Send message error:', error);
                socket.emit('error', { message: 'Failed to send message' });
            }
        });
        
        // Handle typing indicators
        socket.on('typing-start', (data) => {
            const { sessionId } = data;
            socket.to(`session_${sessionId}`).emit('user-typing', {
                userId: socket.userId,
                userName: socket.user.name,
                isTyping: true
            });
        });
        
        socket.on('typing-stop', (data) => {
            const { sessionId } = data;
            socket.to(`session_${sessionId}`).emit('user-typing', {
                userId: socket.userId,
                userName: socket.user.name,
                isTyping: false
            });
        });
        
        // Handle leaving session
        socket.on('leave-session', (data) => {
            const { sessionId } = data;
            socket.leave(`session_${sessionId}`);
            socket.currentSession = null;
            console.log(` User ${socket.user.name} left session: ${sessionId}`);
        });
        
        // Handle disconnect
        socket.on('disconnect', () => {
            console.log(` User disconnected: ${socket.user.name} (${socket.id})`);
            
            // Notify session about user leaving if they were typing
            if (socket.currentSession) {
                socket.to(`session_${socket.currentSession}`).emit('user-typing', {
                    userId: socket.userId,
                    userName: socket.user.name,
                    isTyping: false
                });
            }
        });
    });
    
    console.log('🔌 Socket.IO server initialized');
};