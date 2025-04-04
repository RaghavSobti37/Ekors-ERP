const mongoose = require('mongoose');

const goodsSchema = new mongoose.Schema({
  description: { type: String, required: true },
  hsnSacCode: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true, min: 0 },
  amount: { type: Number, required: true, min: 0 }
});

const quotationSchema = new mongoose.Schema({
  referenceNumber: { type: String, required: true, unique: true },
  date: { type: Date, required: true, default: Date.now },
  validityDate: { type: Date, required: true },
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  ewayBillNumber: String,
  transportId: String,
  vehicleDetails: String,
  materialLocation: { 
    type: String, 
    required: true,
    enum: ['factory', 'godown', 'other'],
    default: 'factory'
  },
  dispatchDays: { type: Number, required: true, min: 1 },
  packingCharges: { type: Number, required: true, min: 0 },
  orderIssuedBy: { type: String, required: true },
  goods: [goodsSchema],
  totalQuantity: { type: Number, required: true, min: 0 },
  totalAmount: { type: Number, required: true, min: 0 },
  gstAmount: { type: Number, required: true, min: 0 },
  grandTotal: { type: Number, required: true, min: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Quotation', quotationSchema);