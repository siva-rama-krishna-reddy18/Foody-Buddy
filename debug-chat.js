require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function debugChat() {
    try {
        console.log(' Available Prisma models:');
        console.log(Object.keys(prisma));
        
        console.log('\n Testing specific models...');
        
        // Test different model name variations
        if (prisma.chatSession) console.log(' chatSession exists');
        if (prisma.ChatSession) console.log(' ChatSession exists');
        if (prisma.chat_sessions) console.log(' chat_sessions exists');
        if (prisma.chatSessions) console.log(' chatSessions exists');
        
        if (prisma.message) console.log(' message exists');
        if (prisma.Message) console.log(' Message exists');
        if (prisma.messages) console.log(' messages exists');
        
    } catch (error) {
        console.error(' Error:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

debugChat();