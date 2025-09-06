// src/services/vectorService.js
// Fixed vector service with direct PostgreSQL access for vector fields

const { PrismaClient } = require('@prisma/client');
const { generateEmbedding, calculateSimilarity } = require('./embeddingService');
const { Pool } = require('pg');

const prisma = new PrismaClient();
const DEBUG = process.env.NODE_ENV === 'development';

// Create direct PostgreSQL connection for vector operations
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function searchSimilar(query, k = 5, ownerType = 'product') {
  try {
    if (DEBUG) console.log(`[VECTOR] Searching for: ${query} k: ${k} ownerType: ${ownerType}`);
    
    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query);
    
    if (!queryEmbedding) {
      if (DEBUG) console.log('[VECTOR] No embedding generated, falling back to text search');
      return await enhancedTextSearch(query, k, ownerType);
    }
    
    if (DEBUG) console.log('[VECTOR] Embedding generated, attempting vector search');
    
    // Try direct PostgreSQL vector search
    try {
      const vectorResults = await performDirectVectorSearch(queryEmbedding, query, k, ownerType);
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

async function performDirectVectorSearch(queryEmbedding, query, k = 5, ownerType = 'product') {
  if (DEBUG) console.log('[VECTOR] Performing direct PostgreSQL vector search');
  
  const client = await pool.connect();
  
  try {
    // Get embeddings directly using native PostgreSQL
    const embeddingQuery = `
      SELECT 
        id,
        owner_type,
        owner_id, 
        content,
        embedding,
        metadata
      FROM embeddings 
      WHERE owner_type = $1
    `;
    
    const result = await client.query(embeddingQuery, ['product']);
    
    if (result.rows.length === 0) {
      if (DEBUG) console.log('[VECTOR] No embeddings found in database');
      return null;
    }
    
    if (DEBUG) console.log(`[VECTOR] Retrieved ${result.rows.length} embeddings from database`);
    
    return await calculateSimilaritiesFromRows(result.rows, queryEmbedding, query, k);
    
  } catch (error) {
    console.error('[VECTOR] Direct PostgreSQL search error:', error);
    return null;
  } finally {
    client.release();
  }
}

async function calculateSimilaritiesFromRows(embeddingRows, queryEmbedding, query, k) {
  const queryLower = query.toLowerCase().trim();
  const queryWords = queryLower.split(/\s+/).filter(word => word.length > 0);
  
  // Strict filtering setup
  const strictTerms = {
    'tea': ['tea', 'chai'],
    'chai': ['chai', 'tea'], 
    'coffee': ['coffee'],
    'juice': ['juice', 'lassi'],
    'water': ['water'],
    'sweet': ['jamun', 'laddu', 'sweet', 'dessert', 'gulab'],
    'dessert': ['jamun', 'laddu', 'sweet', 'dessert', 'gulab']
  };
  
  let shouldFilterStrictly = false;
  let requiredKeywords = [];
  
  for (const [searchTerm, keywords] of Object.entries(strictTerms)) {
    if (queryLower === searchTerm || queryLower === searchTerm + 's') {
      shouldFilterStrictly = true;
      requiredKeywords = keywords;
      break;
    }
  }
  
  if (DEBUG && shouldFilterStrictly) {
    console.log(`[VECTOR] STRICT MODE: Only showing items containing: ${requiredKeywords.join(', ')}`);
  }
  
  const similarities = [];
  
  for (const row of embeddingRows) {
    if (!row.owner_id) continue;
    
    // Get product data
    let product;
    try {
      product = await prisma.product.findUnique({
        where: { 
          id: row.owner_id,
          is_available: true
        }
      });
      
      if (!product) continue;
    } catch (error) {
      if (DEBUG) console.log(`[VECTOR] Could not find product ${row.owner_id}`);
      continue;
    }
    
    // Parse the stored embedding from PostgreSQL
    let storedEmbedding;
    try {
      if (DEBUG && similarities.length < 2) {
        console.log(`[VECTOR] DEBUG - Raw embedding data for ${row.owner_id}:`);
        console.log(`[VECTOR] embedding type: ${typeof row.embedding}`);
        console.log(`[VECTOR] embedding constructor: ${row.embedding ? row.embedding.constructor.name : 'null'}`);
      }
      
      // Handle PostgreSQL vector field - it comes as an array-like object
      if (row.embedding) {
        if (Array.isArray(row.embedding)) {
          storedEmbedding = row.embedding;
        } else if (typeof row.embedding === 'string') {
          // Parse string format
          const vectorText = row.embedding.trim();
          if (vectorText.startsWith('[') && vectorText.endsWith(']')) {
            storedEmbedding = JSON.parse(vectorText);
          } else {
            storedEmbedding = vectorText.split(',').map(x => parseFloat(x.trim()));
          }
        } else if (row.embedding.constructor === Object) {
          // Convert object to array (common with PostgreSQL arrays)
          storedEmbedding = Object.values(row.embedding);
        } else {
          // Try to convert whatever format it is
          storedEmbedding = Array.from(row.embedding);
        }
      }
      
      if (!storedEmbedding || !Array.isArray(storedEmbedding) || storedEmbedding.length === 0) {
        if (DEBUG) console.log(`[VECTOR] Invalid embedding format for ${row.owner_id}`);
        continue;
      }
      
      // Validate numeric values
      if (storedEmbedding.some(val => isNaN(val))) {
        if (DEBUG) console.log(`[VECTOR] Invalid embedding for ${row.owner_id} - contains NaN values`);
        continue;
      }
      
      if (DEBUG && similarities.length < 3) {
        console.log(`[VECTOR] Successfully parsed embedding for ${row.owner_id}: ${storedEmbedding.length}D vector`);
      }
    } catch (error) {
      if (DEBUG) console.log(`[VECTOR] Failed to parse embedding for ${row.owner_id}:`, error.message);
      continue;
    }
    
    // Calculate similarity
    const similarity = calculateSimilarity(queryEmbedding, storedEmbedding);
    let boostedSimilarity = similarity;
    
    // Apply strict filtering
    if (shouldFilterStrictly) {
      const productText = `${product.name} ${product.description} ${product.category}`.toLowerCase();
      
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
    
    // Apply exact match boosting
    if (product.name?.toLowerCase().includes(queryLower)) {
      boostedSimilarity += 0.2;
      if (DEBUG) console.log(`[VECTOR] EXACT MATCH BOOST: "${product.name}"`);
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
        id: product.id,
        name: product.name,
        price: parseFloat(product.price || 0),
        description: product.description,
        category: product.category,
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
      
      // Enhanced semantic keyword mapping
      const semanticMappings = {
        'tea': ['tea', 'chai', 'masala chai'],
        'chai': ['chai', 'tea', 'masala chai'],
        'coffee': ['coffee'],
        'juice': ['juice', 'lassi', 'mango lassi'],
        'water': ['water', 'bottle'],
        'sweet': ['jamun', 'laddu', 'sweet', 'dessert', 'gulab', 'jaggery'],
        'dessert': ['jamun', 'laddu', 'sweet', 'dessert', 'gulab', 'jaggery'],
        'spicy': ['masala', 'chilli', 'spicy', 'tikka', 'curry'],
        'curry': ['curry', 'masala', 'korma', 'tikka', 'dal', 'palak'],
        'rice': ['rice', 'biryani', 'fried rice', 'basmati'],
        'bread': ['roti', 'naan', 'paratha', 'bread'],
        'snack': ['samosa', 'cutlet', 'fries', 'bhel', 'chaat'],
        'chicken': ['chicken'],
        'paneer': ['paneer'],
        'goat': ['goat'],
        'veg': ['veg', 'vegetarian'],
        'menu': ['*']
      };
      
      let searchTerms = [queryLower];
      let isMenuRequest = false;
      
      for (const [key, mappedTerms] of Object.entries(semanticMappings)) {
        if (queryLower === key || queryLower === key + 's' || queryLower.includes(key)) {
          if (mappedTerms.includes('*')) {
            isMenuRequest = true;
            break;
          }
          searchTerms = mappedTerms;
          break;
        }
      }
      
      if (isMenuRequest) {
        const menuItems = await prisma.product.findMany({
          where: {
            is_available: true,
            OR: [
              { name: { contains: 'combo', mode: 'insensitive' } },
              { name: { contains: 'platter', mode: 'insensitive' } },
              { name: { contains: 'biryani', mode: 'insensitive' } },
              { name: { contains: 'samosa', mode: 'insensitive' } },
              { name: { contains: 'roti', mode: 'insensitive' } },
              { name: { contains: 'paneer', mode: 'insensitive' } },
              { name: { contains: 'chicken', mode: 'insensitive' } }
            ]
          },
          take: k
        });
        
        return menuItems.map(p => ({
          id: p.id,
          name: p.name,
          price: parseFloat(p.price || 0),
          description: p.description,
          category: p.category,
          similarity: 0.9
        }));
      }
      
      // Regular search
      const whereConditions = searchTerms.map(term => ({
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { description: { contains: term, mode: 'insensitive' } },
          { category: { contains: term, mode: 'insensitive' } }
        ]
      }));
      
      const products = await prisma.product.findMany({
        where: {
          AND: [
            { is_available: true },
            { OR: whereConditions }
          ]
        },
        take: k
      });
      
      return products.map(p => ({
        id: p.id,
        name: p.name,
        price: parseFloat(p.price || 0),
        description: p.description,
        category: p.category,
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
  console.log('[VECTOR] Direct PostgreSQL vector search service loaded');
  
  // Test PostgreSQL connection
  pool.connect().then(client => {
    client.query('SELECT COUNT(*) FROM embeddings WHERE owner_type = $1', ['product'])
      .then(result => {
        console.log(`[VECTOR] Found ${result.rows[0].count} product embeddings via direct PostgreSQL connection`);
        client.release();
      })
      .catch(error => {
        console.log('[VECTOR] PostgreSQL connection test failed:', error.message);
        client.release();
      });
  });
}

module.exports = {
  searchSimilar,
  fallbackTextSearch: enhancedTextSearch
};