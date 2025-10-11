const mongoose = require('mongoose');

const customerPreferencesSchema = new mongoose.Schema({
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
  key: {
    type: String,
    required: true
  },
  weight: {
    type: Number,
    default: 0
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: false,
  collection: 'customer_preferences'
});

customerPreferencesSchema.index({ customer_id: 1, key: 1 }, { unique: true });

module.exports = mongoose.model('CustomerPreferences', customerPreferencesSchema);