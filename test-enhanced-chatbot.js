// test-enhanced-chatbot.js
const  AgentService  = require('./src/services/agentService');

// Test configuration
const TEST_CUSTOMER_ID = '+1234567890';
const TEST_SESSION_ID = 'test-session-enhanced';

async function testEnhancedFeatures() {
  console.log('🤖 Testing Enhanced Chatbot Features\n\n');

  const agentService = new AgentService();

  const testCases = [
    {
      name: 'Greeting',
      input: 'Hello',
      expected: 'Should show personalized greeting with recommendations'
    },
    {
      name: 'Order Status',
      input: 'What are my recent orders?',
      expected: 'Should show recent orders from your 3460 orders'
    },
    {
      name: 'Recommendations',
      input: 'What do you recommend?',
      expected: 'Should show personalized recommendations'
    },
    {
      name: 'Preference Learning',
      input: 'I love spicy biryani and hate sweet things',
      expected: 'Should acknowledge and store preferences'
    },
    {
      name: 'Add to Cart',
      input: 'Add chicken biryani to my cart',
      expected: 'Should add item to cart'
    },
    {
      name: 'View Cart',
      input: 'Show my cart',
      expected: 'Should display cart contents'
    },
    {
      name: 'Search',
      input: 'samosa',
      expected: 'Should search and show samosa items'
    }
  ];

  for (const testCase of testCases) {
    console.log(`=== ${testCase.name} ===`);
    console.log(`Input: "${testCase.input}"`);
    console.log(`Expected: ${testCase.expected}`);

    try {
      // Fixed parameter order: customerId, sessionId, message
      const result = await agentService.processMessage(
        TEST_CUSTOMER_ID,
        TEST_SESSION_ID, 
        testCase.input
      );

      console.log(`✅ Intent: ${result.intent}`);
      console.log(`📝 Response: ${result.response.substring(0, 100)}...`);
      console.log(`🛍️ Products: ${result.products.length}`);
      
      if (result.suggestions && result.suggestions.length > 0) {
        console.log(`💡 Suggestions: ${result.suggestions.join(', ')}`);
      }

    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }

    console.log(''); // Empty line for readability
  }

  console.log('🎉 Testing completed!');
}

// Run the test
testEnhancedFeatures().catch(console.error);