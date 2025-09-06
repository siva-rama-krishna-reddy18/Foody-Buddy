// scripts/generateProductEmbeddings.js
// Script to generate embeddings for all products in the database

const { PrismaClient } = require('@prisma/client');
const { generateEmbedding } = require('../src/services/embeddingService');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

async function generateAllProductEmbeddings() {
  try {
    console.log('🚀 Starting product embedding generation...');
    
    // Get all products
    const products = await prisma.product.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        ingredients: true
      }
    });
    
    console.log(`📊 Found ${products.length} products to process`);
    
    // Check existing embeddings
    const existingEmbeddings = await prisma.embedding.findMany({
      where: {
        ownerType: 'product'
      },
      select: {
        ownerId: true
      }
    });
    
    const existingProductIds = new Set(existingEmbeddings.map(e => e.ownerId));
    console.log(`✅ Found ${existingEmbeddings.length} existing product embeddings`);
    
    let processed = 0;
    let created = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const product of products) {
      try {
        processed++;
        
        // Skip if embedding already exists
        if (existingProductIds.has(product.id)) {
          skipped++;
          console.log(`⏭️  Skipped ${product.name} (embedding exists)`);
          continue;
        }
        
        // Create embedding content from product details
        const content = [
          product.name,
          product.description,
          product.category,
          ...(product.ingredients || [])
        ].filter(Boolean).join(' ');
        
        if (!content.trim()) {
          console.log(`⚠️  Skipped ${product.name} (no content to embed)`);
          skipped++;
          continue;
        }
        
        // Generate embedding
        console.log(`🔄 Processing: ${product.name}`);
        const embedding = await generateEmbedding(content);
        
        if (!embedding) {
          console.log(`❌ Failed to generate embedding for: ${product.name}`);
          errors++;
          continue;
        }
        
        // Store embedding in database using raw SQL for vector field
        await prisma.$executeRaw`
          INSERT INTO embeddings (id, owner_type, owner_id, content, embedding, metadata, created_at)
          VALUES (
            ${uuidv4()}::uuid,
            ${'product'},
            ${product.id},
            ${content},
            ${JSON.stringify(embedding)}::vector,
            ${JSON.stringify({
              name: product.name,
              category: product.category,
              generatedAt: new Date().toISOString()
            })}::jsonb,
            NOW()
          )
        `;
        
        created++;
        console.log(`✅ Created embedding for: ${product.name} (${processed}/${products.length})`);
        
        // Small delay to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        errors++;
        console.error(`❌ Error processing ${product.name}:`, error.message);
      }
    }
    
    console.log('\n📈 Generation Summary:');
    console.log(`   Total products: ${products.length}`);
    console.log(`   Processed: ${processed}`);
    console.log(`   Created: ${created}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Errors: ${errors}`);
    
    // Verify final count
    const finalCount = await prisma.embedding.count({
      where: { ownerType: 'product' }
    });
    
    console.log(`\n🎉 Final embedding count: ${finalCount}`);
    
    if (finalCount === products.length) {
      console.log('✅ All products now have embeddings! Vector search should work perfectly.');
    } else {
      console.log(`⚠️  ${products.length - finalCount} products still missing embeddings.`);
    }
    
  } catch (error) {
    console.error('💥 Fatal error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
if (require.main === module) {
  generateAllProductEmbeddings()
    .then(() => {
      console.log('🏁 Script completed!');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Script failed:', error);
      process.exit(1);
    });
}

module.exports = { generateAllProductEmbeddings };