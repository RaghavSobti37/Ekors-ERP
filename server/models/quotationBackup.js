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

const documentSubSchema = new mongoose.Schema({
  path: { type: String, required: true },
  originalName: { type: String, required: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  uploadedAt: { type: Date } // Capture original upload date
}, { _id: false });

const quotationBackupSchema = new mongoose.Schema(
  {
    originalId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
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
    documents: {
      quotationPdf: documentSubSchema,
      clientApproval: documentSubSchema,
      other: [documentSubSchema]
    },
    // Backup specific fields
    deletedAt: { type: Date, default: Date.now, required: true },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    backupReason: { type: String }
  },
  {
    timestamps: true, // Adds createdAt (backup creation time) and updatedAt
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

quotationBackupSchema.index({ deletedAt: -1 });
quotationBackupSchema.index({ originalId: 1 });
quotationBackupSchema.index({ user: 1, referenceNumber: 1 });

module.exports = mongoose.model("QuotationBackup", quotationBackupSchema);