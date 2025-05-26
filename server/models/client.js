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
    lowercase: true,
    index: true
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
  quotations: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quotation'
  }]
}, { timestamps: true });

// Compound index to ensure unique email per user
clientSchema.index({ email: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('Client', clientSchema);