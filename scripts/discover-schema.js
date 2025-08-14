const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function discoverSchema() {
    try {
        console.log(' Discovering existing database schema...\n');
        console.log(' Connected to:', process.env.DATABASE_URL.split('@')[1]);
        
        // Get all table names
        const tables = await prisma.$queryRaw`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            ORDER BY table_name;
        `;
        
        console.log(' Existing Tables:');
        if (tables.length === 0) {
            console.log('   No tables found in database');
            return;
        }
        
        tables.forEach(table => {
            console.log(`   ${table.table_name}`);
        });
        
        console.log('\n Examining each table structure...\n');
        
        for (const table of tables) {
            const columns = await prisma.$queryRaw`
                SELECT column_name, data_type, is_nullable, column_default
                FROM information_schema.columns 
                WHERE table_name = ${table.table_name}
                ORDER BY ordinal_position;
            `;
            
            console.log(` Table: ${table.table_name}`);
            console.log('  Columns:');
            columns.forEach(col => {
                const nullable = col.is_nullable === 'NO' ? '(required)' : '(optional)';
                const defaultVal = col.column_default ? ` default: ${col.column_default}` : '';
                console.log(`    ${col.column_name}: ${col.data_type} ${nullable}${defaultVal}`);
            });
            
            // Check for sample data
            try {
                const sampleData = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM ${table.table_name}`);
                console.log(`    Rows: ${sampleData[0].count}`);
            } catch (error) {
                console.log(`    Rows: Unable to count`);
            }
            
            console.log('');
        }
        
    } catch (error) {
        console.error(' Error discovering schema:', error.message);
        if (error.message.includes('connect')) {
            console.error(' Check your DATABASE_URL in .env file');
        }
    } finally {
        await prisma.$disconnect();
    }
}

discoverSchema();