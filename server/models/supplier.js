const mongoose = require('mongoose');

const supplierSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  contactPerson: String,
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    required: true
  },
  gstNumber: {
    type: String,
    required: true,
    unique: true
  },
  address: {
    type: String,
    required: true
  },
  stateName: {
    type: String,
    required: true
  },
  stateCode: {
    type: String,
    required: true
  },
  paymentTerms: String,
  bankDetails: {
    accountName: String,
    accountNumber: String,
    bankName: String,
    branch: String,
    IFSC: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  notes: String
}, {
  timestamps: true
});

module.exports = mongoose.model('Supplier', supplierSchema);