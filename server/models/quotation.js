const mongoose = require("mongoose");

const goodsItemSchema = new mongoose.Schema(
  {
    srNo: { type: Number, required: true },
    description: { type: String, required: true },
    hsnSacCode: { type: String, default: '' },
    quantity: { type: Number, required: true, min: 1 },
    unit: { 
      type: String, 
      required: true, 
      default: 'Nos',
      enum: ['Nos', 'Mtr', 'PKT', 'Pair', 'Set', 'Bottle', 'KG']
    },
    price: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const quotationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    orderIssuedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    date: { type: Date, required: true },
    referenceNumber: {
      type: String,
      required: true,
      trim: true,
    },
    validityDate: { type: Date, required: true },
    goods: [goodsItemSchema],
    totalQuantity: { type: Number, required: true, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    gstAmount: { type: Number, required: true, min: 0 },
    grandTotal: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['open', 'closed', 'hold'],
      default: 'open'
    },
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound index for unique reference numbers per user
quotationSchema.index({ user: 1, referenceNumber: 1 }, { unique: true });

// Index for better query performance
quotationSchema.index({ date: -1 });
quotationSchema.index({ status: 1 });

module.exports = mongoose.model("Quotation", quotationSchema);