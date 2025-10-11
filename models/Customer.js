const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  name: String,
  email: String,
  phone: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  group_id: {
    type: String,
    unique: true,
    index: true
  },
  preferences: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  orderHistory: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  }]
}, {
  timestamps: true,
  collection: 'customers'
});

module.exports = mongoose.model('Customer', customerSchema);