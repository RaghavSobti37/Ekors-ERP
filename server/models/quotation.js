<<<<<<< HEAD
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const goodSchema = new Schema({
    itemId: { type: Schema.Types.ObjectId, ref: 'Item' },
    name: { type: String, required: true },
    hsnCode: String,
    quantity: { type: Number, required: true },
    unit: { type: String, required: true },
    price: { type: Number, required: true },
    amount: { type: Number, required: true },
    gstRate: { type: Number, default: 0 },
    maxDiscountPercentage: { type: Number, default: 0 },
    subtexts: [String],
    originalItem: { type: Schema.Types.Mixed }
=======
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
>>>>>>> 871eea39ee2777f57e4fdae8e5265e13500dde3a
}, { _id: false });

const addressSchema = new Schema({
    address1: String,
    address2: String,
    city: String,
    state: String,
    pincode: String,
}, { _id: false });

const quotationSchema = new Schema({
    // --- Core Fields (for lightweight list views) ---
    referenceNumber: { type: String, unique: true, required: true },
    client: { type: Schema.Types.ObjectId, ref: 'Client', required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true }, // The user who created it
    date: { type: Date, default: Date.now, required: true },
    validityDate: { type: Date, required: true },
<<<<<<< HEAD
=======
    // Add billingAddress to Quotation
    billingAddress: addressSchema,
    goods: [goodsItemSchema],
    totalQuantity: { type: Number, required: true, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    gstAmount: { type: Number, required: true, min: 0 },
    grandTotal: { type: Number, required: true, min: 0 },
    roundOffTotal: { type: Number, required: true, min: 0 }, // Added field
>>>>>>> 871eea39ee2777f57e4fdae8e5265e13500dde3a
    status: {
        type: String,
        enum: ['open', 'running', 'closed', 'hold'],
        default: 'open'
    },
    grandTotal: { type: Number, default: 0 },

    // --- Detail Fields (for form/preview pages, fetched on demand) ---
    orderIssuedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    billingAddress: addressSchema,
    goods: [goodSchema],
    totalQuantity: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    gstAmount: { type: Number, default: 0 },
    dispatchDays: String,
    termsAndConditions: String,
}, {
    timestamps: true // Adds createdAt and updatedAt
});

module.exports = mongoose.model('Quotation', quotationSchema);

