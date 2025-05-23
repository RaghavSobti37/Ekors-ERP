const mongoose = require('mongoose');

const goodsSchema = new mongoose.Schema({
  srNo: { type: Number, required: true },
  description: { type: String, required: true },
  hsnSacCode: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true, min: 0 },
  amount: { type: Number, required: true }
});

const ticketSchema = new mongoose.Schema({
  ticketNumber: { type: String, unique: true, required: true },
  companyName: { type: String, required: true },
  quotationNumber: { type: String, required: true },
  billingAddress: {
    // Changed to array to match frontend implementation
    type: [String],
    validate: [arrayLimit, 'Billing address needs 5 fields']
  },
  shippingAddress: {
    // Changed to array to match frontend implementation
    type: [String], 
    validate: [arrayLimit, 'Shipping address needs 5 fields']
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
      "Completed"
    ],
    default: "Quotation Sent"
  },
  documents: {
    quotation: { type: String },
    po: { type: String },
    pi: { type: String },
    challan: { type: String },
    packingList: { type: String },
    feedback: { type: String }
  },
  statusHistory: [{
    status: { type: String },
    changedAt: { type: Date, default: Date.now },
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
   assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User' // No longer strictly required, will default to createdBy if not provided
  },
  transferHistory: [{
    from: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    to: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    transferredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    transferredAt: { type: Date, default: Date.now },
    note: String
  }],
  assignmentLog: [{
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assignedAt: { type: Date, default: Date.now },
    action: String // 'created', 'transferred', etc.
  }]
}, { timestamps: true });

// Validation function for address arrays
function arrayLimit(val) {
  return val.length === 5;  // Expecting [address1, address2, state, city, pincode]
}

// Add a pre-save hook to automatically populate the status history
ticketSchema.pre('save', function(next) {
  // Only add to history if status is modified on an existing document
  // and not during initial creation as the POST route handles the first entry.
  // Note: This entry will not have 'changedBy' as req.user is not available here.
  // For full 'changedBy' tracking, status updates should explicitly add to statusHistory in route handlers.
  if (!this.isNew && this.isModified('status')) {
    this.statusHistory.push({
      status: this.status,
      changedAt: new Date()
    });
  }
  next();
});

// Create a unique compound index to ensure one ticket per quotation
ticketSchema.index({ quotationNumber: 1 }, { unique: true });

module.exports = mongoose.model('Ticket', ticketSchema);