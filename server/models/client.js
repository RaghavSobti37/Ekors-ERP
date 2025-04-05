const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
  email: { 
    type: String, 
    required: true, 
    unique: true,
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
  billingAddress: { 
    type: String, 
    required: true,
    trim: true
  },
  shippingAddress: { 
    type: String, 
    required: true,
    trim: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Client', clientSchema);