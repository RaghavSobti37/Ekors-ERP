const UniversalBackup = require('../models/universalBackup');
const mongoose = require('mongoose');
const logger = require('../utils/logger'); // Assuming you have a logger

// Helper function to get the Mongoose model by name
const getModelByName = (modelName) => {
  try {
    return mongoose.model(modelName);
  } catch (error) {
    logger.error(`Model not found: ${modelName}`, { error: error.message });
    return null;
  }
};

// List all backup entries
exports.listBackups = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', model = '', sortBy = 'deletedAt', order = 'desc' } = req.query;
    const userRole = req.user.role;

    if (userRole !== 'super-admin') {
      return res.status(403).json({ message: 'Access Denied. Only super-admins can view backups.' });
    }

    let query = {};
    if (search) {
      // Search in originalModel or potentially in string fields within data (more complex)
      // For simplicity, let's search in originalModel and backupReason
      query.$or = [
        { originalModel: { $regex: search, $options: 'i' } },
        { backupReason: { $regex: search, $options: 'i' } },
        // If you want to search by originalId, ensure search is a valid ObjectId or handle error
      ];
      if (mongoose.Types.ObjectId.isValid(search)) {
        query.$or.push({ originalId: search });
        query.$or.push({ deletedBy: search });
      }
    }

    if (model) {
      query.originalModel = model;
    }

    const backups = await UniversalBackup.find(query)
      .populate('deletedBy', 'firstname lastname email')
      .sort({ [sortBy]: order === 'desc' ? -1 : 1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const totalBackups = await UniversalBackup.countDocuments(query);

    res.json({
      backups,
      totalPages: Math.ceil(totalBackups / limit),
      currentPage: parseInt(page),
      totalBackups,
    });
  } catch (error) {
    logger.error('Error listing backups:', error.message, { stack: error.stack, userId: req.user?._id });
    res.status(500).json({ message: 'Error listing backups', error: error.message });
  }
};

// Get a single backup entry's details
exports.getBackupDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = req.user.role;

    if (userRole !== 'super-admin') {
      return res.status(403).json({ message: 'Access Denied.' });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid backup ID' });
    }

    const backup = await UniversalBackup.findById(id).populate('deletedBy', 'firstname lastname email');
    if (!backup) {
      return res.status(404).json({ message: 'Backup entry not found' });
    }
    res.json(backup);
  } catch (error) {
    logger.error(`Error fetching backup details for ID ${req.params.id}:`, error.message, { stack: error.stack, userId: req.user?._id });
    res.status(500).json({ message: 'Error fetching backup details', error: error.message });
  }
};

// Restore a backup entry
exports.restoreBackup = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { id: backupId } = req.params;
    const userRole = req.user.role;
    const userId = req.user._id;

    if (userRole !== 'super-admin') {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({ message: 'Access Denied. Only super-admins can restore data.' });
    }

    if (!mongoose.Types.ObjectId.isValid(backupId)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: 'Invalid backup ID' });
    }

    const backupEntry = await UniversalBackup.findById(backupId).session(session);
    if (!backupEntry) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Backup entry not found' });
    }

    const OriginalModel = getModelByName(backupEntry.originalModel);
    if (!OriginalModel) {
      await session.abortTransaction();
      session.endSession();
      return res.status(500).json({ message: `Cannot restore: Model ${backupEntry.originalModel} not found.` });
    }

    // Check if a document with the originalId already exists in the target collection
    const existingDocument = await OriginalModel.findById(backupEntry.originalId).session(session);
    if (existingDocument) {
      await session.abortTransaction();
      session.endSession();
      // Consider offering an overwrite option or creating a new document with a new ID
      return res.status(409).json({
        message: `Cannot restore: A document with ID ${backupEntry.originalId} already exists in ${backupEntry.originalModel}.`,
        conflict: true,
      });
    }

    // Prepare the data for restoration
    // Important: Remove _id from backupEntry.data to let MongoDB generate a new one if needed,
    // OR ensure backupEntry.data._id is the originalId.
    // For this strategy, we assume we want to restore with the *original* ID.
    const dataToRestore = { ...backupEntry.data };
    
    // Ensure _id is set to originalId for restoration
    dataToRestore._id = backupEntry.originalId;

    // Remove fields that should not be directly restored or are auto-managed
    delete dataToRestore.createdAt; // Will be set by Mongoose timestamps if schema has it
    delete dataToRestore.updatedAt; // Will be set by Mongoose timestamps
    // If your original models have `createdBy`, `updatedBy` fields, you might want to set them
    // or preserve the original ones if they are part of `backupEntry.data`.
    // For now, we assume the backed-up data contains all necessary fields.

    // If your original models have specific pre-save hooks or validations,
    // creating a new instance and then saving might be better.
    // const restoredDocument = new OriginalModel(dataToRestore);
    // await restoredDocument.save({ session });
    // OR, for more direct insertion if you trust the backup data structure:
    await OriginalModel.collection.insertOne(dataToRestore, { session });


    // After successful restoration, delete the backup entry
    await UniversalBackup.findByIdAndDelete(backupId).session(session);

    await session.commitTransaction();
    session.endSession();

    logger.info('backup_restore', `Backup ${backupId} for ${backupEntry.originalModel} (ID: ${backupEntry.originalId}) restored by user ${userId}.`, { backupId, originalModel: backupEntry.originalModel, originalId: backupEntry.originalId, userId });
    res.json({ message: `${backupEntry.originalModel} (ID: ${backupEntry.originalId}) restored successfully and backup entry removed.` });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logger.error(`Error restoring backup ID ${req.params.id}:`, error.message, { stack: error.stack, userId: req.user?._id });
    // Check for MongoDB duplicate key error if _id was not handled correctly
    if (error.code === 11000) {
        return res.status(409).json({ message: `Restore failed: A document with a conflicting unique key (likely _id) already exists in ${error.keyValue ? Object.keys(error.keyValue).join(', ') : 'the target collection'}.`, error: error.message });
    }
    res.status(500).json({ message: 'Error restoring backup', error: error.message });
  }
};
