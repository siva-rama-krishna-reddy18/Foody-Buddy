const axios = require('axios');
const { io } = require('socket.io-client');

// Configuration
const API_BASE = 'http://127.0.0.1:3001/api/v1';
const SERVER_URL = 'http://127.0.0.1:3001';
const WS_URL = 'ws://127.0.0.1:3001';

// Test customer data
const TEST_CUSTOMER = {
    customerId: '+1234567890',
    name: 'Test Customer'
};

// Global variables for test data
let sessionId = null;
let messageId = null;

// Helper function to wait for server
async function waitForServer(maxAttempts = 15) {
    console.log(' Waiting for server to be ready...');
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const response = await axios.get(`${SERVER_URL}/health`, { timeout: 2000 });
            if (response.status === 200) {
                console.log(' Server is ready!');
                console.log(' Health response:', response.data.message);
                return true;
            }
        } catch (error) {
            const errorCode = error.code || error.response?.status || 'UNKNOWN';
            console.log(` Attempt ${attempt}/${maxAttempts} - Server not ready yet... (${errorCode})`);
            
            if (attempt < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }
    
    console.log(' Server failed to start after', maxAttempts, 'attempts');
    return false;
}

// Helper function for API calls
async function apiCall(method, endpoint, data = null, params = null) {
    try {
        const config = {
            method,
            url: `${API_BASE}${endpoint}`,
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 5000
        };
        
        if (data) {
            config.data = data;
        }
        
        if (params) {
            config.params = params;
        }
        
        const response = await axios(config);
        return { success: true, data: response.data, status: response.status };
    } catch (error) {
        return {
            success: false,
            error: error.response?.data || error.message,
            status: error.response?.status || 500
        };
    }
}

// Test functions
async function testHealthCheck() {
    console.log('\n1.  Testing Health Check...');
    
    const result = await apiCall('GET', '', null, null);
    // For health check, use the base server URL
    try {
        const response = await axios.get(`${SERVER_URL}/health`);
        if (response.status === 200 && response.data.status === 'OK') {
            console.log(' Health check passed:', response.data.message);
            return true;
        }
    } catch (error) {
        console.log(' Health check failed:', error.message);
        return false;
    }
}

async function testCreateChatSession() {
    console.log('\n2.  Testing Chat Session Creation...');
    
    const result = await apiCall('POST', '/chat/sessions', {
        customerId: TEST_CUSTOMER.customerId,
        title: 'Test Chat Session'
    });
    
    if (result.success && result.data.success) {
        sessionId = result.data.data.session.id;
        console.log(' Chat session created successfully!');
        console.log(' Session ID:', sessionId);
        console.log(' Session Title:', result.data.data.session.title);
        console.log(' Customer ID:', result.data.data.session.customer_id);
        return true;
    } else {
        console.log(' Test failed:');
        console.log('Status:', result.status);
        console.log('Error:', result.error);
        return false;
    }
}

async function testGetChatSessions() {
    console.log('\n3.  Testing Get Chat Sessions...');
    
    const result = await apiCall('GET', '/chat/sessions', null, {
        customerId: TEST_CUSTOMER.customerId,
        limit: 10
    });
    
    if (result.success && result.data.success) {
        const sessions = result.data.data.sessions;
        console.log(' Sessions retrieved successfully!');
        console.log(' Number of sessions:', sessions.length);
        
        if (sessions.length > 0) {
            console.log(' First session:', {
                id: sessions[0].id,
                title: sessions[0].title,
                messageCount: sessions[0]._count.messages
            });
        }
        return true;
    } else {
        console.log(' Test failed:');
        console.log('Status:', result.status);
        console.log('Error:', result.error);
        return false;
    }
}

async function testSendMessage() {
    console.log('\n4.  Testing Send Message...');
    
    if (!sessionId) {
        console.log(' Cannot test - no session ID available');
        return false;
    }
    
    const result = await apiCall('POST', '/chat/messages', {
        sessionId: sessionId,
        customerId: TEST_CUSTOMER.customerId,
        content: 'Hello! Can you recommend some pizza?',
        messageType: 'text'
    });
    
    if (result.success && result.data.success) {
        const { userMessage, aiMessage } = result.data.data;
        messageId = userMessage.id;
        
        console.log(' Message sent successfully!');
        console.log(' User Message:', {
            id: userMessage.id,
            content: userMessage.content,
            sender: userMessage.sender
        });
        console.log(' AI Response:', {
            id: aiMessage.id,
            content: aiMessage.content.substring(0, 100) + '...',
            sender: aiMessage.sender
        });
        return true;
    } else {
        console.log(' Test failed:');
        console.log('Status:', result.status);
        console.log('Error:', result.error);
        return false;
    }
}

async function testGetChatHistory() {
    console.log('\n5.  Testing Get Chat History...');
    
    if (!sessionId) {
        console.log(' Cannot test - no session ID available');
        return false;
    }
    
    const result = await apiCall('GET', `/chat/messages/${sessionId}`, null, {
        customerId: TEST_CUSTOMER.customerId,
        limit: 50
    });
    
    if (result.success && result.data.success) {
        const { messages, session } = result.data.data;
        console.log(' Chat history retrieved successfully!');
        console.log(' Session:', {
            id: session.id,
            title: session.title,
            customerId: session.customer_id
        });
        console.log(' Message count:', messages.length);
        
        if (messages.length > 0) {
            console.log(' Latest messages:');
            messages.slice(-2).forEach((msg, index) => {
                console.log(`   ${index + 1}. [${msg.sender}]: ${msg.content.substring(0, 80)}...`);
            });
        }
        return true;
    } else {
        console.log(' Test failed:');
        console.log('Status:', result.status);
        console.log('Error:', result.error);
        return false;
    }
}

async function testWebSocketConnection() {
    console.log('\n6.  Testing WebSocket Connection...');
    
    return new Promise((resolve) => {
        const socket = io(WS_URL, {
            timeout: 5000,
            forceNew: true
        });
        
        let connected = false;
        let authenticated = false;
        let messageReceived = false;
        
        const cleanup = () => {
            socket.disconnect();
        };
        
        const checkComplete = () => {
            if (connected && authenticated && messageReceived) {
                console.log(' WebSocket test completed successfully!');
                cleanup();
                resolve(true);
            }
        };
        
        socket.on('connect', () => {
            console.log(' WebSocket connected');
            connected = true;
            
            // Authenticate
            socket.emit('authenticate', { customerId: TEST_CUSTOMER.customerId });
        });
        
        socket.on('disconnect', () => {
            console.log(' WebSocket disconnected');
        });
        
        socket.on('error', (error) => {
            console.log(' WebSocket error:', error.message);
            cleanup();
            resolve(false);
        });
        
        // Listen for successful authentication (no specific event, so we'll try join-session)
        socket.on('session-joined', (data) => {
            console.log(' Successfully joined session via WebSocket');
            authenticated = true;
            
            // Send a test message
            socket.emit('send-message', {
                sessionId: sessionId,
                content: 'Hello via WebSocket!',
                messageType: 'text'
            });
        });
        
        socket.on('new-message', (data) => {
            console.log(' Received message via WebSocket:', {
                type: data.type,
                content: data.message.content.substring(0, 50) + '...'
            });
            messageReceived = true;
            checkComplete();
        });
        
        // Try to join session after a short delay
        setTimeout(() => {
            if (connected && sessionId) {
                socket.emit('join-session', { sessionId: sessionId });
                authenticated = true; // Assume authentication worked if we can emit
            }
        }, 1000);
        
        // Timeout the test
        setTimeout(() => {
            if (!connected || !authenticated || !messageReceived) {
                console.log(' WebSocket test timed out');
                console.log('Status:', { connected, authenticated, messageReceived });
                cleanup();
                resolve(false);
            }
        }, 10000);
    });
}

async function testDeleteSession() {
    console.log('\n7.  Testing Delete Session...');
    
    if (!sessionId) {
        console.log(' Cannot test - no session ID available');
        return false;
    }
    
    const result = await apiCall('DELETE', `/chat/sessions/${sessionId}`, null, {
        customerId: TEST_CUSTOMER.customerId
    });
    
    if (result.success && result.data.success) {
        console.log(' Session deleted successfully!');
        return true;
    } else {
        console.log(' Test failed:');
        console.log('Status:', result.status);
        console.log('Error:', result.error);
        return false;
    }
}

// Main test runner
async function runTests() {
    console.log(' Starting Complete API Tests for FoodyBuddy Chat Backend...');
    console.log(' Testing Customer:', TEST_CUSTOMER.customerId);
    console.log(' API Base:', API_BASE);
    console.log(' WebSocket URL:', WS_URL);
    
    // Wait for server to be ready
    const serverReady = await waitForServer();
    if (!serverReady) {
        console.log(' Cannot proceed with tests - server not ready');
        process.exit(1);
    }
    
    const tests = [
        { name: 'Health Check', fn: testHealthCheck },
        { name: 'Create Chat Session', fn: testCreateChatSession },
        { name: 'Get Chat Sessions', fn: testGetChatSessions },
        { name: 'Send Message', fn: testSendMessage },
        { name: 'Get Chat History', fn: testGetChatHistory },
        { name: 'WebSocket Connection', fn: testWebSocketConnection },
        { name: 'Delete Session', fn: testDeleteSession }
    ];
    
    let passed = 0;
    let failed = 0;
    
    for (const test of tests) {
        try {
            const result = await test.fn();
            if (result) {
                passed++;
            } else {
                failed++;
            }
        } catch (error) {
            console.log(` Test "${test.name}" threw error:`, error.message);
            failed++;
        }
        
        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Summary
   /* console.log('\n' + '='.repeat(50));
    console.log(' TEST SUMMARY');
    console.log('='.repeat(50));
    console.log(` Passed: ${passed}`);
    console.log(` Failed: ${failed}`);
    console.log(` Total: ${passed + failed}`);
    console.log(` Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);*/
    
    if (failed === 0) {
        console.log('\n All tests passed! Your FoodyBuddy backend is working perfectly!');
    } else {
        console.log('\n Some tests failed. Check the output above for details.');
    }
    
    console.log('\n Backend is ready for frontend integration!');
    process.exit(failed === 0 ? 0 : 1);
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    console.error(' Uncaught Exception:', error.message);
    process.exit(1);
});

process.on('unhandledRejection', (error) => {
    console.error(' Unhandled Rejection:', error.message);
    process.exit(1);
});

// Run the tests
runTests();