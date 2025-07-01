// server/models/opentickets.js
const mongoose = require('mongoose');
const { STANDARD_UNITS } = require('./itemlist'); // Import standardized units

const goodsSchema = new mongoose.Schema({ // _id: false for embedded documents
  srNo: { type: Number, required: true },
  description: { type: String, required: true },
  subtexts: { type: [String], default: [] },
  hsnCode: { type: String, required: true }, // Renamed from hsnSacCode for consistency
  unit: { 
    type: String, 
    required: true, 
    default: 'nos', 
    enum: STANDARD_UNITS // Use standardized units
  },
  quantity: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true, min: 0 },
  amount: { type: Number, required: true },
  originalPrice: { type: Number },
  maxDiscountPercentage: { type: Number, default: 0 },
  gstRate: { type: Number, required: true, min: 0, default: 0 },
  originalItem: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' } // Add reference to Item
}, { _id: false });

const documentSubSchema = new mongoose.Schema({ // _id: false for embedded documents
  path: { type: String, required: true },
  originalName: { type: String, required: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  uploadedAt: { type: Date, default: Date.now }
}, { _id: false });

const ticketSchema = new mongoose.Schema({
  ticketNumber: { type: String, unique: true, required: true },
  companyName: { type: String, required: true }, // Redundant if client is always populated, but useful for quick access
  quotationNumber: { type: String, required: true },
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
  clientPhone: { type: String },
  clientGstNumber: { type: String },

  billingAddress: {
    // Change to object for consistency
    address1: { type: String, default: '' },
    address2: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    pincode: { type: String, default: '' }
  },
  shippingAddress: {
    address1: { type: String, default: '' },
    address2: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    pincode: { type: String, default: '' }
  },
  shippingSameAsBilling: { type: Boolean, default: false },
  goods: [goodsSchema],
  totalQuantity: { type: Number, required: true },
  totalAmount: { type: Number, required: true },
  gstBreakdown: [{
    itemGstRate: Number, taxableAmount: Number,
    cgstRate: Number, cgstAmount: Number,
    sgstRate: Number, sgstAmount: Number,
    igstRate: Number, igstAmount: Number,
  }],
  totalCgstAmount: { type: Number, default: 0 },
  totalSgstAmount: { type: Number, default: 0 },
  totalIgstAmount: { type: Number, default: 0 },
  finalGstAmount: { type: Number, required: true, default: 0 },
  grandTotal: { type: Number, required: true, default: 0 },
  roundOff: { type: Number, default: 0 },
  finalRoundedAmount: { type: Number },
  isBillingStateSameAsCompany: { type: Boolean, default: false },

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
    default: "Quotation Sent"
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
    changedAt: { type: Date, default: Date.now },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    note: { type: String }
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
  deadline: {
    type: Date,
    required: true
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
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
    action: String
  }],
  dispatchDays: { type: String, default: "7-10 working days" }
}, { timestamps: true });

// Pre-save hook to set finalRoundedAmount if not explicitly provided by client
ticketSchema.pre('save', function(next) {
  if (this.isNew || this.isModified('grandTotal') || this.isModified('roundOff')) {
    if (this.finalRoundedAmount === undefined || this.finalRoundedAmount === null) {
      this.finalRoundedAmount = (this.grandTotal || 0) + (this.roundOff || 0);
    }
  }
  next();
});

// Create a unique compound index to ensure one ticket per quotation
ticketSchema.index({ quotationNumber: 1 }, { unique: true });

module.exports = mongoose.model('Ticket', ticketSchema);
