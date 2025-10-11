const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  order_number: {
    type: Number,
    required: true,
    unique: true
  },
  amount: String,
  created_at: String, // Your DB stores as string, not Date
  currency: String,
  date: String,
  group_id: {
    type: String,
    index: true
  },
  line_items: [{
    product: String,
    price: String,
    quantity: Number,
    specialInstructions: String
  }],
  payment_method: String,
  status: {
    type: String,
    default: 'started'
  },
  stripe_payment_intent: String
}, {
  timestamps: false,
  collection: 'orders'
});

orderSchema.index({ group_id: 1, created_at: -1 });

module.exports = mongoose.model('Order', orderSchema);