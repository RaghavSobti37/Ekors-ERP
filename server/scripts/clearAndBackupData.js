#!/usr/bin/env node

// Script to backup and clear all quotations and tickets data
const mongoose = require("mongoose");
const Quotation = require("../models/quotation");
const Ticket = require("../models/opentickets");
const UniversalBackup = require("../models/universalBackup");
const User = require("../models/users");

// Connect to MongoDB
const connectDB = async () => {
  try {
    // Load environment variables
    require('dotenv').config();
    
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://localhost:27017/ekors-erp";
    
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB");
    console.log("🔗 Database:", mongoUri.includes('mongodb+srv') ? 'MongoDB Atlas' : 'Local MongoDB');
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error);
    process.exit(1);
  }
};

// Function to backup and clear data
const backupAndClearData = async () => {
  try {
    console.log("🔄 Starting backup and clear process...");
    
    // Find a system user for the backup operation (preferably super-admin)
    const systemUser = await User.findOne({ role: "super-admin" }) || await User.findOne();
    if (!systemUser) {
      throw new Error("No users found in the system. Cannot perform backup without a user reference.");
    }
    
    console.log(`📋 Using system user: ${systemUser.email} (${systemUser.firstname} ${systemUser.lastname})`);
    
    // Start transaction
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // 1. Backup all quotations
      console.log("📦 Backing up quotations...");
      const quotations = await Quotation.find({}).session(session);
      console.log(`📊 Found ${quotations.length} quotations to backup`);
      
      if (quotations.length > 0) {
        const quotationBackups = quotations.map(quotation => ({
          originalId: quotation._id,
          originalModel: "Quotation",
          data: quotation.toObject(),
          deletedBy: systemUser._id,
          deletedAt: new Date(),
          originalCreatedAt: quotation.createdAt,
          originalUpdatedAt: quotation.updatedAt,
        }));
        
        await UniversalBackup.insertMany(quotationBackups, { session });
        console.log(`✅ Backed up ${quotations.length} quotations`);
      }
      
      // 2. Backup all tickets
      console.log("🎫 Backing up tickets...");
      const tickets = await Ticket.find({}).session(session);
      console.log(`📊 Found ${tickets.length} tickets to backup`);
      
      if (tickets.length > 0) {
        const ticketBackups = tickets.map(ticket => ({
          originalId: ticket._id,
          originalModel: "Ticket",
          data: ticket.toObject(),
          deletedBy: systemUser._id,
          deletedAt: new Date(),
          originalCreatedAt: ticket.createdAt,
          originalUpdatedAt: ticket.updatedAt,
        }));
        
        await UniversalBackup.insertMany(ticketBackups, { session });
        console.log(`✅ Backed up ${tickets.length} tickets`);
      }
      
      // 3. Clear all quotations
      console.log("🗑️  Clearing all quotations...");
      const quotationDeleteResult = await Quotation.deleteMany({}, { session });
      console.log(`🗑️  Deleted ${quotationDeleteResult.deletedCount} quotations`);
      
      // 4. Clear all tickets
      console.log("🗑️  Clearing all tickets...");
      const ticketDeleteResult = await Ticket.deleteMany({}, { session });
      console.log(`🗑️  Deleted ${ticketDeleteResult.deletedCount} tickets`);
      
      // Commit transaction
      await session.commitTransaction();
      console.log("✅ Transaction committed successfully");
      
      // Summary
      console.log("\n📋 BACKUP AND CLEAR SUMMARY:");
      console.log("═".repeat(50));
      console.log(`📦 Quotations backed up: ${quotations.length}`);
      console.log(`🎫 Tickets backed up: ${tickets.length}`);
      console.log(`🗑️  Quotations deleted: ${quotationDeleteResult.deletedCount}`);
      console.log(`🗑️  Tickets deleted: ${ticketDeleteResult.deletedCount}`);
      console.log(`👤 Backup performed by: ${systemUser.email}`);
      console.log(`⏰ Backup timestamp: ${new Date().toISOString()}`);
      console.log("═".repeat(50));
      
      // Verify backup
      console.log("\n🔍 Verifying backup...");
      const quotationBackupCount = await UniversalBackup.countDocuments({ originalModel: "Quotation" });
      const ticketBackupCount = await UniversalBackup.countDocuments({ originalModel: "Ticket" });
      const remainingQuotations = await Quotation.countDocuments({});
      const remainingTickets = await Ticket.countDocuments({});
      
      console.log(`📦 Quotations in backup: ${quotationBackupCount}`);
      console.log(`🎫 Tickets in backup: ${ticketBackupCount}`);
      console.log(`📊 Remaining quotations: ${remainingQuotations}`);
      console.log(`📊 Remaining tickets: ${remainingTickets}`);
      
      if (remainingQuotations === 0 && remainingTickets === 0) {
        console.log("✅ Verification passed: All data cleared successfully!");
      } else {
        console.log("⚠️  Warning: Some data may not have been cleared properly.");
      }
      
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
    
  } catch (error) {
    console.error("❌ Error during backup and clear process:", error);
    throw error;
  }
};

// Function to restore data (optional - for safety)
const restoreData = async () => {
  try {
    console.log("🔄 Starting restore process...");
    
    // Get all backups
    const quotationBackups = await UniversalBackup.find({ originalModel: "Quotation" });
    const ticketBackups = await UniversalBackup.find({ originalModel: "Ticket" });
    
    console.log(`📦 Found ${quotationBackups.length} quotation backups`);
    console.log(`🎫 Found ${ticketBackups.length} ticket backups`);
    
    if (quotationBackups.length === 0 && ticketBackups.length === 0) {
      console.log("ℹ️  No backup data found to restore.");
      return;
    }
    
    // Start transaction
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // Restore quotations
      if (quotationBackups.length > 0) {
        console.log("📦 Restoring quotations...");
        const quotationsToRestore = quotationBackups.map(backup => ({
          ...backup.data,
          _id: backup.originalId,
        }));
        
        await Quotation.insertMany(quotationsToRestore, { session });
        console.log(`✅ Restored ${quotationBackups.length} quotations`);
      }
      
      // Restore tickets
      if (ticketBackups.length > 0) {
        console.log("🎫 Restoring tickets...");
        const ticketsToRestore = ticketBackups.map(backup => ({
          ...backup.data,
          _id: backup.originalId,
        }));
        
        await Ticket.insertMany(ticketsToRestore, { session });
        console.log(`✅ Restored ${ticketBackups.length} tickets`);
      }
      
      await session.commitTransaction();
      console.log("✅ Restore completed successfully!");
      
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
    
  } catch (error) {
    console.error("❌ Error during restore process:", error);
    throw error;
  }
};

// Main execution
const main = async () => {
  await connectDB();
  
  const args = process.argv.slice(2);
  const command = args[0];
  
  try {
    if (command === "clear") {
      await backupAndClearData();
    } else if (command === "restore") {
      const confirm = args[1] === "--confirm";
      if (!confirm) {
        console.log("⚠️  To restore data, run: node clearAndBackupData.js restore --confirm");
        console.log("⚠️  Warning: This will restore all backed up data and may create duplicates!");
        return;
      }
      await restoreData();
    } else {
      console.log("Usage:");
      console.log("  node clearAndBackupData.js clear    - Backup and clear all quotations and tickets");
      console.log("  node clearAndBackupData.js restore --confirm - Restore backed up data");
    }
  } catch (error) {
    console.error("❌ Script execution failed:", error);
    process.exit(1);
  } finally {
    mongoose.disconnect();
    console.log("👋 Disconnected from MongoDB");
  }
};

// Handle script execution
if (require.main === module) {
  main();
}

module.exports = { backupAndClearData, restoreData };
