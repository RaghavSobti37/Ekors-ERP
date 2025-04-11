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
  unit: {
    type: String,
    required: true,
    enum: ['Nos', 'Mtr', 'PKT', 'Pair', 'Set', 'Bottle', 'KG'],
    default: 'Nos'
  },
  // New fields for category structure
  category: {
    type: String,
    enum: ['Lightning Arrester', 'Earthing', 'Solar', 'Other'],
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
  // New field for image
  image: {
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
    // Calculate quantity only from purchase history if not manually set
    if (!this.isModified('quantity')) {
      this.quantity = this.purchaseHistory.reduce((total, purchase) => {
        return total + purchase.quantity;
      }, 0);
    }
    
    // Optional: Update price to the latest purchase price
    // Only if there's purchase history and price wasn't manually set
    if (this.purchaseHistory.length > 0 && !this.isModified('price')) {
      const latestPurchase = [...this.purchaseHistory].sort((a, b) => 
        new Date(b.date) - new Date(a.date)
      )[0];
      this.price = latestPurchase.price;
    }
  }
  next();
});

module.exports = mongoose.model('Item', itemSchema);