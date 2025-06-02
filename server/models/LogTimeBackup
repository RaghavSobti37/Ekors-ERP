const mongoose = require('mongoose');

const logTimeBackupSchema = new mongoose.Schema({
  originalId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: String, // Should match the original LogTime schema
  logs: [
    {
      task: String,
      start: String,
      finish: String,
      timeSpent: String,
    },
  ],
  // Backup specific fields
  deletedAt: { type: Date, default: Date.now, required: true },
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // User who performed the delete
  backupReason: { type: String },
  // Timestamps from original document
  originalCreatedAt: { type: Date },
  originalUpdatedAt: { type: Date },
}, {
  timestamps: true, // Adds createdAt (backup creation time) and updatedAt for the backup entry itself
});

logTimeBackupSchema.index({ deletedAt: -1 });
logTimeBackupSchema.index({ originalId: 1 });

module.exports = mongoose.model('LogTimeBackup', logTimeBackupSchema);