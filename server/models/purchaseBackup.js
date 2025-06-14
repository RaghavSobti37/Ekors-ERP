const mongoose = require('mongoose');

const purchaseItemSchema = new mongoose.Schema({
  itemId: { // This would be the originalId of the Item if it was linked
    type: mongoose.Schema.Types.ObjectId,
    // ref: 'Item', // Or 'ItemBackup' if you want to link to backed up items
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
  _id: true, // Keep _id for subdocuments if needed, or false if not
  timestamps: false
});

const purchaseBackupSchema = new mongoose.Schema({
  originalId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  companyName: {
    type: String,
    required: true,
    trim: true
  },
  gstNumber: {
    type: String,
    trim: true,
  },
  address: { type: String },
  stateName: { type: String },
  invoiceNumber: {
    type: String,
    required: true,
    trim: true
  },
  date: { type: Date, required: true },
  items: [purchaseItemSchema],
  totalAmount: { type: Number }, // Copied directly, pre-save hook for calculation omitted
  originalCreatedAt: { type: Date },
  originalUpdatedAt: { type: Date },
  deletedAt: { type: Date, default: Date.now, required: true },
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  backupReason: { type: String }
}, {
  timestamps: true // For the backup entry itself
});

purchaseBackupSchema.index({ deletedAt: -1 });

module.exports = mongoose.model('PurchaseBackup', purchaseBackupSchema);