const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding FoodyBuddy database...');

    // Create test customers first
    const customers = [
        {
            phone: '+1234567890',
            name: 'John Doe',
            email: 'john@example.com',
            city: 'New York',
            country: 'USA'
        },
        {
            phone: '+1987654321',
            name: 'Jane Smith',
            email: 'jane@example.com',
            city: 'Los Angeles',
            country: 'USA'
        },
        {
            phone: 'guest_premium_123',
            name: 'Guest User',
            email: null,
            city: null,
            country: null
        }
    ];

    for (const customer of customers) {
        await prisma.customer.upsert({
            where: { phone: customer.phone },
            update: customer,
            create: customer
        });
    }

    console.log('✅ Created test customers');

    // Create basic chat sessions - matching your current schema exactly
    const now = new Date();
    const sessions = await Promise.all([
        prisma.chat_sessions.create({
            data: {
                id: uuidv4(),
                customer_id: '+1234567890',
                title: 'Pizza Order Chat',
                created_at: now,
                updated_at: now
            }
        }),
        prisma.chat_sessions.create({
            data: {
                id: uuidv4(),
                customer_id: '+1987654321',
                title: 'Burger Order Chat',
                created_at: now,
                updated_at: now
            }
        }),
        prisma.chat_sessions.create({
            data: {
                id: uuidv4(),
                customer_id: 'guest_premium_123',
                title: 'Menu Inquiry',
                created_at: now,
                updated_at: now
            }
        })
    ]);

    console.log('✅ Created chat sessions:', sessions.length);

    // Create basic conversations - matching your current schema
    const conversations = [
        // Session 1: Pizza conversation
        [
            { 
                id: uuidv4(),
                content: 'Hi! I want to see your pizza menu', 
                sender: 'customer', 
                session_id: sessions[0].id,
                message_type: 'text',
                created_at: new Date(now.getTime() + 1000)
            },
            { 
                id: uuidv4(),
                content: 'Great choice! Our pizzas are made fresh daily:\n\n• Margherita - $12.99 (Fresh basil, mozzarella, tomato)\n• Pepperoni - $14.99 (Classic pepperoni with cheese)\n• BBQ Chicken - $16.99 (BBQ sauce, chicken, red onions)\n• Veggie Supreme - $15.99 (Bell peppers, mushrooms, olives)\n• Meat Lovers - $18.99 (Pepperoni, sausage, bacon, ham)\n\nWhich pizza would you like to order?', 
                sender: 'ai', 
                session_id: sessions[0].id,
                message_type: 'text',
                created_at: new Date(now.getTime() + 2000)
            },
            { 
                id: uuidv4(),
                content: 'I want a large pepperoni pizza', 
                sender: 'customer', 
                session_id: sessions[0].id,
                message_type: 'text',
                created_at: new Date(now.getTime() + 3000)
            },
            { 
                id: uuidv4(),
                content: 'Perfect! Large Pepperoni Pizza for $16.99. Would you like to add any drinks?', 
                sender: 'ai', 
                session_id: sessions[0].id,
                message_type: 'text',
                created_at: new Date(now.getTime() + 4000)
            }
        ],

        // Session 2: Burger conversation
        [
            { 
                id: uuidv4(),
                content: 'What burgers do you have?', 
                sender: 'customer', 
                session_id: sessions[1].id,
                message_type: 'text',
                created_at: new Date(now.getTime() + 5000)
            },
            { 
                id: uuidv4(),
                content: 'Awesome! Our burgers are juicy and delicious:\n\n• Classic Beef - $8.99 (Lettuce, tomato, onion, pickle)\n• Chicken Deluxe - $9.99 (Grilled chicken, avocado, bacon)\n• Veggie Burger - $8.49 (Plant-based patty, fresh veggies)\n• BBQ Bacon - $11.99 (BBQ sauce, crispy bacon, onion rings)\n\nAll burgers come with crispy fries! Which one sounds good?', 
                sender: 'ai', 
                session_id: sessions[1].id,
                message_type: 'text',
                created_at: new Date(now.getTime() + 6000)
            }
        ],

        // Session 3: Menu inquiry
        [
            { 
                id: uuidv4(),
                content: 'Hi, can I see your menu?', 
                sender: 'customer', 
                session_id: sessions[2].id,
                message_type: 'text',
                created_at: new Date(now.getTime() + 7000)
            },
            { 
                id: uuidv4(),
                content: 'Here are our popular menu categories!\n\nPIZZA ($12.99 - $18.99)\n- Margherita, Pepperoni, BBQ Chicken, Veggie Supreme\n\nBURGERS ($8.99 - $12.99)\n- Classic Beef, Chicken Deluxe, Veggie Burger, BBQ Bacon\n\nPASTA ($10.99 - $14.99)\n- Spaghetti Carbonara, Penne Arrabbiata, Fettuccine Alfredo\n\nWhat type of food sounds good to you?', 
                sender: 'ai', 
                session_id: sessions[2].id,
                message_type: 'text',
                created_at: new Date(now.getTime() + 8000)
            }
        ]
    ];

    // Insert all messages
    for (const conversation of conversations) {
        await prisma.messages.createMany({
            data: conversation
        });
    }

    console.log('✅ Created sample conversations');

    // Create one more empty session for testing
    await prisma.chat_sessions.create({
        data: {
            id: uuidv4(),
            customer_id: '+1234567890',
            title: 'Empty Session for Testing',
            created_at: now,
            updated_at: now
        }
    });

    console.log('🎉 Database seeded successfully!');
    console.log('📊 Summary:');
    console.log(`   - ${customers.length} test customers created`);
    console.log(`   - ${sessions.length + 1} chat sessions`);
    console.log(`   - ${conversations.flat().length} messages created`);
    console.log('🚀 Ready for testing with your current schema!');
    console.log('\n💡 Note: To use Week 2 enhanced features, update your schema.prisma first, then run migration.');
}

main()
    .catch((e) => {
        console.error('❌ Error seeding database:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });