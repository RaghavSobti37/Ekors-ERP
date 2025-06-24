// server/models/universalBackup.js
const mongoose = require("mongoose");

const universalBackupSchema = new mongoose.Schema({
  originalId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  originalModel: { type: String, required: true, index: true }, // e.g., "Challan", "Quotation", "User", "Item", "Ticket"
  data: { type: mongoose.Schema.Types.Mixed, required: true }, // The actual data of the deleted document
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  deletedAt: { type: Date, default: Date.now },
  // backupReason: { type: String, default: "User-initiated deletion" },
  originalCreatedAt: { type: Date },
  originalUpdatedAt: { type: Date },
  // Optional: For restoring relationships, this can get complex
  // linkedEntities: [{
  //   fieldName: String, // e.g., 'client', 'goods.item'
  //   linkedModel: String,
  //   linkedId: mongoose.Schema.Types.ObjectId
  // }]
}, { timestamps: true });

module.exports = mongoose.model("UniversalBackup", universalBackupSchema);
