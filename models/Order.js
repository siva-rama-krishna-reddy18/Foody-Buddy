// models/Order.js
const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  order_number: { 
    type: Number, 
    required: true,
    unique: true 
  },
  orderNumberProvisional: { type: Number },
  amount: { type: String, required: true },
  amount_paid: { type: String },
  created_at: { type: Date, default: Date.now },
  date: { type: Date },
  currency: { type: String, default: 'USD' },
  group_id: { type: String, required: true, index: true },
  customer_id: { type: String, index: true },
  line_items: [{
    product: String,
    title: String,
    price: String,
    quantity: Number,
    total: String,
    specialInstructions: String
  }],
  payment_method: { type: String },
  status: { 
    type: String, 
    default: 'CONFIRMED',
    enum: ['CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED']
  }
}, { 
  collection: 'orders',
  timestamps: false 
});

// Add indexes
orderSchema.index({ group_id: 1, created_at: -1 });
orderSchema.index({ order_number: 1 });

module.exports = mongoose.model('Order', orderSchema);