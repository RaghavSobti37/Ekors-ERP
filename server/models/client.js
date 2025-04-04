const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  companyName: { type: String, required: true },
  gstNumber: { type: String, required: true },
  phone: { type: String, required: true },
  billingAddress: { type: String, required: true },
  shippingAddress: { type: String, required: true },
  bankDetails: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Client', clientSchema);