class RecommendationService {
  
  constructor() {
    this.preferenceService = new PreferenceService();
  }
  
  async getPersonalizedRecommendations(customerId, context = {}) {
    try {
      const [preferences, orderHistory, products] = await Promise.all([
        this.preferenceService.getCustomerPreferences(customerId),
        this.preferenceService.analyzeOrderHistory(customerId),
        this.getAvailableProducts()
      ]);
      
      let recommendations = [];
      
      // 1. Based on favorite items - recommend similar items
      if (orderHistory.favoriteItems.length > 0) {
        const similar = await this.findSimilarItems(orderHistory.favoriteItems, products);
        recommendations.push(...similar.map(item => ({
          ...item,
          reason: 'Based on your favorites',
          confidence: 0.9
        })));
      }
      
      // 2. Based on frequent categories
      if (orderHistory.frequentCategories.length > 0) {
        const categoryItems = products.filter(p => 
          orderHistory.frequentCategories.some(cat => cat.category === p.category)
        );
        recommendations.push(...categoryItems.slice(0, 3).map(item => ({
          ...item,
          reason: `Popular in ${item.category}`,
          confidence: 0.7
        })));
      }
      
      // 3. Based on dietary preferences
      if (preferences.dietaryRestrictions.length > 0) {
        const dietaryFriendly = products.filter(p => 
          this.matchesDietaryRestrictions(p, preferences.dietaryRestrictions)
        );
        recommendations.push(...dietaryFriendly.slice(0, 2).map(item => ({
          ...item,
          reason: 'Matches your dietary preferences',
          confidence: 0.8
        })));
      }
      
      // 4. Context-based recommendations (time of day, weather, etc.)
      const contextual = await this.getContextualRecommendations(context, products);
      recommendations.push(...contextual);
      
      // 5. Popular items (fallback)
      if (recommendations.length < 3) {
        const popular = await this.getPopularItems(products);
        recommendations.push(...popular.slice(0, 5 - recommendations.length).map(item => ({
          ...item,
          reason: 'Popular choice',
          confidence: 0.5
        })));
      }
      
      // Remove duplicates and sort by confidence
      const unique = this.removeDuplicates(recommendations);
      return unique.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
      
    } catch (error) {
      console.error('Error generating recommendations:', error);
      return await this.getDefaultRecommendations();
    }
  }
  
  async findSimilarItems(favoriteItems, products) {
    // Simple similarity based on category and keywords
    const similar = [];
    
    favoriteItems.forEach(fav => {
      const favProduct = products.find(p => p.name.toLowerCase().includes(fav.name.toLowerCase()));
      if (favProduct) {
        const categoryMatches = products.filter(p => 
          p.category === favProduct.category && p.id !== favProduct.id
        );
        similar.push(...categoryMatches.slice(0, 2));
      }
    });
    
    return similar;
  }
  
  matchesDietaryRestrictions(product, restrictions) {
    // Check if product matches dietary restrictions
    const productText = `${product.name} ${product.description || ''} ${product.ingredients || ''}`.toLowerCase();
    
    for (const restriction of restrictions) {
      switch (restriction) {
        case 'vegetarian':
          if (productText.includes('chicken') || productText.includes('meat') || productText.includes('fish')) {
            return false;
          }
          break;
        case 'vegan':
          if (productText.includes('dairy') || productText.includes('cheese') || productText.includes('paneer')) {
            return false;
          }
          break;
        case 'gluten-free':
          if (productText.includes('wheat') || productText.includes('roti') || productText.includes('naan')) {
            return false;
          }
          break;
      }
    }
    
    return true;
  }
  
  async getContextualRecommendations(context, products) {
    const recommendations = [];
    const currentHour = new Date().getHours();
    
    // Time-based recommendations
    if (currentHour >= 6 && currentHour < 12) {
      // Breakfast items
      const breakfast = products.filter(p => 
        p.name.toLowerCase().includes('tea') || 
        p.name.toLowerCase().includes('coffee') ||
        p.name.toLowerCase().includes('paratha')
      );
      recommendations.push(...breakfast.slice(0, 2).map(item => ({
        ...item,
        reason: 'Perfect for breakfast',
        confidence: 0.7
      })));
    } else if (currentHour >= 12 && currentHour < 17) {
      // Lunch items
      const lunch = products.filter(p => 
        p.name.toLowerCase().includes('biryani') || 
        p.name.toLowerCase().includes('curry') ||
        p.name.toLowerCase().includes('rice')
      );
      recommendations.push(...lunch.slice(0, 2).map(item => ({
        ...item,
        reason: 'Great for lunch',
        confidence: 0.8
      })));
    } else {
      // Dinner items
      const dinner = products.filter(p => 
        p.category === 'main course' || 
        p.name.toLowerCase().includes('biryani')
      );
      recommendations.push(...dinner.slice(0, 2).map(item => ({
        ...item,
        reason: 'Perfect for dinner',
        confidence: 0.7
      })));
    }
    
    return recommendations;
  }
  
  async getPopularItems(products) {
    // Get most ordered items (simplified - would use actual order data)
    return products
      .sort((a, b) => (b.orderCount || 0) - (a.orderCount || 0))
      .slice(0, 5);
  }
  
  async getAvailableProducts() {
    try {
      return await prisma.product.findMany({
        where: { availability: true },
        orderBy: { name: 'asc' }
      });
    } catch (error) {
      console.error('Error fetching products:', error);
      return [];
    }
  }
  
  removeDuplicates(recommendations) {
    const seen = new Set();
    return recommendations.filter(item => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }
  
  async getDefaultRecommendations() {
    const products = await this.getAvailableProducts();
    return products.slice(0, 5).map(item => ({
      ...item,
      reason: 'Recommended for you',
      confidence: 0.5
    }));
  }
}