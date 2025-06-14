const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
  email: { 
    type: String, 
    required: true,
    lowercase: true
  },
  clientName: { // Name of the contact person at the client company
    type: String,
    trim: true
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
  user: { 
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  quotations: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quotation'
  }]
}, { timestamps: true });

clientSchema.index({
  companyName: 'text',
  clientName: 'text',
  gstNumber: 'text',
  email: 'text'
});

clientSchema.index({ user: 1, email: 1 }, { unique: true });
module.exports = mongoose.model('Client', clientSchema);