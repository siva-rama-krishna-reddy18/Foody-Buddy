const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  session_id: {
    type: String,
    ref: 'ChatSession',
    required: true
  },
  customer_id: {
    type: String,
    ref: 'Customer',
    required: true,
    index: true
  },
  status: {
    type: String,
    default: 'OPEN'
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
  timestamps: false,
  collection: 'carts'
});

cartSchema.index({ session_id: 1 });

module.exports = mongoose.model('Cart', cartSchema);