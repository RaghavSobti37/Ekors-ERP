#!/usr/bin/env node

// Interactive script to backup and clear quotations and tickets data
const mongoose = require("mongoose");
const readline = require("readline");
const Quotation = require("../models/quotation");
const Ticket = require("../models/opentickets");
const UniversalBackup = require("../models/universalBackup");
const User = require("../models/users");

// Setup readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Helper function to ask questions
const askQuestion = (question) => {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
};

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

// Function to get data counts
const getDataCounts = async () => {
  const quotationCount = await Quotation.countDocuments({});
  const ticketCount = await Ticket.countDocuments({});
  const quotationBackupCount = await UniversalBackup.countDocuments({ originalModel: "Quotation" });
  const ticketBackupCount = await UniversalBackup.countDocuments({ originalModel: "Ticket" });
  
  return {
    quotationCount,
    ticketCount,
    quotationBackupCount,
    ticketBackupCount
  };
};

// Function to display current data status
const displayDataStatus = async () => {
  console.log("\n📊 CURRENT DATA STATUS:");
  console.log("═".repeat(50));
  
  const counts = await getDataCounts();
  
  console.log(`📦 Active Quotations: ${counts.quotationCount}`);
  console.log(`🎫 Active Tickets: ${counts.ticketCount}`);
  console.log(`🗃️  Backed up Quotations: ${counts.quotationBackupCount}`);
  console.log(`🗃️  Backed up Tickets: ${counts.ticketBackupCount}`);
  console.log("═".repeat(50));
  
  return counts;
};

// Main interactive function
const runInteractiveBackup = async () => {
  console.log("🔄 QUOTATION & TICKET DATA BACKUP AND CLEAR UTILITY");
  console.log("═".repeat(60));
  
  await connectDB();
  
  // Display current status
  const counts = await displayDataStatus();
  
  if (counts.quotationCount === 0 && counts.ticketCount === 0) {
    console.log("ℹ️  No active quotations or tickets found. Nothing to backup.");
    rl.close();
    mongoose.disconnect();
    return;
  }
  
  // Confirmation prompts
  console.log("\n⚠️  WARNING: This operation will:");
  console.log("   1. Backup ALL quotations and tickets to the UniversalBackup schema");
  console.log("   2. PERMANENTLY DELETE all quotations and tickets from active tables");
  console.log("   3. This action cannot be easily undone without the restore script");
  
  const confirm1 = await askQuestion("\nDo you want to proceed? (yes/no): ");
  if (confirm1.toLowerCase() !== 'yes') {
    console.log("❌ Operation cancelled.");
    rl.close();
    mongoose.disconnect();
    return;
  }
  
  const confirm2 = await askQuestion("Are you absolutely sure? Type 'BACKUP_AND_CLEAR' to confirm: ");
  if (confirm2 !== 'BACKUP_AND_CLEAR') {
    console.log("❌ Operation cancelled. Confirmation phrase does not match.");
    rl.close();
    mongoose.disconnect();
    return;
  }
  
  try {
    // Find system user
    const systemUser = await User.findOne({ role: "super-admin" }) || await User.findOne();
    if (!systemUser) {
      throw new Error("No users found in the system. Cannot perform backup without a user reference.");
    }
    
    console.log(`\n📋 Using system user: ${systemUser.email} (${systemUser.firstname} ${systemUser.lastname})`);
    console.log("🔄 Starting backup and clear process...");
    
    // Start transaction
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // 1. Backup all quotations
      console.log("📦 Backing up quotations...");
      const quotations = await Quotation.find({}).session(session);
      
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
      
      // Final summary
      console.log("\n🎉 BACKUP AND CLEAR COMPLETED SUCCESSFULLY!");
      console.log("═".repeat(60));
      console.log(`📦 Quotations backed up: ${quotations.length}`);
      console.log(`🎫 Tickets backed up: ${tickets.length}`);
      console.log(`🗑️  Quotations deleted: ${quotationDeleteResult.deletedCount}`);
      console.log(`🗑️  Tickets deleted: ${ticketDeleteResult.deletedCount}`);
      console.log(`👤 Backup performed by: ${systemUser.email}`);
      console.log(`⏰ Backup timestamp: ${new Date().toISOString()}`);
      console.log("═".repeat(60));
      
      // Verify final state
      await displayDataStatus();
      
      console.log("\n💡 Note: You can now work with clean data!");
      console.log("💡 Use the restore script if you need to restore the backed up data.");
      
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
    
  } catch (error) {
    console.error("❌ Error during backup and clear process:", error);
    process.exit(1);
  } finally {
    rl.close();
    mongoose.disconnect();
    console.log("👋 Disconnected from MongoDB");
  }
};

// Run the interactive backup
runInteractiveBackup();
