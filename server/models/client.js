const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
  email: { 
    type: String, 
    required: true,
    lowercase: true
  },
  companyName: { 
    type: String, 
    required: true,
    trim: true
  },

  // add client name
  gstNumber: { 
    type: String, 
    required: true,
    uppercase: true
  },
  phone: { 
    type: String, 
    required: true,
    trim: true
  },
  user: { // Ensure this field exists and is tied to a user
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Replace 'User' with your actual User model name if different
    required: true
  },
  quotations: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quotation'
  }]
}, { timestamps: true });

// Compound unique indexes for per-user uniqueness
clientSchema.index({ email: 1, user: 1 }, { unique: true });
clientSchema.index({ gstNumber: 1, user: 1 }, { unique: true });

clientSchema.index({
  companyName: 'text',
  gstNumber: 'text',
  email: 'text'
});

module.exports = mongoose.model('Client', clientSchema);