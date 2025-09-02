class CartService {
  
  async getCart(sessionId) {
    try {
      const cart = await prisma.cart.findUnique({
        where: { sessionId },
        include: {
          items: {
            include: { product: true }
          }
        }
      });
      
      if (!cart) {
        return { items: [], total: 0, itemCount: 0 };
      }
      
      const total = cart.items.reduce((sum, item) => 
        sum + (parseFloat(item.product.price) * item.quantity), 0
      );
      
      return {
        id: cart.id,
        items: cart.items,
        total: total,
        itemCount: cart.items.reduce((sum, item) => sum + item.quantity, 0)
      };
    } catch (error) {
      console.error('Error fetching cart:', error);
      return { items: [], total: 0, itemCount: 0 };
    }
  }
  
  async addToCart(sessionId, productId, quantity = 1, customizations = {}) {
    try {
      // Get or create cart
      let cart = await prisma.cart.findUnique({
        where: { sessionId }
      });
      
      if (!cart) {
        cart = await prisma.cart.create({
          data: { sessionId }
        });
      }
      
      // Check if item already exists in cart
      const existingItem = await prisma.cartItem.findFirst({
        where: {
          cartId: cart.id,
          productId: productId
        }
      });
      
      if (existingItem) {
        // Update quantity
        await prisma.cartItem.update({
          where: { id: existingItem.id },
          data: { 
            quantity: existingItem.quantity + quantity,
            customizations: customizations
          }
        });
      } else {
        // Add new item
        await prisma.cartItem.create({
          data: {
            cartId: cart.id,
            productId: productId,
            quantity: quantity,
            customizations: customizations
          }
        });
      }
      
      return await this.getCart(sessionId);
    } catch (error) {
      console.error('Error adding to cart:', error);
      throw error;
    }
  }
  
  async removeFromCart(sessionId, productId, quantity = null) {
    try {
      const cart = await prisma.cart.findUnique({
        where: { sessionId }
      });
      
      if (!cart) return { items: [], total: 0, itemCount: 0 };
      
      const cartItem = await prisma.cartItem.findFirst({
        where: {
          cartId: cart.id,
          productId: productId
        }
      });
      
      if (!cartItem) return await this.getCart(sessionId);
      
      if (quantity === null || cartItem.quantity <= quantity) {
        // Remove item completely
        await prisma.cartItem.delete({
          where: { id: cartItem.id }
        });
      } else {
        // Reduce quantity
        await prisma.cartItem.update({
          where: { id: cartItem.id },
          data: { quantity: cartItem.quantity - quantity }
        });
      }
      
      return await this.getCart(sessionId);
    } catch (error) {
      console.error('Error removing from cart:', error);
      throw error;
    }
  }
  
  async clearCart(sessionId) {
    try {
      const cart = await prisma.cart.findUnique({
        where: { sessionId }
      });
      
      if (cart) {
        await prisma.cartItem.deleteMany({
          where: { cartId: cart.id }
        });
      }
      
      return { items: [], total: 0, itemCount: 0 };
    } catch (error) {
      console.error('Error clearing cart:', error);
      throw error;
    }
  }
}

module.exports = { 
  enhancedClassify, 
  PreferenceService, 
  RecommendationService, 
  CartService 
};