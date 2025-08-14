const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testConnection() {
    try {
        console.log(' Testing database connection...');
        console.log(' Database URL:', process.env.DATABASE_URL ? 'Configured' : 'Missing');
        
        // Test basic connection
        const result = await prisma.$queryRaw`SELECT 1 as test`;
        console.log(' Database connection working');
        
        // Check what tables exist
        const tables = await prisma.$queryRaw`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            ORDER BY table_name;
        `;
        
        console.log('\n Tables found:');
        if (tables.length === 0) {
            console.log('   No tables found');
        } else {
            tables.forEach((table, index) => {
                console.log(`  ${index + 1}. ${table.table_name}`);
            });
        }
        
        // Check specifically for chat tables
        const chatSessionExists = tables.some(t => t.table_name === 'chat_sessions');
        const messagesExists = tables.some(t => t.table_name === 'messages');
        
        console.log('\n Chat Tables Status:');
        console.log(`  chat_sessions: ${chatSessionExists ? ' EXISTS' : ' MISSING'}`);
        console.log(`  messages: ${messagesExists ? ' EXISTS' : ' MISSING'}`);
        
        return { chatSessionExists, messagesExists, totalTables: tables.length };
        
    } catch (error) {
        console.error(' Database connection failed:', error.message);
        console.error(' Check your DATABASE_URL in .env file');
        return null;
    } finally {
        await prisma.$disconnect();
    }
}

testConnection().then((result) => {
    if (result) {
        console.log(`\n Summary: Found ${result.totalTables} tables total`);
        if (result.chatSessionExists && result.messagesExists) {
            console.log(' Chat tables exist! Ready to proceed.');
        } else {
            console.log(' Chat tables missing. Need to create them.');
        }
    }
}).catch(error => {
    console.error('Fatal error:', error);
});