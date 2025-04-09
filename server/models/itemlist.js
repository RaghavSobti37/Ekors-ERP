const mongoose = require('mongoose');

// Define a purchase entry schema
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
    min: 1
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
  description: {
    type: String,
    default: ''
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Add virtuals for calculated fields
purchaseEntrySchema.virtual('totalAmount').get(function() {
  return this.price * this.quantity;
});

purchaseEntrySchema.virtual('gstAmount').get(function() {
  return (this.price * this.quantity) * (this.gstRate / 100);
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
  gstRate: {
    type: Number,
    default: 0
  },
  hsnCode: {
    type: String,
    trim: true,
    default: ''
  },
  description: {
    type: String,
    default: ''
  },
  // Add image field to store image URL
  imageUrl: {
    type: String,
    default: ''
  },
  purchaseHistory: [purchaseEntrySchema]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Update quantity based on purchase history
itemSchema.pre('save', function(next) {
  if (this.isModified('purchaseHistory')) {
    this.quantity = this.purchaseHistory.reduce((total, purchase) => {
      return total + purchase.quantity;
    }, 0);
    
    // If we have purchase history, update the price to the latest purchase price
    if (this.purchaseHistory.length > 0) {
      const latestPurchase = [...this.purchaseHistory].sort((a, b) => 
        new Date(b.date) - new Date(a.date)
      )[0];
      this.price = latestPurchase.price;
    }
  }
  next();
});

module.exports = mongoose.model('Item', itemSchema);