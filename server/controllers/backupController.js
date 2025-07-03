const UniversalBackup = require('../models/universalBackup');
const mongoose = require('mongoose');
const logger = require('../logger'); // Unified logger

// Helper function to get the Mongoose model by name
const getModelByName = (modelName) => {
  try {
    return mongoose.model(modelName);
  } catch (error) {
    logger.log({
      page: "Backup",
      action: "Get Model By Name",
      message: `Model not found: ${modelName}`,
      details: { error: error.message },
      level: "error"
    });
    return null;
  }
};

// List all backup entries
exports.listBackups = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', model = '', sortBy = 'deletedAt', order = 'desc' } = req.query;
    const userRole = req.user.role;

    if (userRole !== 'super-admin') {
      logger.log({
        user: req.user,
        page: "Backup",
        action: "List Backups",
       
        req,
        message: "Access Denied. Only super-admins can view backups.",
        details: {},
        level: "warn"
      });
      return res.status(403).json({ message: 'Access Denied. Only super-admins can view backups.' });
    }

    let query = {};
    if (search) {
      const searchRegex = { $regex: search, $options: 'i' };
      query.$or = [
        { originalModel: searchRegex },
        { 'data.name': searchRegex },
        { 'data.companyName': searchRegex },
        { 'data.ticketNumber': searchRegex },
        { 'data.referenceNumber': searchRegex },
        { 'data.title': searchRegex },
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

    logger.log({
      user: req.user,
      page: "Backup",
      action: "List Backups",
     
      req,
      message: "Listed backups",
      details: { totalBackups, page, limit, query },
      level: "info"
    });

    res.json({
      backups,
      totalPages: Math.ceil(totalBackups / limit),
      currentPage: parseInt(page),
      totalBackups,
    });
  } catch (error) {
    logger.log({
      user: req.user,
      page: "Backup",
      action: "List Backups Error",
     
      req,
      message: "Error listing backups",
      details: { error: error.message, stack: error.stack },
      level: "error"
    });
    res.status(500).json({ message: 'Error listing backups', error: error.message });
  }
};

// Get a single backup entry's details
exports.getBackupDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = req.user.role;

    if (userRole !== 'super-admin') {
      logger.log({
        user: req.user,
        page: "Backup",
        action: "Get Backup Details",
       
        req,
        message: "Access Denied.",
        details: { id },
        level: "warn"
      });
      return res.status(403).json({ message: 'Access Denied.' });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      logger.log({
        user: req.user,
        page: "Backup",
        action: "Get Backup Details",
       
        req,
        message: "Invalid backup ID",
        details: { id },
        level: "warn"
      });
      return res.status(400).json({ message: 'Invalid backup ID' });
    }

    const backup = await UniversalBackup.findById(id).populate('deletedBy', 'firstname lastname email');
    if (!backup) {
      logger.log({
        user: req.user,
        page: "Backup",
        action: "Get Backup Details",
       
        req,
        message: "Backup entry not found",
        details: { id },
        level: "warn"
      });
      return res.status(404).json({ message: 'Backup entry not found' });
    }

    logger.log({
      user: req.user,
      page: "Backup",
      action: "Get Backup Details",
     
      req,
      message: "Fetched backup details",
      details: { id },
      level: "info"
    });

    res.json(backup);
  } catch (error) {
    logger.log({
      user: req.user,
      page: "Backup",
      action: "Get Backup Details Error",
     
      req,
      message: `Error fetching backup details for ID ${req.params.id}`,
      details: { error: error.message, stack: error.stack, id: req.params.id },
      level: "error"
    });
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
      logger.log({
        user: req.user,
        page: "Backup",
        action: "Restore Backup",
       
        req,
        message: "Access Denied. Only super-admins can restore data.",
        details: { backupId },
        level: "warn"
      });
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({ message: 'Access Denied. Only super-admins can restore data.' });
    }

    if (!mongoose.Types.ObjectId.isValid(backupId)) {
      logger.log({
        user: req.user,
        page: "Backup",
        action: "Restore Backup",
       
        req,
        message: "Invalid backup ID",
        details: { backupId },
        level: "warn"
      });
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: 'Invalid backup ID' });
    }

    const backupEntry = await UniversalBackup.findById(backupId).session(session);
    if (!backupEntry) {
      logger.log({
        user: req.user,
        page: "Backup",
        action: "Restore Backup",
       
        req,
        message: "Backup entry not found",
        details: { backupId },
        level: "warn"
      });
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Backup entry not found' });
    }

    const OriginalModel = getModelByName(backupEntry.originalModel);
    if (!OriginalModel) {
      logger.log({
        user: req.user,
        page: "Backup",
        action: "Restore Backup",
       
        req,
        message: `Cannot restore: Model ${backupEntry.originalModel} not found.`,
        details: { backupId, originalModel: backupEntry.originalModel },
        level: "error"
      });
      await session.abortTransaction();
      session.endSession();
      return res.status(500).json({ message: `Cannot restore: Model ${backupEntry.originalModel} not found.` });
    }

    // Check if a document with the originalId already exists in the target collection
    const existingDocument = await OriginalModel.findById(backupEntry.originalId).session(session);
    if (existingDocument) {
      logger.log({
        user: req.user,
        page: "Backup",
        action: "Restore Backup",
       
        req,
        message: `Cannot restore: A document with ID ${backupEntry.originalId} already exists in ${backupEntry.originalModel}.`,
        details: { backupId, originalId: backupEntry.originalId, originalModel: backupEntry.originalModel },
        level: "warn"
      });
      await session.abortTransaction();
      session.endSession();
      return res.status(409).json({
        message: `Cannot restore: A document with ID ${backupEntry.originalId} already exists in ${backupEntry.originalModel}.`,
        conflict: true,
      });
    }

    // Prepare the data for restoration
    const dataToRestore = { ...backupEntry.data };
    dataToRestore._id = backupEntry.originalId;
    delete dataToRestore.createdAt;
    delete dataToRestore.updatedAt;

    await OriginalModel.collection.insertOne(dataToRestore, { session });

    // After successful restoration, delete the backup entry
    await UniversalBackup.findByIdAndDelete(backupId).session(session);

    await session.commitTransaction();
    session.endSession();

    logger.log({
      user: req.user,
      page: "Backup",
      action: "Restore Backup Success",
     
      req,
      message: `Backup ${backupId} for ${backupEntry.originalModel} (ID: ${backupEntry.originalId}) restored and backup entry removed.`,
      details: { backupId, originalModel: backupEntry.originalModel, originalId: backupEntry.originalId, userId },
      level: "info"
    });

    res.json({ message: `${backupEntry.originalModel} (ID: ${backupEntry.originalId}) restored successfully and backup entry removed.` });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logger.log({
      user: req.user,
      page: "Backup",
      action: "Restore Backup Error",
     
      req,
      message: `Error restoring backup ID ${req.params.id}`,
      details: { error: error.message, stack: error.stack, backupId: req.params.id },
      level: "error"
    });
    if (error.code === 11000) {
      return res.status(409).json({
        message: `Restore failed: A document with a conflicting unique key (likely _id) already exists in ${error.keyValue ? Object.keys(error.keyValue).join(', ') : 'the target collection'}.`,
        error: error.message
      });
    }
    res.status(500).json({ message: 'Error restoring backup', error: error.message });
  }
};
