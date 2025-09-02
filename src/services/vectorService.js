// src/services/vectorService.js
const { PrismaClient } = require('@prisma/client');
const { generateEmbedding } = require('./embeddingService');

const prisma = new PrismaClient();
const DEBUG = process.env.NODE_ENV === 'development';

async function searchSimilar(query, k = 5, ownerType = 'product') {
  try {
    if (DEBUG) console.log(`[VECTOR] Searching for: ${query} k: ${k} ownerType: ${ownerType}`);
    
    // Try to generate embedding
    const queryEmbedding = await generateEmbedding(query);
    
    if (!queryEmbedding) {
      if (DEBUG) console.log('[VECTOR] No embedding generated, falling back to text search');
      return await fallbackTextSearch(query, k, ownerType);
    }
    
    // For now, always use fallback since vector operations may not be available
    return await fallbackTextSearch(query, k, ownerType);
    
  } catch (error) {
    console.error('[VECTOR] Search error:', error);
    return await fallbackTextSearch(query, k, ownerType);
  }
}

async function fallbackTextSearch(query, k = 5, ownerType = 'product') {
  try {
    if (DEBUG) console.log(`[VECTOR] Using text fallback search for: ${query}`);
    
    if (ownerType === 'product') {
      const products = await prisma.product.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } }
          ]
        },
        take: k
      });
      
      return products.map(product => ({
        id: product.id,
        name: product.name,
        price: parseFloat(product.price),
        description: product.description,
        similarity: 0.8 // Mock similarity for text search
      }));
    }
    
    return [];
    
  } catch (error) {
    console.error('[VECTOR] Fallback search error:', error);
    return [];
  }
}

if (DEBUG) {
  console.log('[VECTOR] Service loaded');
}

module.exports = {
  searchSimilar,
  fallbackTextSearch
};