const mongoose = require("mongoose");

const goodsItemSchema = new mongoose.Schema(
  {
    srNo: { type: Number, required: true },
    description: { type: String, required: true },
    hsnSacCode: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const quotationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: Date, required: true },
    referenceNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    validityDate: { type: Date, required: true },
    dispatchDays: { type: Number, required: true, min: 1 },
    orderIssuedBy: { type: String, trim: true },
    goods: [goodsItemSchema],
    totalQuantity: { type: Number, required: true, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    gstAmount: { type: Number, required: true, min: 0 },
    grandTotal: { type: Number, required: true, min: 0 },
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

quotationSchema.index({ user: 1, referenceNumber: 1 });
// quotationSchema.index({ user: 1, client: 1 });

module.exports = mongoose.model("Quotation", quotationSchema);