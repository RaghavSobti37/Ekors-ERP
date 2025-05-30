const mongoose = require("mongoose");

const challanBackupSchema = new mongoose.Schema({
  originalId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  companyName: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String, required: true },
  totalBilling: { type: String, required: true },
  billNumber: { type: String },
  document: { // Replicating the structure for embedded document data
    data: Buffer,
    contentType: String,
    originalName: String,
  },
  // Timestamps from original document
  originalCreatedAt: { type: Date },
  originalUpdatedAt: { type: Date },
  // Backup specific fields
  deletedAt: { type: Date, default: Date.now, required: true },
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  backupReason: { type: String }
}, {
  timestamps: true // Adds createdAt (backup creation time) and updatedAt for the backup entry
});

challanBackupSchema.index({ deletedAt: -1 });

module.exports = mongoose.model("ChallanBackup", challanBackupSchema);