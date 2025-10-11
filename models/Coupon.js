const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  name: String,
  type: String,
  value: Number,
  date: Date,
  groupId: String
}, {
  timestamps: false,
  collection: 'coupons'
});

module.exports = mongoose.model('Coupon', couponSchema);