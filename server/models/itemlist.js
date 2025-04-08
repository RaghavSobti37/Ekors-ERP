const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    trim: true,
    unique: true,
    index: true
  },
  description: { type: String, default: '' },
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
  costPrice: { 
    type: Number, 
    default: 0,
    min: 0
  },
  gstRate: { 
    type: Number, 
    default: 18,
    min: 0,
    max: 28
  },
  hsnCode: { 
    type: String, 
    required: true,
    trim: true
  },
  category: { type: String, default: 'General' },
  unit: { type: String, default: 'pcs' },
  minStockLevel: { type: Number, default: 5 },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  lastEditedBy: { 
    type: String, 
    default: 'system',
    trim: true
  },
  editHistory: [{
    field: String,
    oldValue: mongoose.Schema.Types.Mixed,
    newValue: mongoose.Schema.Types.Mixed,
    changedBy: String,
    changedAt: { type: Date, default: Date.now },
    reason: String
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Add text index for search functionality
itemSchema.index({ name: 'text', hsnCode: 'text', description: 'text' });

module.exports = mongoose.model('Item', itemSchema);