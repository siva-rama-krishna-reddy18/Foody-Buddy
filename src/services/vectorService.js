// src/services/vectorService.js
// MongoDB vector service with embedding support

const Product = require('../../models/Product');
const { generateEmbedding, calculateSimilarity } = require('./embeddingService');

const DEBUG = process.env.NODE_ENV === 'development';

async function searchSimilar(query, k = 5, ownerType = 'product') {
  try {
    if (DEBUG) console.log(`[VECTOR] Searching for: ${query} k: ${k} ownerType: ${ownerType}`);
    
    const queryLower = query.toLowerCase().trim();
    
    // For menu requests, skip vector search entirely
    if (queryLower === 'menu' || 
        queryLower === 'view menu' || 
        queryLower.includes('special') ||
        queryLower.includes('show all')) {
      if (DEBUG) console.log('[VECTOR] Menu request detected - using direct text search');
      return await enhancedTextSearch(query, k, ownerType);
    }
    
    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query);
    
    if (!queryEmbedding) {
      if (DEBUG) console.log('[VECTOR] No embedding generated, falling back to text search');
      return await enhancedTextSearch(query, k, ownerType);
    }
    
    
    if (DEBUG) console.log('[VECTOR] Embedding generated, attempting vector search');
    
    
    try {
      const vectorResults = await performMongoDBVectorSearch(queryEmbedding, query, k, ownerType);
      if (vectorResults && vectorResults.length > 0) {
        if (DEBUG) console.log(`[VECTOR] Vector search returned ${vectorResults.length} results`);
        return vectorResults;
      }
    } catch (vectorError) {
      if (DEBUG) console.log('[VECTOR] Vector search failed, using text fallback:', vectorError.message);
    }
    
    // Fallback to enhanced text search
    return await enhancedTextSearch(query, k, ownerType);
    
  } catch (error) {
    console.error('[VECTOR] Search error:', error);
    return await enhancedTextSearch(query, k, ownerType);
  }
}

async function performMongoDBVectorSearch(queryEmbedding, query, k = 5, ownerType = 'product') {
  if (DEBUG) console.log('[VECTOR] Performing MongoDB vector search');
  
  try {
    // Get all products with embeddings
    const products = await Product.find({
      available: true,
      embedding: { $exists: true, $ne: [] }
    }).lean();
    
    if (products.length === 0) {
      if (DEBUG) console.log('[VECTOR] No products with embeddings found in database');
      return null;
    }
    
    if (DEBUG) console.log(`[VECTOR] Retrieved ${products.length} products with embeddings from database`);
    // Add id field if it doesn't exist (use _id)
    const productsWithId = products.map(p => ({
      ...p,
      id: p.id || p._id.toString()
    }));
    return await calculateSimilaritiesFromProducts(products, queryEmbedding, query, k);
    
  } catch (error) {
    console.error('[VECTOR] MongoDB vector search error:', error);
    return null;
  }
}

async function calculateSimilaritiesFromProducts(products, queryEmbedding, query, k) {
  const queryLower = query.toLowerCase().trim();
  const queryWords = queryLower.split(/\s+/).filter(word => word.length > 0);
  
  // Strict filtering setup
  const strictTerms = {
    'soup': ['soup'],
    'tea': ['tea', 'chai'],
    'chai': ['chai', 'tea'], 
    'coffee': ['coffee'],
    'juice': ['juice', 'lassi'],
    'water': ['water'],
    'sweet': ['jamun', 'laddu', 'sweet', 'dessert', 'gulab'],
    'dessert': ['jamun', 'laddu', 'sweet', 'dessert', 'gulab'],
    'chicken': ['chicken'],
    'rice': ['rice'],
    'biryani': ['biryani'],
    
    'fried rice': ['fried rice'], // Must match exactly, not "chicken fried rice"
  };
  
  let shouldFilterStrictly = false;
  let requiredKeywords = [];
  let isExactMatch = false;
  
  // Check for exact match first
  if (queryLower === 'fried rice' || queryLower === 'add fried rice to cart') {
    shouldFilterStrictly = true;
    requiredKeywords = ['fried rice'];
    isExactMatch = true;
    if (DEBUG) console.log('[VECTOR] EXACT MATCH MODE: Only "Fried Rice", not "Chicken Fried Rice"');
  }
  // Check if query matches strict term
  else {
    for (const [searchTerm, keywords] of Object.entries(strictTerms)) {
      if (queryLower.includes(searchTerm)) {
        shouldFilterStrictly = true;
        requiredKeywords = keywords;
        if (DEBUG) console.log(`[VECTOR] STRICT MODE activated for: ${searchTerm}`);
        break;
      }
    }
  }
  
  if (DEBUG && shouldFilterStrictly) {
    console.log(`[VECTOR] STRICT MODE: Only showing items containing: ${requiredKeywords.join(', ')}`);
  }
  
  const similarities = [];
  
  for (const product of products) {
    const productId = product.id || (product._id ? product._id.toString() : null);
    
    if (!productId) {
      if (DEBUG) console.log('[VECTOR] Skipping product without ID');
      continue;
    }
    
    if (!product.embedding || !Array.isArray(product.embedding) || product.embedding.length === 0) {
      if (DEBUG) console.log(`[VECTOR] Product ${product.name} has no embedding, skipping`);
      continue;
    }
    
    if (DEBUG && similarities.length < 3) {
      console.log(`[VECTOR] Processing product: ${product.name} with ${product.embedding.length}D embedding`);
    }
    
    // Calculate similarity
    const similarity = calculateSimilarity(queryEmbedding, product.embedding);
    let boostedSimilarity = similarity;
    
    // Apply strict filtering
    if (shouldFilterStrictly) {
      const productText = product.name.toLowerCase();
      
      
      if (isExactMatch) {
        
        if (productText === 'fried rice') {
          boostedSimilarity += 0.5;
          if (DEBUG) console.log(`[VECTOR] EXACT MATCH CONFIRMED: "${product.name}"`);
        } else if (productText.includes('fried rice')) {
          
          if (DEBUG) console.log(`[VECTOR] FILTERED OUT: "${product.name}" - contains extra words`);
          continue;
        } else {
          if (DEBUG) console.log(`[VECTOR] FILTERED OUT: "${product.name}" - doesn't match "fried rice"`);
          continue;
        }
      } else {
        // Normal strict mode
        let hasRequiredKeyword = false;
        for (const keyword of requiredKeywords) {
          if (productText.includes(keyword)) {
            hasRequiredKeyword = true;
            break;
          }
        }
        
        if (!hasRequiredKeyword) {
          if (DEBUG) console.log(`[VECTOR] FILTERED OUT: "${product.name}" - doesn't contain required keywords`);
          continue;
        }
        
        boostedSimilarity += 0.3;
        if (DEBUG) console.log(`[VECTOR] STRICT MATCH CONFIRMED: "${product.name}"`);
      }
    }
    
    // Apply exact match boosting
    if (product.name?.toLowerCase() === queryLower) {
      boostedSimilarity += 0.3;
      if (DEBUG) console.log(`[VECTOR] PERFECT NAME MATCH: "${product.name}"`);
    } else if (product.name?.toLowerCase().includes(queryLower)) {
      boostedSimilarity += 0.2;
      if (DEBUG) console.log(`[VECTOR] NAME CONTAINS QUERY: "${product.name}"`);
    }
    
    // Word match boosting
    for (const word of queryWords) {
      if (word.length > 2) {
        if (product.name?.toLowerCase().includes(word)) {
          boostedSimilarity += 0.1;
        }
        if (product.description?.toLowerCase().includes(word)) {
          boostedSimilarity += 0.05;
        }
        if (product.category?.toLowerCase().includes(word)) {
          boostedSimilarity += 0.05;
        }
      }
    }
    
    if (boostedSimilarity > 0.1 || similarity > 0.3) {
      similarities.push({
        id: productId,
        name: product.name,
        price: parseFloat(product.price || 0),
        description: product.description || '',
        category: product.category || '',
        image: product.image || product.imageUrl || '',
        similarity: Math.min(1.0, boostedSimilarity),
        originalSimilarity: similarity
      });
    }
  }
  
  // Sort and return top results
  similarities.sort((a, b) => b.similarity - a.similarity);
  const results = similarities.slice(0, k);
  
  if (DEBUG) {
    console.log(`[VECTOR] Vector search found ${similarities.length} items, returning top ${results.length}`);
    results.forEach((result, idx) => {
      const boost = result.similarity - result.originalSimilarity;
      console.log(`[VECTOR] ${idx + 1}. ${result.name} (similarity: ${result.similarity.toFixed(3)}, base: ${result.originalSimilarity.toFixed(3)}, boost: +${boost.toFixed(3)})`);
    });
  }
  
  return results;
}
// Enhanced text search fallback
async function enhancedTextSearch(query, k = 5, ownerType = 'product') {
  try {
    if (DEBUG) console.log(`[VECTOR] Using enhanced text fallback search for: ${query}`);
    
    if (ownerType === 'product') {
      const queryLower = query.toLowerCase().trim();
      
      // Check if this is a menu request
      const isMenuRequest = queryLower === 'menu' || 
                           queryLower === 'view menu' ||
                           queryLower.includes('special');
      
      if (isMenuRequest) {
        if (DEBUG) console.log('[VECTOR] Menu request - fetching ALL products');
        
        const menuItems = await Product.find({ available: true })
          .limit(50)
          .lean();
        
        if (DEBUG) console.log(`[VECTOR] Found ${menuItems.length} total menu items`);
        
        
        return menuItems.map(p => ({
          id: p._id.toString(), 
          name: p.name,
          price: parseFloat(p.price || 0),
          description: p.description || '',
          category: p.category || 'Main Course',
          image: p.image || p.imageUrl || '',
          similarity: 0.9
        }));
      }
      
      // Text-based search for non-menu queries
      const textQuery = {
        available: true,
        $or: [
          { name: new RegExp(query, 'i') },
          { description: new RegExp(query, 'i') },
          { category: new RegExp(query, 'i') }
        ]
      };
      
      const products = await Product.find(textQuery)
        .limit(k)
        .lean();
      
      if (DEBUG) console.log(`[VECTOR] Text search found ${products.length} products`);
      
      
      return products.map(p => ({
        id: p._id.toString(), 
        name: p.name,
        price: parseFloat(p.price || 0),
        description: p.description || '',
        category: p.category || 'Main Course',
        image: p.image || p.imageUrl || '',
        similarity: 0.8
      }));
    }
    
    return [];
  } catch (error) {
    console.error('[VECTOR] Enhanced text search error:', error);
    return [];
  }
}

if (DEBUG) {
  console.log('[VECTOR] MongoDB vector search service loaded');
  
  // Test MongoDB connection for all products
  Product.countDocuments({ available: true })
  .then(count => {
    console.log(`[VECTOR] Found ${count} available products in MongoDB`);
    
    // Also check for products with embeddings
    return Product.countDocuments({ 
      available: true, 
      embedding: { $exists: true, $ne: [] } 
    });
  })
  .then(embeddingCount => {
    console.log(`[VECTOR] Found ${embeddingCount} products with embeddings`);
  })
  .catch(error => {
    console.log('[VECTOR] MongoDB connection test failed:', error.message);
  });
}

module.exports = {
  searchSimilar,
  fallbackTextSearch: enhancedTextSearch
};
