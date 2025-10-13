// models/Order.js
const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  order_number: { type: Number, required: true, index: true },
  group_id: { type: String, index: true },
  customer_id: { type: String, index: true },
  amount: { type: String, required: true },
  amount_paid: String,
  original_amount: String,        // ✅ ADD THIS
  discount_amount: String,        // ✅ ADD THIS
  coupon_code: String,            // ✅ ADD THIS
  status: { type: String, default: 'CONFIRMED' },
  currency: String,
  payment_method: String,
  line_items: [{
    product: String,
    title: String,
    price: String,
    quantity: Number,
    total: String,
    specialInstructions: String  // ✅ ADD THIS
  }],
  date: Date,
  created_at: { type: Date, default: Date.now },
  updated_at: Date,
  orderNumberProvisional: Number
}, {
  collection: 'orders',
  timestamps: false
});

// Add index for order_number
orderSchema.index({ order_number: 1 });

module.exports = mongoose.model('Order', orderSchema);