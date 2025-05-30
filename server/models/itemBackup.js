const mongoose = require('mongoose');

const itemBackupSchema = new mongoose.Schema({
  originalId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  name: {
    type: String,
    required: true,
    trim: true,
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
  },
  category: {
    type: String,
  },
  subcategory: {
    type: String,
  },
  gstRate: {
    type: Number,
  },
  hsnCode: {
    type: String,
    trim: true,
  },
  discountAvailable: {
    type: Boolean,
  },
  maxDiscountPercentage: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  lastPurchaseDate: { type: Date },
  lastPurchasePrice: { type: Number },
  originalCreatedAt: { type: Date },
  originalUpdatedAt: { type: Date },
  deletedAt: { type: Date, default: Date.now, required: true },
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  backupReason: { type: String }
}, {
  timestamps: true // For the backup entry itself
});

itemBackupSchema.index({ deletedAt: -1 });

module.exports = mongoose.model('ItemBackup', itemBackupSchema);