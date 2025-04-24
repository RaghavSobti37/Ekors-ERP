const mongoose = require('mongoose');

const purchaseItemSchema = new mongoose.Schema({
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item',
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
    default: 0,
    min: 0,
    max: 100
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
    default: '',
    validate: {
      validator: function(v) {
        // Basic GST validation - can be enhanced
        return v === '' || /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9A-Z]{1}[Z]{1}[0-9A-Z]{1}$/.test(v);
      },
      message: props => `${props.value} is not a valid GST number!`
    }
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
    required: true,
    trim: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  items: [purchaseItemSchema],
  totalAmount: {
    type: Number,
    default: 0
  }
}, { 
  timestamps: true 
});

// Instead of embedding purchase history, reference purchase documents
const itemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  quantity: {
    type: Number,
    default: 0,
    min: 0
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  unit: {
    type: String,
    required: true,
    enum: ['Nos', 'Mtr', 'PKT', 'Pair', 'Set', 'Bottle', 'KG'],
    default: 'Nos'
  },
  category: {
    type: String,
    default: 'Other',
    index: true
  },
  subcategory: {
    type: String,
    default: 'General',
    index: true
  },
  gstRate: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  hsnCode: {
    type: String,
    trim: true,
    default: '',
    index: true
  },
  discountAvailable: {
    type: Boolean,
    default: false
  },
  dynamicPricing: {
    type: Boolean,
    default: false
  },
  // Reference to purchases instead of embedding them
  lastPurchaseDate: {
    type: Date,
    default: null
  },
  lastPurchasePrice: {
    type: Number,
    default: null
  }
}, {
  timestamps: true
});

// Add a pre-save hook to calculate total amount
purchaseSchema.pre('save', function(next) {
  if (this.items && this.items.length > 0) {
    this.totalAmount = this.items.reduce((sum, item) => {
      const itemTotal = item.price * item.quantity;
      const gstAmount = itemTotal * (item.gstRate / 100);
      return sum + itemTotal + gstAmount;
    }, 0);
  }
  next();
});

// Create a compound index for better performance on common queries
itemSchema.index({ category: 1, subcategory: 1 });
purchaseSchema.index({ date: -1 });
purchaseSchema.index({ companyName: 1 });
purchaseSchema.index({ 'items.itemId': 1 });

const Item = mongoose.model('Item', itemSchema);
const Purchase = mongoose.model('Purchase', purchaseSchema);

module.exports = { Item, Purchase };

