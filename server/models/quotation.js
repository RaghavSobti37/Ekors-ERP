const mongoose = require('mongoose');

const goodsItemSchema = new mongoose.Schema({
  srNo: { type: Number, required: true },
  description: { type: String, required: true },
  hsnSacCode: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true, min: 0 },
  amount: { type: Number, required: true, min: 0 },
}, { _id: false });

const quotationSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  referenceNumber: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true,
    index: true
  },
  validityDate: { type: Date, required: true },
  ewayBillNumber: { type: String, trim: true },
  transportId: { type: String, trim: true },
  vehicleDetails: { type: String, trim: true },
  materialLocation: { 
    type: String, 
    enum: ['factory', 'godown', 'other'], 
    default: 'factory' 
  },
  dispatchDays: { type: Number, required: true, min: 1 },
  packingCharges: { type: Number, default: 0, min: 0 },
  orderIssuedBy: { type: String, trim: true },
  bankDetails: { type: String, trim: true },
  goods: [goodsItemSchema],
  totalQuantity: { type: Number, required: true, min: 0 },
  totalAmount: { type: Number, required: true, min: 0 },
  gstAmount: { type: Number, required: true, min: 0 },
  grandTotal: { type: Number, required: true, min: 0 },
  client: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Client',
    required: true
  },
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index for better query performance
quotationSchema.index({ referenceNumber: 1, client: 1 });

module.exports = mongoose.model('Quotation', quotationSchema);