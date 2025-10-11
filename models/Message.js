const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  session_id: {
    type: String,
    ref: 'ChatSession',
    required: true,
    index: true
  },
  content: {
    type: String,
    required: true
  },
  sender: {
    type: String,
    required: true
  },
  message_type: {
    type: String,
    default: 'text'
  },
  metadata: mongoose.Schema.Types.Mixed,
  created_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: false,
  collection: 'messages'
});

messageSchema.index({ session_id: 1, created_at: 1 });

module.exports = mongoose.model('Message', messageSchema);