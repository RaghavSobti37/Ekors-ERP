const mongoose = require("mongoose");

const challanSchema = new mongoose.Schema({
  companyName: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String, required: true },
  totalBilling: { type: String, required: true },
  billNumber: { type: String },
  document: {
    data: Buffer,
    contentType: String,
    originalName: String,
  },
  // Add user tracking fields
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  updatedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
}, { timestamps: true });

module.exports = mongoose.model("Challan", challanSchema);