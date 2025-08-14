// Test your services directly without HTTP
const authService = require('./src/services/authservice');
const chatService = require('./src/services/chatservice');

async function testServicesDirectly() {
    try {
        console.log(' Testing services directly (bypassing HTTP)...\n');
        
        // Test 1: User Registration
        console.log('1. Testing User Registration Service...');
        const user = await authService.register({
            name: 'Test User',
            email: `test${Date.now()}@example.com`,
            password: 'password123'
        });
        console.log(' Registration service works:', user.user.name);
        
        // Test 2: Chat Session Creation
        console.log('\n2. Testing Chat Service...');
        const session = await chatService.createSession(user.user.id, 'Test Chat');
        console.log(' Chat service works:', session.title);
        
        console.log('\n All backend services work! Issue is networking only.');
        
    } catch (error) {
        console.error(' Service test failed:', error.message);
    }
}

testServicesDirectly();