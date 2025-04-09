const mongoose = require('mongoose');

// Define a purchase entry schema
const purchaseEntrySchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  supplier: {
    type: String,
    required: true,
    trim: true
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
  stateCode: {
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
  totalAmount: {
    type: Number,
    default: function() {
      return this.price * this.quantity;
    }
  },
  gstAmount: {
    type: Number,
    default: function() {
      return this.totalAmount * (this.gstRate / 100);
    }
  },
  description: {
    type: String,
    default: ''
  },
  notes: {
    type: String,
    default: ''
  },
  paymentStatus: {
    type: String,
    enum: ['Paid', 'Pending', 'Partial'],
    default: 'Pending'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
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
  updatedAt: {
    type: Date,
    default: Date.now
  },
  editHistory: [{
    field: String,
    oldValue: mongoose.Schema.Types.Mixed,
    newValue: mongoose.Schema.Types.Mixed,
    changedBy: String,
    changedAt: {
      type: Date,
      default: Date.now
    }
  }],
  purchaseHistory: [purchaseEntrySchema]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Pre-save hook to update quantity based on purchases
itemSchema.pre('save', function(next) {
  // If this is a new item and it has purchase history
  if (this.isNew && this.purchaseHistory && this.purchaseHistory.length > 0) {
    this.quantity = this.purchaseHistory.reduce((total, purchase) => total + purchase.quantity, 0);
  }
  next();
});

module.exports = mongoose.model('Item', itemSchema);