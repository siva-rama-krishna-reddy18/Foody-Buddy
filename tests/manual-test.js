const axios = require('axios');

const BASE_URL = 'http://127.0.0.1:8080';  // Updated port

// Configure axios with longer timeout and better error handling
const apiClient = axios.create({
    baseURL: BASE_URL,
    timeout: 10000,  // 10 seconds
    headers: {
        'Content-Type': 'application/json'
    }
});

async function waitForServer() {
    console.log(' Waiting for server to be ready...');
    
    for (let i = 0; i < 15; i++) {
        try {
            const response = await apiClient.get('/health');
            console.log(' Server is ready!');
            console.log(' Health response:', response.data.message);
            return;
        } catch (error) {
            console.log(` Attempt ${i + 1}/15 - Server not ready yet... (${error.code || error.message})`);
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
    throw new Error('Server did not start within 30 seconds');
}

async function testAPI() {
    try {
        await waitForServer();
        
        console.log('\n Starting Complete API Tests...\n');
        
        // Test 1: Health Check
        console.log('1. Testing Health Check...');
        const health = await apiClient.get('/health');
        console.log(' Health check passed:', health.data.message);
        
        // Test 2: Customer Registration (Updated for customers table)
        console.log('\n2. Testing Customer Registration...');
        const customerData = {
            name: 'Test Customer',
            phone: `+1555${Date.now().toString().slice(-7)}`, // Generate unique phone
            email: `test${Date.now()}@example.com`,
            password: 'password123'
        };
        
        const registerResponse = await apiClient.post('/api/v1/auth/register', customerData);
        console.log(' Registration passed:', registerResponse.data.message);
        
        const token = registerResponse.data.data.token;
        console.log(' Token received:', token.substring(0, 20) + '...');
        
        // Test 3: Customer Login (Updated to use phone)
        console.log('\n3. Testing Customer Login...');
        const loginResponse = await apiClient.post('/api/v1/auth/login', {
            phone: customerData.phone,  // Changed from email to phone
            password: customerData.password
        });
        console.log(' Login passed:', loginResponse.data.message);
        
        // Test 4: Get Profile
        console.log('\n4. Testing Get Profile...');
        const profileResponse = await apiClient.get('/api/v1/auth/profile', {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log(' Profile retrieved:', profileResponse.data.data.user.name);
        console.log(' Customer phone:', profileResponse.data.data.user.phone);
        
        // Test 5: Create Chat Session
        console.log('\n5. Testing Chat Session Creation...');
        const sessionResponse = await apiClient.post('/api/v1/chat/sessions', 
            { title: 'Test Chat Session with FoodyBuddy' },
            { headers: { Authorization: `Bearer ${token}` } }
        );
        console.log(' Session creation passed:', sessionResponse.data.message);
        
        const sessionId = sessionResponse.data.data.session.id;
        console.log(' Session ID:', sessionId);
        
        // Test 6: Send Message
        console.log('\n6. Testing Message Sending...');
        const messageResponse = await apiClient.post('/api/v1/chat/messages',
            {
                sessionId,
                content: 'Hello FoodyBuddy! Can you recommend some good pizza places?',
                messageType: 'text'
            },
            { headers: { Authorization: `Bearer ${token}` } }
        );
        console.log(' Message sending passed');
        console.log(' Customer message:', messageResponse.data.data.userMessage.content);
        console.log(' AI response:', messageResponse.data.data.aiMessage.content);
        
        // Test 7: Get Messages
        console.log('\n7. Testing Message Retrieval...');
        const messagesResponse = await apiClient.get(`/api/v1/chat/messages/${sessionId}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log(' Message retrieval passed');
        console.log(' Messages count:', messagesResponse.data.data.messages.length);
        
        // Test 8: Get Sessions
        console.log('\n8. Testing Sessions Retrieval...');
        const sessionsResponse = await apiClient.get('/api/v1/chat/sessions', {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log(' Sessions retrieval passed');
        console.log(' Sessions count:', sessionsResponse.data.data.sessions.length);
        
        console.log('\n All API tests passed successfully!');
        console.log(' Your FoodyBuddy backend is fully functional with customer integration!');
        console.log(' Ready for AI integration with real customer data!');
        
    } catch (error) {
        console.error('\n Test failed:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Error:', error.response.data);
        } else if (error.code) {
            console.error('Connection Error:', error.code);
            console.error('Message:', error.message);
            console.error('\n Troubleshooting:');
            console.error('   1. Make sure server is running: npm run dev');
            console.error('   2. Check if port 8080 is available');
            console.error('   3. Verify database connection is working');
        } else {
            console.error('Error:', error.message);
        }
        process.exit(1);
    }
}

// Run tests
testAPI();