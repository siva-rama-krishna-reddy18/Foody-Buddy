const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const chatRoutes = require('./routes/chat');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();
const httpServer = createServer(app);

// Socket.io setup
const io = new Server(httpServer, {
    cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
    }
});

// Security middleware
app.use(helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false
}));

app.use(cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: { success: false, error: 'Too many requests' }
});
app.use(limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        message: 'FoodyBuddy Backend is running!',
        port: process.env.PORT || 3001,
        environment: process.env.NODE_ENV || 'development'
    });
});

// Basic route for testing
app.get('/', (req, res) => {
    res.json({ 
        message: 'Welcome to FoodyBuddy Backend API',
        version: '1.0.0',
        status: 'running',
        endpoints: {
            health: '/health',
            chat: '/api/v1/chat'
        },
        timestamp: new Date().toISOString()
    });
});

// Routes
app.use('/api/v1/chat', chatRoutes);

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: `Cannot ${req.method} ${req.originalUrl}`,
        availableEndpoints: {
            health: 'GET /health',
            root: 'GET /',
            chat: 'GET /api/v1/chat/sessions, POST /api/v1/chat/sessions, POST /api/v1/chat/messages'
        }
    });
});

// Error handling
app.use(errorHandler);

// Socket.io connection handling
require('./services/socketService')(io);

const PORT = parseInt(process.env.PORT) || 3001;
const HOST = '127.0.0.1'; // Force IPv4

// Start server with comprehensive error handling
function startServer() {
    return new Promise((resolve, reject) => {
        const server = httpServer.listen(PORT, HOST, () => {
            console.log('\n ===============================================');
            console.log(' FoodyBuddy Backend Server Started Successfully!');
            console.log(' ===============================================');
            console.log(` Host: ${HOST}`);
            console.log(` Port: ${PORT}`);
            console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(` Health check: http://${HOST}:${PORT}/health`);
            console.log(` Root endpoint: http://${HOST}:${PORT}/`);
            console.log(` Chat API: http://${HOST}:${PORT}/api/v1/chat`);
            console.log(` WebSocket: ws://${HOST}:${PORT}`);
            console.log(' ===============================================\n');
            
            // Test internal health check
            const http = require('http');
            const options = {
                hostname: HOST,
                port: PORT,
                path: '/health',
                method: 'GET'
            };
            
            const req = http.request(options, (res) => {
                if (res.statusCode === 200) {
                    console.log(' Internal health check passed - server is ready!');
                } else {
                    console.log('  Internal health check returned:', res.statusCode);
                }
            });
            
            req.on('error', (err) => {
                console.log('  Internal health check failed:', err.message);
            });
            
            req.end();
            
            resolve(server);
        });

        server.on('error', (err) => {
            console.error('\n ===============================================');
            console.error(' Server Failed to Start!');
            console.error(' ===============================================');
            
            if (err.code === 'EADDRINUSE') {
                console.error(` Port ${PORT} is already in use`);
                console.error(' Solutions:');
                console.error('   1. Kill the process using the port:');
                console.error(`      netstat -ano | findstr :${PORT}`);
                console.error('      taskkill /PID [PID] /F');
                console.error('   2. Use a different port in .env:');
                console.error('      PORT=8080');
                console.error('   3. Wait a moment and try again');
            } else if (err.code === 'EACCES') {
                console.error(` Permission denied for port ${PORT}`);
                console.error(' Solutions:');
                console.error('   1. Use a port > 1024 (try PORT=8080)');
                console.error('   2. Run as Administrator');
            } else if (err.code === 'ENOTFOUND') {
                console.error(` Host ${HOST} not found`);
                console.error(' Try using 0.0.0.0 or localhost');
            } else {
                console.error(' Unexpected error:', err.code, err.message);
            }
            
            console.error(' ===============================================\n');
            reject(err);
        });
    });
}

// Start the server
startServer()
    .then(() => {
        console.log(' Server startup completed successfully!');
    })
    .catch((err) => {
        console.error(' Server startup failed:', err.message);
        process.exit(1);
    });

module.exports = { app, io };