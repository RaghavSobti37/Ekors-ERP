const mongoose = require('mongoose');

// Schema for purchase items (used in Purchase schema)
const purchaseItemSchema = new mongoose.Schema({
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item'
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 0.01
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  gstRate: {
    type: Number,
    default: 0
  }
}, { 
  _id: true,
  timestamps: false
});

// Purchase schema for bulk purchases
const purchaseSchema = new mongoose.Schema({
  companyName: {
    type: String,
    required: true,
    trim: true
  },
  gstNumber: {
    type: String,
    trim: true,
    default: ''
  },
  address: {
    type: String,
    default: ''
  },
  stateName: {
    type: String,
    default: ''
  },
  invoiceNumber: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  items: [purchaseItemSchema]
}, { 
  timestamps: true 
});

// Define a purchase entry schema for item history
const purchaseEntrySchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  companyName: {
    type: String,
    required: true,
    trim: true
  },
  gstNumber: {
    type: String,
    trim: true,
    default: ''
  },
  address: {
    type: String,
    default: ''
  },
  stateName: {
    type: String,
    default: ''
  },
  invoiceNumber: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 0.01
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  gstRate: {
    type: Number,
    default: 0
  },
}, { 
  timestamps: false,
  _id: true
});

// Define main item schema
const itemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  quantity: {
    type: Number,
    default: 0
  },
  price: {
    type: Number,
    required: true
  },
  unit: {
    type: String,
    required: true,
    enum: ['Nos', 'Mtr', 'PKT', 'Pair', 'Set', 'Bottle', 'KG'],
    default: 'Nos'
  },
  category: {
    type: String,
    default: 'Other'
  },
  subcategory: {
    type: String,
    default: 'General'
  },
  gstRate: {
    type: Number,
    default: 0
  },
  hsnCode: {
    type: String,
    trim: true,
    default: ''
  },
  discountAvailable: {
    type: Boolean,
    default: false
  },
  dynamicPricing: {
    type: Boolean,
    default: false
  },
  purchaseHistory: [purchaseEntrySchema]
}, {
  timestamps: true
});

// Indexes for faster queries
itemSchema.index({ name: 1 });
itemSchema.index({ category: 1, subcategory: 1 });
itemSchema.index({ hsnCode: 1 });

purchaseSchema.index({ date: -1 });
purchaseSchema.index({ companyName: 1 });
purchaseSchema.index({ 'items.itemId': 1 });

const Item = mongoose.model('Item', itemSchema);
const Purchase = mongoose.model('Purchase', purchaseSchema);

module.exports = { Item, Purchase };