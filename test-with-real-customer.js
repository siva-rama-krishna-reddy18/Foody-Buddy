// test-with-real-customer.js
const { PrismaClient } = require('@prisma/client');
const  AgentService  = require('./src/services/agentService');

const prisma = new PrismaClient();

async function findTestCustomer() {
  try {
    // Find a customer who has orders
    const customerWithOrders = await prisma.customer.findFirst({
      include: {
        orders: {
          take: 1
        }
      },
      where: {
        orders: {
          some: {}
        }
      }
    });

    if (customerWithOrders) {
      console.log(`Found customer: ${customerWithOrders.name} (${customerWithOrders.phone})`);
      console.log(`Orders: ${customerWithOrders.orders.length > 0 ? 'Yes' : 'No'}`);
      return customerWithOrders.phone;
    }

    // Fallback: just get any customer
    const anyCustomer = await prisma.customer.findFirst();
    if (anyCustomer) {
      console.log(`Using customer: ${anyCustomer.name} (${anyCustomer.phone})`);
      return anyCustomer.phone;
    }

    return null;
  } catch (error) {
    console.error('Error finding customer:', error);
    return null;
  }
}

async function checkDatabaseContent() {
  try {
    console.log('📊 Database Overview:');
    
    const customerCount = await prisma.customer.count();
    const orderCount = await prisma.order.count();
    const productCount = await prisma.product.count();
    
    console.log(`- Customers: ${customerCount}`);
    console.log(`- Orders: ${orderCount}`);
    console.log(`- Products: ${productCount}`);
    
    // Check if we have any products with "samosa" in the name
    const samosaProducts = await prisma.product.findMany({
      where: {
        name: { contains: 'samosa', mode: 'insensitive' }
      }
    });
    
    console.log(`- Products with "samosa": ${samosaProducts.length}`);
    if (samosaProducts.length > 0) {
      samosaProducts.forEach(p => console.log(`  • ${p.name} - $${p.price}`));
    }
    
    // Show some sample products for search testing
    const sampleProducts = await prisma.product.findMany({ take: 5 });
    console.log('\n🍽️ Sample products for testing:');
    sampleProducts.forEach(p => console.log(`- ${p.name} - $${p.price}`));
    
  } catch (error) {
    console.error('Database check error:', error);
  }
}

async function testWithRealCustomer() {
  console.log('🤖 Testing Enhanced Chatbot with Real Data\n');

  await checkDatabaseContent();
  console.log('\n');

  const customerId = await findTestCustomer();
  if (!customerId) {
    console.log('❌ No customers found in database');
    return;
  }

  const sessionId = 'test-session-real';
  const agentService = new AgentService();

  const testCases = [
    {
      name: 'Greeting',
      input: 'Hello',
      expected: 'Should show personalized greeting with order history'
    },
    {
      name: 'Order Status',
      input: 'What are my recent orders?',
      expected: 'Should show actual order history'
    },
    {
      name: 'Recommendations',
      input: 'What do you recommend?',
      expected: 'Should show recommendations based on order history'
    },
    {
      name: 'Search Real Product',
      input: 'chicken',
      expected: 'Should find chicken products in your database'
    },
    {
      name: 'Search Biryani',
      input: 'biryani',
      expected: 'Should find biryani products'
    },
    {
      name: 'Preference Learning',
      input: 'I love spicy food and biryani',
      expected: 'Should store preferences in database'
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
    }
  ];

  for (const testCase of testCases) {
    console.log(`=== ${testCase.name} ===`);
    console.log(`Input: "${testCase.input}"`);
    console.log(`Expected: ${testCase.expected}`);

    try {
      const result = await agentService.processMessage(customerId, sessionId, testCase.input);

      console.log(`✅ Intent: ${result.intent}`);
      console.log(`📝 Response: ${result.response.substring(0, 150)}${result.response.length > 150 ? '...' : ''}`);
      console.log(`🛍️ Products: ${result.products.length}`);
      
      if (result.products.length > 0) {
        console.log('   Products found:');
        result.products.slice(0, 3).forEach(p => 
          console.log(`   • ${p.name} - $${p.price}`)
        );
      }
      
      if (result.suggestions && result.suggestions.length > 0) {
        console.log(`💡 Suggestions: ${result.suggestions.join(', ')}`);
      }

    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }

    console.log(''); // Empty line
  }

  console.log('🎉 Real data testing completed!');
  
  // Clean up
  await prisma.$disconnect();
}

// Install uuid if not already installed
try {
  require('uuid');
} catch (error) {
  console.log('⚠️  UUID package not found. Install it with: npm install uuid');
  process.exit(1);
}

testWithRealCustomer().catch(console.error);