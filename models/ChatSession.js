const mongoose = require('mongoose');

const chatSessionSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  customer_id: {
    type: String,
    ref: 'Customer',
    required: true,
    index: true
  },
  title: String,
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
  collection: 'chat_sessions'
});

chatSessionSchema.index({ customer_id: 1, updated_at: -1 });

module.exports = mongoose.model('ChatSession', chatSessionSchema);