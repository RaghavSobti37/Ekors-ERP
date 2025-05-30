const mongoose = require("mongoose");

const userBackupSchema = new mongoose.Schema({
    originalId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    firstname: {
        type: String,
        required: [true, "First name is required"],
        trim: true,
    },
    lastname: {
        type: String,
        required: [true, "Last name is required"],
        trim: true,
    },
    email: { // Not unique in backup table, originalId is the key
        type: String,
        required: [true, "Email is required"],
        trim: true,
        lowercase: true,
    },
    phone: {
        type: String,
        trim: true,
    },
    password: { // Store the already hashed password
        type: String,
        required: [true, "Password is required"],
    },
    role: {
        type: String,
        enum: ["user", "admin", "super-admin"],
        default: "user"
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lastLogin: {
        type: Date
    },
    // Timestamps from original document
    originalCreatedAt: { type: Date },
    originalUpdatedAt: { type: Date },
    // Backup specific fields
    deletedAt: { type: Date, default: Date.now, required: true },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // User who performed the delete
    backupReason: { type: String }
}, {
    timestamps: true, // Adds createdAt (backup creation time) and updatedAt
    // No toJSON transform needed here as we're not removing password for backup storage
    // No virtuals or methods needed for the backup schema
});

userBackupSchema.index({ deletedAt: -1 });
userBackupSchema.index({ email: 1 }); // Keep if useful for searching backups

const UserBackup = mongoose.model("UserBackup", userBackupSchema);

module.exports = UserBackup;