const mongoose = require("mongoose");
const { STANDARD_UNITS } = require("./itemlist");

const goodsItemSchema = new mongoose.Schema(
  {
    srNo: { type: Number, required: true },
    description: { type: String, required: true },
    subtexts: { type: [String], default: [] },
    hsnCode: { type: String, default: '' }, 
    quantity: { type: Number, required: true, min: 1 },
    unit: { 
      type: String, 
      required: true, 
      default: 'nos',
      enum: STANDARD_UNITS 
    },
    price: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 },
    gstRate: { type: Number, default: 0 },
    originalPrice: { type: Number },
    maxDiscountPercentage: { type: Number, default: 0 },
    originalItem: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' } 
  },
  { _id: false }
);

const documentSubSchema = new mongoose.Schema({
  path: { type: String, required: true },
  originalName: { type: String, required: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  uploadedAt: { type: Date, default: Date.now }
}, { _id: false });

// Define address sub-schema
const addressSchema = new mongoose.Schema({
  address1: { type: String, default: '' },
  address2: { type: String, default: '' },
  city: { type: String, default: '' },
  state: { type: String, default: '' },
  pincode: { type: String, default: '' },
}, { _id: false });

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
    // Add billingAddress to Quotation
    billingAddress: addressSchema,
    // Add shippingAddress to Quotation
    shippingAddress: addressSchema,
    // Add flag for same shipping and billing address
    shippingSameAsBilling: { type: Boolean, default: false },
    goods: [goodsItemSchema],
    totalQuantity: { type: Number, required: true, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    gstAmount: { type: Number, required: true, min: 0 },
    grandTotal: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['open', 'closed', 'hold', 'running'], // Added 'running'
      default: 'open'
    },
    linkedTickets: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Ticket' }], // Added field for linked tickets
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: true,
    },
    documents: { // Added documents field for quotations
      quotationPdf: documentSubSchema, // For the generated PDF of this quotation
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