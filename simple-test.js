// Load environment variables
require('dotenv').config();

console.log(' Testing environment...');

// Check environment
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Missing');
console.log('DATABASE_URL preview:', process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 30) + '...' : 'None');

// Try to load Prisma
try {
    const { PrismaClient } = require('@prisma/client');
    console.log(' Prisma import successful');
    
    // Try to create client
    console.log(' Creating Prisma client...');
    const prisma = new PrismaClient({
        log: ['error'],
        errorFormat: 'minimal',
    });
    console.log(' Prisma client created');
    
    // Try to connect
    console.log(' Testing database connection...');
    prisma.$connect().then(() => {
        console.log(' Database connection successful');
        return prisma.$disconnect();
    }).catch(error => {
        console.error(' Database connection failed:', error.message);
    });
    
} catch (error) {
    console.error(' Prisma error:', error.message);
}
