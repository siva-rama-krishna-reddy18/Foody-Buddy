const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  // Remove custom 'id' field, use MongoDB's _id
  name: {
    type: String,
    required: true,
    index: true
  },
  description: String,
  price: String, // Keep as string to match existing data
  category: String,
  image: String,
  imageUrl: String,
  available: {
    type: Boolean,
    default: true
  },
  tags: [String],
  ingredients: [String],
  preparationTime: Number,
  embedding: [Number]
}, {
  timestamps: true,
  collection: 'products'
});

// Add virtual 'id' field that maps to _id as string
productSchema.virtual('id').get(function() {
  return this._id.toString();
});

// Ensure virtuals are included in JSON
productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

productSchema.index({ name: 'text', description: 'text', tags: 'text' });

module.exports = mongoose.model('Product', productSchema);