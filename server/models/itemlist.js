const mongoose = require('mongoose');
const { STANDARD_UNITS } = require("../utils/payloads");

// 1. Standard Unit Definitions
// const STANDARD_UNITS = [
//   'nos', 'pkt', 'pcs', 'kgs', 'mtr', 'sets', 'kwp', 'ltr', 'bottle', 'each', 'bag', 'set'
// ];

// 2. Unit Sub-schema
const unitSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    enum: STANDARD_UNITS,
    trim: true
  },
  isBaseUnit: {
    type: Boolean,
    default: false
  },
  conversionFactor: {
    type: Number,
    required: true,
    min: 0.0001,
    validate: {
      validator: function(v) {
        return this.isBaseUnit ? v === 1 : true;
      },
      message: 'Base unit must have conversion factor of 1'
    }
  }
}, { _id: false });

// 3. Item Schema
const itemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    index: true,
    maxlength: 100
  },
  baseUnit: {
    type: String,
    enum: STANDARD_UNITS,
    required: true
  },
  units: {
    type: [unitSchema],
    validate: {
      validator: function(units) {
        // Allow if at least one base unit exists
        return units.some(u => u.isBaseUnit);
      },
      message: 'At least one base unit must be specified'
    }
  },
  // Pricing
  sellingPrice: {
    type: Number,
    required: true,
    min: 0
  },
  buyingPrice: {
    type: Number,
    default: 0,
    min: 0
  },
  profitMarginPercentage: {
    type: Number,
    default: 20,
    min: 0
  },
  
  // Inventory
  quantity: {
    type: Number,
    default: 0
  },
  
  // Taxonomy
  category: {
    type: String,
    default: 'Other',
    index: true
  },
  hsnCode: {
    type: String,
    trim: true,
    default: '',
    index: true
  },
  gstRate: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  
  // Metadata
  image: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['pending_review', 'approved'],
    default: 'approved',
    index: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  reviewedAt: {
    type: Date,
    default: null
  },
  lastPurchaseDate: {
    type: Date,
    default: null
  },
  lastPurchasePrice: {
    type: Number,
    default: null
  },
  
  // Audit logs
  inventoryLog: [{
    type: { type: String, required: true },
    date: { type: Date, default: Date.now },
    quantityChange: { type: Number, required: true },
    details: { type: String },
    userReference: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    ticketReference: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket' } // <-- Add this if not present
  }],
  excelImportHistory: [{
    action: { type: String, enum: ['created', 'updated'], required: true },
    importedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    importedAt: { type: Date, default: Date.now },
    fileName: { type: String },
    changes: [{
      field: String,
      oldValue: mongoose.Schema.Types.Mixed,
      newValue: mongoose.Schema.Types.Mixed
    }]
  }]
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// 4. Purchase Sub-schema
const purchaseItemSchema = new mongoose.Schema({
  unit: {
    type: String,
    enum: STANDARD_UNITS,
    required: true
  },
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item',
    required: true
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
  pricePerBaseUnit: {
    type: Number,
    required: true
  },
  sellingPriceAtPurchase: {
    type: Number,
    default: 0,
    min: 0
  },
  gstRate: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  }
}, { _id: true });

// 5. Purchase Schema
const purchaseSchema = new mongoose.Schema({
  companyName: {
    type: String,
    required: true,
    trim: true
  },
  gstNumber: {
    type: String,
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
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

// 6. Auto-sync baseUnit with units array
itemSchema.pre('save', function(next) {
  const baseUnitObj = this.units.find(u => u.isBaseUnit);
  
  if (baseUnitObj) {
    // Sync baseUnit field with the marked base unit
    this.baseUnit = baseUnitObj.name;
    
    // Ensure base unit has conversionFactor = 1
    baseUnitObj.conversionFactor = 1;
  } else if (this.isNew) {
    // Default to first unit if no base unit specified
    this.units[0].isBaseUnit = true;
    this.baseUnit = this.units[0].name;
    this.units[0].conversionFactor = 1;
  }
  
  next();
});

// 7. Purchase total calculation
purchaseSchema.pre('save', function(next) {
  if (this.isModified('items')) {
    this.totalAmount = this.items.reduce((total, item) => {
      const itemTotal = item.price * item.quantity;
      const gstAmount = itemTotal * (item.gstRate / 100);
      return total + itemTotal + gstAmount;
    }, 0);
  }
  next();
});

// 8. Indexes
itemSchema.index({ category: 1, baseUnit: 1 });
itemSchema.index({ name: 'text', hsnCode: 'text' });
purchaseSchema.index({ date: -1 });
purchaseSchema.index({ companyName: 1 });
purchaseSchema.index({ 'items.itemId': 1 });

// 10. Add this static method to itemSchema for fetching unique categories
itemSchema.statics.getAllCategories = async function () {
  // Only return unique, non-empty categories
  const categories = await this.distinct("category", { category: { $ne: "" } });
  // Remove null/undefined and sort alphabetically
  return categories.filter(Boolean).sort();
};

// 9. Models
const Item = mongoose.model('Item', itemSchema);
const Purchase = mongoose.model('Purchase', purchaseSchema);

// 11. Export STANDARD_UNITS for use in other schemas
module.exports = { Item, Purchase, STANDARD_UNITS };