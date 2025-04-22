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
  ticketNumber: { type: String, unique: true },
  companyName: { type: String, required: true },
  quotationNumber: { type: String, required: true },
  billingAddress: { type: String, required: true },
  shippingAddress: { type: String, required: true },
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
    changedAt: { type: Date, default: Date.now }
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { timestamps: true });

// Pre-save hook to generate ticket number
ticketSchema.pre('save', async function(next) {
  if (!this.ticketNumber) {
    const count = await this.constructor.countDocuments();
    this.ticketNumber = `T-${(count + 1).toString().padStart(6, '0')}`;
  }
  next();
});

ticketSchema.index({ quotationNumber: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('Ticket', ticketSchema);