const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class PreferenceService {
  
  async updateCustomerPreferences(customerId, preferenceData) {
    try {
      // Upsert customer preferences
      const existingPrefs = await prisma.customerPreference.findUnique({
        where: { customerId }
      }) || { preferences: {}, dietaryRestrictions: [] };
      
      const updatedPrefs = {
        ...existingPrefs.preferences,
        liked: [...(existingPrefs.preferences.liked || []), ...(preferenceData.liked || [])],
        disliked: [...(existingPrefs.preferences.disliked || []), ...(preferenceData.disliked || [])],
        lastUpdated: new Date()
      };
      
      await prisma.customerPreference.upsert({
        where: { customerId },
        update: {
          preferences: updatedPrefs,
          dietaryRestrictions: preferenceData.dietary || existingPrefs.dietaryRestrictions
        },
        create: {
          customerId,
          preferences: updatedPrefs,
          dietaryRestrictions: preferenceData.dietary || []
        }
      });
      
      return updatedPrefs;
    } catch (error) {
      console.error('Error updating preferences:', error);
      return null;
    }
  }
  
  async getCustomerPreferences(customerId) {
    try {
      const prefs = await prisma.customerPreference.findUnique({
        where: { customerId }
      });
      return prefs || { preferences: {}, dietaryRestrictions: [] };
    } catch (error) {
      console.error('Error fetching preferences:', error);
      return { preferences: {}, dietaryRestrictions: [] };
    }
  }
  
  async analyzeOrderHistory(customerId) {
    try {
      // Analyze past orders to extract preferences
      const orders = await prisma.order.findMany({
        where: { customerId },
        include: { items: { include: { product: true } } },
        orderBy: { createdAt: 'desc' },
        take: 20
      });
      
      const preferences = {
        favoriteItems: [],
        frequentCategories: [],
        averageOrderValue: 0,
        preferredOrderTime: null
      };
      
      if (orders.length === 0) return preferences;
      
      // Calculate favorite items (most ordered)
      const itemCounts = {};
      const categoryCounts = {};
      let totalValue = 0;
      
      orders.forEach(order => {
        totalValue += parseFloat(order.totalAmount || 0);
        order.items.forEach(item => {
          const productName = item.product.name;
          const category = item.product.category;
          
          itemCounts[productName] = (itemCounts[productName] || 0) + item.quantity;
          categoryCounts[category] = (categoryCounts[category] || 0) + item.quantity;
        });
      });
      
      // Sort and get top preferences
      preferences.favoriteItems = Object.entries(itemCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }));
        
      preferences.frequentCategories = Object.entries(categoryCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3)
        .map(([category, count]) => ({ category, count }));
        
      preferences.averageOrderValue = totalValue / orders.length;
      
      return preferences;
    } catch (error) {
      console.error('Error analyzing order history:', error);
      return { favoriteItems: [], frequentCategories: [], averageOrderValue: 0 };
    }
  }
}