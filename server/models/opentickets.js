const mongoose = require('mongoose');

const goodsSchema = new mongoose.Schema({
  srNo: { type: Number, required: true },
  description: { type: String, required: true },
    subtexts: { type: [String], default: [] }, 
  hsnSacCode: { type: String, required: true },
    unit: { type: String, default: "Nos" }, // Added unit
  quantity: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true, min: 0 },
  amount: { type: Number, required: true },
  originalPrice: { type: Number }, // For discount tracking
  maxDiscountPercentage: { type: Number, default: 0 },
  gstRate: { type: Number, required: true, min: 0, default: 0 } 
}, { _id: false });

const documentSubSchema = new mongoose.Schema({
  path: { type: String, required: true },
  originalName: { type: String, required: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  uploadedAt: { type: Date, default: Date.now }
  }, { _id: false }); // Ensure _id is false for subdocuments unless explicitly needed

const ticketSchema = new mongoose.Schema({
  ticketNumber: { type: String, unique: true, required: true },
  companyName: { type: String, required: true },
  quotationNumber: { type: String, required: true },
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' }, // If you have a Client model
  clientPhone: { type: String },
  clientGstNumber: { type: String },

  billingAddress: {
    // Changed to array to match frontend implementation
    type: [String],
    validate: [val => val.length === 5, 'Billing address needs 5 fields: [address1, address2, state, city, pincode]']
  },
  shippingAddress: {
    // Changed to array to match frontend implementation
    type: [String], 
 validate: [val => val.length === 5, 'Shipping address needs 5 fields: [address1, address2, state, city, pincode]']
  },
  shippingSameAsBilling: { type: Boolean, default: false }, // New field
  goods: [goodsSchema],
  totalQuantity: { type: Number, required: true },
 totalAmount: { type: Number, required: true }, // Pre-GST total
  // Detailed GST fields
  gstBreakdown: [{
    itemGstRate: Number, taxableAmount: Number,
    cgstRate: Number, cgstAmount: Number,
    sgstRate: Number, sgstAmount: Number,
    igstRate: Number, igstAmount: Number,
  }],
  totalCgstAmount: { type: Number, default: 0 },
  totalSgstAmount: { type: Number, default: 0 },
  totalIgstAmount: { type: Number, default: 0 },
  finalGstAmount: { type: Number, required: true, default: 0 }, // Total GST
  grandTotal: { type: Number, required: true, default: 0 }, // Total Amount + Total GST
   roundOff: { type: Number, default: 0 }, // To store the round off amount
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
      "Hold", // Added Hold
      "Closed"  // Changed from Completed
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
    other: [documentSubSchema] // For multiple other documents
  },
  statusHistory: [{
    status: { type: String },
    changedAt: { type: Date, default: Date.now },
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    note: { type: String } // Add the note field here
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
    required: true // Or true, depending on your requirements
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
  }],
dispatchDays: { type: String, default: "7-10 working days" } // Add this line

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