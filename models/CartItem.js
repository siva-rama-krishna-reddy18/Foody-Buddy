// models/CartItem.js
const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  id: { 
    type: String, 
    required: true, 
    unique: true 
  },
  cart_id: { 
    type: String, 
    required: true,
    index: true
  },
  productId: { 
    type: String, 
    required: true,
    index: true
  },
  title: { 
    type: String,
    required: true
  },
  unit_price: { 
    type: Number, 
    required: true 
  },
  quantity: { 
    type: Number, 
    required: true, 
    default: 1 
  },
  specialInstructions: { type: String, default: '' },
  customizations: { 
    type: mongoose.Schema.Types.Mixed 
  },
  created_at: { 
    type: Date, 
    default: Date.now 
  },
  updated_at: { 
    type: Date, 
    default: Date.now 
  }
}, { 
  collection: 'cart_items',
  timestamps: false,
  strict: false
});

module.exports = mongoose.model('CartItem', cartItemSchema);