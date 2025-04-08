// models/itemlist.js
const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  quantity: { type: Number, default: 0 },
  price: { type: Number, default: 0 },
  gstRate: { type: Number, default: 18 }, // Default to 18%
  hsnCode: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  lastEditedBy: { type: String, default: 'system' },
  editHistory: [{
    field: String,
    oldValue: mongoose.Schema.Types.Mixed,
    newValue: mongoose.Schema.Types.Mixed,
    changedBy: String,
    changedAt: { type: Date, default: Date.now }
  }]
});

module.exports = mongoose.model('Item', itemSchema);