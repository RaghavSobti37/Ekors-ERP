const mongoose = require('mongoose');

const goodsSchema = new mongoose.Schema({
  srNo: { type: Number, required: true },
  description: { type: String, required: true },
  hsnSacCode: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true, min: 0 },
  amount: { type: Number, required: true }
}, { _id: false });

const documentSubSchema = new mongoose.Schema({
  path: { type: String, required: true },
  originalName: { type: String, required: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  uploadedAt: { type: Date } // Should capture the original upload date
});

const ticketBackupSchema = new mongoose.Schema({
  originalId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  ticketNumber: { type: String, required: true }, // Not unique in backup, originalId is key
  companyName: { type: String, required: true },
  quotationNumber: { type: String, required: true },
  billingAddress: {
    type: [String], // Matches original schema
  },
  shippingAddress: {
    type: [String], // Matches original schema
  },
  goods: [goodsSchema],
  totalQuantity: { type: Number, required: true },
  totalAmount: { type: Number, required: true },
  gstAmount: { type: Number, required: true },
  grandTotal: { type: Number, required: true },
  status: {
    type: String,
    required: true,
    enum: [
      "Quotation Sent",
      "PO Received",
      "Payment Pending",
      "Inspection",
      "Packing List",
      "Invoice Sent",
      "Hold",
      "Closed"
    ],
  },
  documents: {
    quotation: documentSubSchema,
    po: documentSubSchema,
    pi: documentSubSchema,
    challan: documentSubSchema,
    packingList: documentSubSchema,
    feedback: documentSubSchema,
    other: [documentSubSchema]
  },
  statusHistory: [{
    status: { type: String },
    changedAt: { type: Date },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  currentAssignee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignedTo: { // This field seems to be for a pending assignment or historical, ensure it's copied correctly
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  transferHistory: [{
    from: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    to: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    transferredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    transferredAt: { type: Date },
    note: String
  }],
  assignmentLog: [{
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assignedAt: { type: Date },
    action: String
  }],
  // Timestamps from original document
  originalCreatedAt: { type: Date },
  originalUpdatedAt: { type: Date },
  // Backup specific fields
  deletedAt: { type: Date, default: Date.now, required: true },
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  backupReason: { type: String }
}, {
  timestamps: true // Adds createdAt (backup creation time) and updatedAt for the backup entry
});

ticketBackupSchema.index({ deletedAt: -1 });
ticketBackupSchema.index({ quotationNumber: 1 }); // Keep if useful for searching backups

module.exports = mongoose.model('TicketBackup', ticketBackupSchema);