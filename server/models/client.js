const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  email: { 
    type: String, 
    required: true, 
    trim: true,
    lowercase: true
  },
  companyName: { 
    type: String, 
    required: true,
    trim: true
  },
  gstNumber: { 
    type: String, 
    required: true,
    trim: true
  },
  phone: { 
    type: String, 
    required: true,
    trim: true
  },
}, { timestamps: true });

// Create a compound index for user+email uniqueness
clientSchema.index({ user: 1, email: 1 }, { unique: true });

module.exports = mongoose.model('Client', clientSchema);