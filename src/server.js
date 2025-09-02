// server.js
// Updated server with enhanced socket service integration

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
require('dotenv').config();

// Import routes and middleware
const chatRoutes = require('./routes/chat');
const orderRoutes = require('./routes/orderRoutes');    
const { errorHandler } = require('./middleware/errorHandler');

// Import enhanced socket service
const { socketService } = require('./services/socketService');

const app = express();
const httpServer = createServer(app);

// Security middleware
app.use(helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false
}));

app.use(cors({
    origin: [
        process.env.FRONTEND_URL || "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:3001"
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
}));

// Rate limiting with enhanced configuration
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: { 
        success: false, 
        error: 'Too many requests. Please try again later.',
        retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false
});
app.use('/api/', limiter);

// Separate rate limit for chat endpoints (more permissive)
const chatLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 30, // 30 chat messages per minute
    message: { 
        success: false, 
        error: 'Chat rate limit exceeded. Please slow down.',
        retryAfter: '1 minute'
    }
});
app.use('/api/v1/chat', chatLimiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Enhanced health check with system information
app.get('/health', async (req, res) => {
    try {
        // Get socket service stats
        const socketStats = socketService.getConnectionStats();
        
        // Basic database connectivity test (optional)
        let dbStatus = 'unknown';
        try {
            const { PrismaClient } = require('@prisma/client');
            const prisma = new PrismaClient();
            await prisma.$queryRaw`SELECT 1`;
            dbStatus = 'connected';
            await prisma.$disconnect();
        } catch (dbError) {
            dbStatus = 'disconnected';
        }
        
        res.status(200).json({ 
            status: 'OK',
            service: 'FoodyBuddy Backend',
            version: '2.0.0',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            environment: process.env.NODE_ENV || 'development',
            port: process.env.PORT || 3001,
            database: dbStatus,
            socketConnections: socketStats.connectedClients,
            features: {
                enhancedChatbot: true,
                orderTracking: true,
                cartManagement: true,
                preferenceeLearning: true,
                vectorSearch: !!process.env.HUGGING_FACE_API_KEY
            }
        });
    } catch (error) {
        res.status(503).json({
            status: 'ERROR',
            error: 'Health check failed',
            timestamp: new Date().toISOString()
        });
    }
});

// Enhanced root endpoint with API documentation
app.get('/', (req, res) => {
    res.json({ 
        message: 'Welcome to FoodyBuddy Enhanced Backend API',
        version: '2.0.0',
        status: 'running',
        documentation: {
            endpoints: {
                health: 'GET /health - System health and status',
                chat_sessions: 'GET /api/v1/chat/sessions - List chat sessions',
                create_session: 'POST /api/v1/chat/sessions - Create new chat session',
                send_message: 'POST /api/v1/chat/messages - Send chat message',
                websocket: 'WebSocket connection for real-time chat'
            },
            websocket_events: {
                connect: 'Client connects to WebSocket',
                identify: 'Client identifies with user ID',
                message: 'Send/receive chat messages',
                cart_action: 'Cart management actions',
                check_order_status: 'Check order status',
                typing: 'Typing indicators'
            },
            features: [
                'Enhanced AI chatbot with learning capabilities',
                'Real-time order status tracking',
                'Smart shopping cart management',
                'Personalized recommendations',
                'Customer preference learning',
                'Vector-based product search'
            ]
        },
        timestamp: new Date().toISOString()
    });
});

// API status endpoint
app.get('/api/status', (req, res) => {
    const socketStats = socketService.getConnectionStats();
    
    res.json({
        api_version: '2.0.0',
        status: 'operational',
        timestamp: new Date().toISOString(),
        connections: socketStats,
        features: {
            enhanced_chatbot: true,
            real_time_messaging: true,
            order_tracking: true,
            cart_management: true,
            preference_learning: process.env.ENABLE_LEARNING === 'true',
            vector_search: !!process.env.HUGGING_FACE_API_KEY,
            debug_mode: process.env.DEBUG_ORCHESTRATOR === 'true'
        }
    });
});

// Routes
app.use('/api/v1/chat', chatRoutes);
app.use('/api/v1/orders', orderRoutes);

// Enhanced 404 handler with helpful information
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: `Cannot ${req.method} ${req.originalUrl}`,
        message: 'Endpoint not found',
        availableEndpoints: {
            'System': {
                'GET /': 'API documentation and welcome message',
                'GET /health': 'System health check',
                'GET /api/status': 'API status and feature flags'
            },
            'Chat API': {
                'GET /api/v1/chat/sessions': 'List user chat sessions',
                'POST /api/v1/chat/sessions': 'Create new chat session',
                'POST /api/v1/chat/messages': 'Send message to chat session'
            },
            'WebSocket': {
                'ws://localhost:3001': 'Real-time chat connection'
            }
        },
        timestamp: new Date().toISOString()
    });
});

// Enhanced error handling middleware
app.use((err, req, res, next) => {
    console.error('Server Error:', {
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        url: req.originalUrl,
        method: req.method,
        timestamp: new Date().toISOString()
    });
    
    errorHandler(err, req, res, next);
});

// Initialize Socket.IO with enhanced service
let io;
try {
    console.log('Initializing enhanced Socket.IO service...');
    io = socketService.initialize(httpServer);
    console.log('Socket.IO service initialized successfully');
} catch (error) {
    console.error('Failed to initialize Socket.IO service:', error);
    process.exit(1);
}

const PORT = parseInt(process.env.PORT) || 3001;
const HOST = process.env.HOST || '127.0.0.1';

// Enhanced server startup with better error handling and logging
async function startServer() {
    return new Promise((resolve, reject) => {
        const server = httpServer.listen(PORT, HOST, () => {
            console.log('\n ===============================================');
            console.log('  FoodyBuddy Enhanced Backend Started!');
            console.log(' ===============================================');
            console.log(`  Host: ${HOST}`);
            console.log(`  Port: ${PORT}`);
            console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`  Health check: http://${HOST}:${PORT}/health`);
            console.log(`  API docs: http://${HOST}:${PORT}/`);
            console.log(`  Chat API: http://${HOST}:${PORT}/api/v1/chat`);
            console.log(`  WebSocket: ws://${HOST}:${PORT}`);
            
            // Feature flags display
            console.log(' ===============================================');
            console.log('  Enhanced Features Enabled:');
            console.log(`   • AI Chatbot `);
            console.log(`   • Order Tracking`);
            console.log(`   • Cart Management`);
            console.log(`   • Preference Learning: ${process.env.ENABLE_LEARNING === 'true' ? '✅' : '❌'}`);
            console.log(`   • Vector Search: ${process.env.HUGGING_FACE_API_KEY ? '✅' : '❌'}`);
            console.log(`   • Debug Mode: ${process.env.DEBUG_ORCHESTRATOR === 'true' ? '✅' : '❌'}`);
            console.log(' ===============================================\n');
            
            // Internal health check
            performHealthCheck();
            
            resolve(server);
        });

        server.on('error', (err) => {
            console.error('\n ===============================================');
            console.error('  Server Failed to Start!');
            console.error(' ===============================================');
            
            if (err.code === 'EADDRINUSE') {
                console.error(`  Port ${PORT} is already in use`);
                console.error('  Solutions:');
                console.error('   1. Kill the process using the port:');
                console.error(`      • Windows: netstat -ano | findstr :${PORT}`);
                console.error(`      • Mac/Linux: lsof -ti:${PORT} | xargs kill`);
                console.error('   2. Use a different port:');
                console.error('      • Set PORT=8080 in your .env file');
                console.error('   3. Wait a moment and try again');
            } else if (err.code === 'EACCES') {
                console.error(`  Permission denied for port ${PORT}`);
                console.error('  Solutions:');
                console.error('   1. Use a port > 1024 (try PORT=8080)');
                console.error('   2. Run with elevated permissions');
            } else if (err.code === 'ENOTFOUND') {
                console.error(`  Host ${HOST} not found`);
                console.error('  Try using 0.0.0.0 or localhost');
            } else {
                console.error(`  Unexpected error: ${err.code} - ${err.message}`);
            }
            
            console.error(' ===============================================\n');
            reject(err);
        });

        // Graceful shutdown handling
        process.on('SIGINT', () => {
            console.log('\n Received SIGINT. Graceful shutdown...');
            server.close(() => {
                console.log(' HTTP server closed.');
                process.exit(0);
            });
        });

        process.on('SIGTERM', () => {
            console.log('\n Received SIGTERM. Graceful shutdown...');
            server.close(() => {
                console.log(' HTTP server closed.');
                process.exit(0);
            });
        });
    });
}

// Internal health check function
async function performHealthCheck() {
    const http = require('http');
    
    const options = {
        hostname: HOST,
        port: PORT,
        path: '/health',
        method: 'GET',
        timeout: 5000
    };
    
    const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            if (res.statusCode === 200) {
                try {
                    const healthData = JSON.parse(data);
                    console.log('  Internal health check passed');
                    console.log(`    • Database: ${healthData.database}`);
                    console.log(`    • Socket connections: ${healthData.socketConnections}`);
                    console.log(`    • Uptime: ${Math.round(healthData.uptime)}s`);
                } catch (e) {
                    console.log('  Internal health check passed (basic)');
                }
            } else {
                console.log(`   Health check returned status: ${res.statusCode}`);
            }
        });
    });
    
    req.on('timeout', () => {
        console.log('   Health check timed out');
        req.destroy();
    });
    
    req.on('error', (err) => {
        console.log(`   Health check failed: ${err.message}`);
    });
    
    req.end();
}

// Start the server
console.log(' Starting FoodyBuddy Enhanced Backend...\n');

startServer()
    .then(() => {
        console.log(' Server startup completed successfully!');
        
        // Optional: Log environment variables (excluding secrets)
        if (process.env.DEBUG_ORCHESTRATOR === 'true') {
            console.log('\n🔧 Environment Configuration:');
            console.log(`   NODE_ENV: ${process.env.NODE_ENV}`);
            console.log(`   PORT: ${process.env.PORT}`);
            console.log(`   DATABASE_URL: ${process.env.DATABASE_URL ? '[CONFIGURED]' : '[NOT SET]'}`);
            console.log(`   HUGGING_FACE_API_KEY: ${process.env.HUGGING_FACE_API_KEY ? '[CONFIGURED]' : '[NOT SET]'}`);
            console.log(`   ENABLE_LEARNING: ${process.env.ENABLE_LEARNING}`);
        }
    })
    .catch((err) => {
        console.error(' Server startup failed:', err.message);
        process.exit(1);
    });

// Export for testing or external use
module.exports = { 
    app, 
    httpServer, 
    io,
    socketService,
    startServer 
};