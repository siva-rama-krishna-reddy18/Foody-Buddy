// src/services/cartService.js
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const Cart = require('../../models/Cart');
const CartItem = require('../../models/CartItem');
const Product = require('../../models/Product');

class CartService {
  
  async getCart(customerId) {
    try {
      const cart = await Cart.findOne({ customer_id: customerId }).lean();
      
      if (!cart) {
        return { items: [], total: 0, itemCount: 0 };
      }
      
      const cartItems = await CartItem.find({ cart_id: cart.id }).lean();
      
      // Get product details for each cart item
      const itemsWithDetails = await Promise.all(
        cartItems.map(async (item) => {
          const product = await Product.findOne({ id: item.productId }).lean();
          return {
            ...item,
            product: product
          };
        })
      );
      
      const total = itemsWithDetails.reduce((sum, item) => 
        sum + (parseFloat(item.product?.price || 0) * item.quantity), 0
      );
      
      return {
        id: cart.id,
        items: itemsWithDetails,
        total: total,
        itemCount: itemsWithDetails.reduce((sum, item) => sum + item.quantity, 0)
      };
    } catch (error) {
      console.error('Error fetching cart:', error);
      return { items: [], total: 0, itemCount: 0 };
    }
  }
  
  async addToCart(customerId, productId, quantity = 1, customizations = {}) {
    try {
      // Get or create cart
      let cart = await Cart.findOne({ customer_id: customerId });
      
      if (!cart) {
        cart = await Cart.create({
          id: uuidv4(),
          customer_id: customerId,
          session_id: uuidv4(),
          status: 'OPEN',
          created_at: new Date(),
          updated_at: new Date()
        });
      }
      
      // Check if item already exists in cart
      const existingItem = await CartItem.findOne({
        cart_id: cart.id,
        productId: productId
      });
      
      if (existingItem) {
        // Update quantity
        await CartItem.findOneAndUpdate(
          { id: existingItem.id },
          { 
            quantity: existingItem.quantity + quantity,
            customizations: customizations,
            updated_at: new Date()
          }
        );
      } else {
        // Get product details
        const product = await Product.findOne({ id: productId }).lean();
        
        // Add new item
        await CartItem.create({
          id: uuidv4(),
          cart_id: cart.id,
          productId: productId,
          title: product?.name || 'Item',
          unit_price: parseFloat(product?.price || 0),
          quantity: quantity,
          customizations: customizations,
          created_at: new Date(),
          updated_at: new Date()
        });
      }
      
      return await this.getCart(customerId);
    } catch (error) {
      console.error('Error adding to cart:', error);
      throw error;
    }
  }
  
  async removeFromCart(customerId, productId, quantity = null) {
    try {
      const cart = await Cart.findOne({ customer_id: customerId });
      
      if (!cart) return { items: [], total: 0, itemCount: 0 };
      
      const cartItem = await CartItem.findOne({
        cart_id: cart.id,
        productId: productId
      });
      
      if (!cartItem) return await this.getCart(customerId);
      
      if (quantity === null || cartItem.quantity <= quantity) {
        // Remove item completely
        await CartItem.deleteOne({ id: cartItem.id });
      } else {
        // Reduce quantity
        await CartItem.findOneAndUpdate(
          { id: cartItem.id },
          { 
            quantity: cartItem.quantity - quantity,
            updated_at: new Date()
          }
        );
      }
      
      return await this.getCart(customerId);
    } catch (error) {
      console.error('Error removing from cart:', error);
      throw error;
    }
  }
  
  async clearCart(customerId) {
    try {
      const cart = await Cart.findOne({ customer_id: customerId });
      
      if (cart) {
        await CartItem.deleteMany({ cart_id: cart.id });
      }
      
      return { items: [], total: 0, itemCount: 0 };
    } catch (error) {
      console.error('Error clearing cart:', error);
      throw error;
    }
  }
}

module.exports = new CartService();