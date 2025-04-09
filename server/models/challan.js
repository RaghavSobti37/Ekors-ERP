// models/challan.js
const mongoose = require('mongoose');

const challanSchema = new mongoose.Schema({
  companyName: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  totalBilling: {
    type: String,
    required: true,
  },
  billNumber: {
    type: String,
  },
  documentPath: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Challan', challanSchema);