// scripts/addEmbeddings.js
require('dotenv').config();
const connectDB = require('../config/mongodb');
const Product = require('../models/Product');
const { generateEmbedding } = require('../src/services/embeddingService');

async function addEmbeddingsToExistingProducts() {
  try {
    await connectDB();
    
    console.log('🔍 Finding products without embeddings...\n');

    const products = await Product.find({
      $or: [
        { embedding: { $exists: false } },
        { embedding: { $size: 0 } },
        { embedding: null }
      ]
    });

    console.log(`Found ${products.length} products without embeddings\n`);

    for (const product of products) {
      const text = `${product.name} ${product.description || ''} ${product.category || ''}`;
      console.log(`Processing: ${product.name}`);
      
      const embedding = await generateEmbedding(text);
      
      if (embedding) {
        await Product.updateOne(
          { _id: product._id },
          { 
            $set: { 
              embedding: embedding,
              available: true // Ensure product is available
            } 
          }
        );
        console.log(`✅ Added embedding for: ${product.name}`);
      } else {
        console.log(`⚠️  Could not generate embedding for: ${product.name}`);
      }
    }

    console.log('\n🎉 Done! All products now have embeddings.');
    
    const withEmbeddings = await Product.countDocuments({ 
      embedding: { $exists: true, $ne: [] } 
    });
    console.log(`📊 Products with embeddings: ${withEmbeddings}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

addEmbeddingsToExistingProducts();