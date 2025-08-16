const axios = require('axios');

const API_BASE = 'http://127.0.0.1:3001/api/v1';
const CUSTOMER_ID = '+1234567890';

async function quickChatTest() {
    console.log(' Quick Chat Test');
    
    try {
        // 1. Create session
        console.log('1. Creating session...');
        const sessionResponse = await axios.post(`${API_BASE}/chat/sessions`, {
            customerId: CUSTOMER_ID,
            title: 'Quick Test'
        });
        
        const sessionId = sessionResponse.data.data.session.id;
        console.log(' Session created:', sessionId);
        
        // 2. Send message
        console.log('2. Sending message...');
        const messageResponse = await axios.post(`${API_BASE}/chat/messages`, {
            sessionId: sessionId,
            customerId: CUSTOMER_ID,
            content: 'Hello! Recommend pizza please!'
        });
        
        console.log(' Message sent successfully!');
        console.log(' AI Response:', messageResponse.data.data.aiMessage.content);
        
        // 3. Get history
        console.log('3. Getting chat history...');
        const historyResponse = await axios.get(`${API_BASE}/chat/messages/${sessionId}?customerId=${CUSTOMER_ID}`);
        
        console.log(' History retrieved:', historyResponse.data.data.messages.length, 'messages');
        
        console.log('\n All tests passed! Your chat backend is working!');
        
    } catch (error) {
        console.log(' Test failed:', error.response?.data || error.message);
    }
}

quickChatTest();