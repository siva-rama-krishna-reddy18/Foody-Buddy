const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function validateDatabase() {
    try {
        console.log(' Validating database connection and schema...\n');
        
        // Test connection
        await prisma.$connect();
        console.log(' Database connection successful');
        
        // Test each table
        console.log('\n Testing database tables:');
        
        const userCount = await prisma.user.count();
        console.log(` Users table: ${userCount} records`);
        
        const sessionCount = await prisma.chatSession.count();
        console.log(` Chat sessions table: ${sessionCount} records`);
        
        const messageCount = await prisma.message.count();
        console.log(` Messages table: ${messageCount} records`);
        
        // Test performance
        console.log('\n Testing database performance...');
        const start = Date.now();
        await prisma.message.findMany({
            take: 10,
            include: { session: true }
        });
        const end = Date.now();
        console.log(` Query performance: ${end - start}ms`);
        
        // Test relationships
        console.log('\n Testing table relationships...');
        const sampleUser = await prisma.user.findFirst({
            include: {
                chatSessions: {
                    include: {
                        messages: {
                            take: 5
                        }
                    }
                }
            }
        });
        
        if (sampleUser) {
            console.log(` Relationships working: User "${sampleUser.name}" has ${sampleUser.chatSessions.length} sessions`);
        } else {
            console.log('No users found (database is empty)');
        }
        
        console.log('\n Database validation completed successfully!');
        console.log(' Your database is ready for production use!');
        
    } catch (error) {
        console.error('\n Database validation failed:');
        console.error('Error:', error.message);
        
        if (error.code === 'P1001') {
            console.error('\n Solution: Check if your database server is running');
            console.error('   - Docker: run "docker-compose up -d"');
            console.error('   - Local: start PostgreSQL service');
        }
        
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

validateDatabase();