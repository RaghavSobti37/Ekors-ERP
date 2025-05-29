const Challan = require("../models/challan");
const ChallanBackup = require("../models/challanBackup"); // Import backup model
const logger = require("../utils/logger"); // Import logger

// Create or Submit Challan
exports.createChallan = async (req, res) => {
  const userId = req.user ? req.user._id : null;
  const user = req.user || null; // Pass user object if available
  try {
    const { companyName, phone, email, totalBilling, billNumber } = req.body;
    const challanData = {
      companyName, // Log this detail
      phone,
      email,
      totalBilling,
      billNumber,
    };

    if (req.file) {
      challanData.document = {
        data: req.file.buffer,
        contentType: req.file.mimetype,
        originalName: req.file.originalname,
      };
    }

    const newChallan = new Challan(challanData);
    await newChallan.save();
    logger.info('challan', `Challan created successfully`, user, { challanId: newChallan._id, companyName: newChallan.companyName });

    res.status(201).json(newChallan);
  } catch (err) {
    console.error("Error creating challan:", err);
    logger.error('challan', `Failed to create challan`, err, user, { requestBody: req.body });
    res.status(500).json({ error: "Failed to create challan" });
  }
};

// Get All Challans
exports.getAllChallans = async (req, res) => {
  try {
    const challans = await Challan.find().select("-document");
    // logger.info('challan', `Fetched all challans`, req.user); // Can be noisy, maybe debug level
    res.json(challans);
  } catch (err) {
    console.error("Error fetching challans:", err);
    logger.error('challan', `Failed to fetch all challans`, err, req.user);
    res.status(500).json({ error: "Failed to fetch challans" });
  }
};

// Get Single Challan
exports.getChallanById = async (req, res) => {
  try {
    const challan = await Challan.findById(req.params.id).select("-document.data");
    // logger.debug('challan', `Fetched challan by ID`, req.user, { challanId: req.params.id }); // Debug level
    if (!challan) return res.status(404).json({ error: "Challan not found" });
    res.json(challan);
  } catch (err) {
    logger.error('challan', `Failed to fetch challan by ID: ${req.params.id}`, err, req.user);
    console.error("Error fetching challan:", err);
    res.status(500).json({ error: "Failed to fetch challan" });
  }
};

// Get Document Preview
exports.getDocument = async (req, res) => {
  try {
    const challan = await Challan.findById(req.params.id);
    if (!challan || !challan.document || !challan.document.data) {
      logger.warn('challan', `Document not found for Challan ID: ${req.params.id}`, req.user);
      return res.status(404).json({ error: "Document not found" });
    }

    // logger.debug('challan', `Serving document for Challan ID: ${req.params.id}`, req.user); // Debug level
    res.set("Content-Type", challan.document.contentType);
    res.send(challan.document.data);
  } catch (err) {
    console.error("Error retrieving document:", err);
    res.status(500).json({ error: "Failed to retrieve document" });
  }
};

// Update Challan
exports.updateChallan = async (req, res) => {
  try {
    const userId = req.user ? req.user._id : null;
    const user = req.user || null;
    const { companyName, phone, email, totalBilling, billNumber } = req.body;

    const updateData = {
      companyName,
      phone,
      email,
      totalBilling,
      billNumber,
    };

    if (req.file) {
      updateData.document = {
        data: req.file.buffer,
        contentType: req.file.mimetype,
        originalName: req.file.originalname,
      };
    }

    const updated = await Challan.findByIdAndUpdate(req.params.id, updateData, { new: true });
    logger.info('challan', `Challan updated successfully`, user, { challanId: updated._id, companyName: updated.companyName });
    res.json(updated);
  } catch (err) {
    console.error("Error updating challan:", err);
    logger.error('challan', `Failed to update challan ID: ${req.params.id}`, err, req.user, { requestBody: req.body });
    res.status(500).json({ error: "Failed to update challan" });
  }
};

// Delete Challan with backup
exports.deleteChallan = async (req, res) => {
  const challanId = req.params.id;
  const userId = req.user ? req.user._id : null; // Assuming req.user is populated by auth middleware
  const user = req.user || null;

  const logDetails = { userId, challanId, model: 'Challan' };
  logger.info('delete', `[DELETE_INITIATED] Challan ID: ${challanId}`, user, logDetails);

  try {
    logger.debug('delete', `[FETCH_ATTEMPT] Finding Challan ID: ${challanId} for backup and deletion.`, user, logDetails);
    const challanToBackup = await Challan.findById(challanId);

    if (!challanToBackup) {
      logger.warn('delete', `[NOT_FOUND] Challan not found for deletion.`, user, logDetails);
      return res.status(404).json({ message: "Challan not found." });
    }
    logger.debug('delete', `[FETCH_SUCCESS] Found Challan ID: ${challanId}. Preparing for backup.`, user, logDetails);

    const backupData = challanToBackup.toObject();

    const newBackupEntry = new ChallanBackup({
      ...backupData,
      originalId: challanToBackup._id,
      deletedBy: userId,
      deletedAt: new Date(),
      originalCreatedAt: challanToBackup.createdAt,
      originalUpdatedAt: challanToBackup.updatedAt,
      backupReason: "User-initiated deletion via API"
    });

    logger.debug('delete', `[PRE_BACKUP_SAVE] Attempting to save backup for Challan ID: ${challanToBackup._id}.`, user, { ...logDetails, originalId: challanToBackup._id });
    await newBackupEntry.save();
    logger.info('delete', `[BACKUP_SUCCESS] Challan successfully backed up. Backup ID: ${newBackupEntry._id}.`, user, { ...logDetails, originalId: challanToBackup._id, backupId: newBackupEntry._id, backupModel: 'ChallanBackup' });

    logger.debug('delete', `[PRE_ORIGINAL_DELETE] Attempting to delete original Challan ID: ${challanToBackup._id}.`, user, { ...logDetails, originalId: challanToBackup._id });
    await Challan.findByIdAndDelete(challanId);
    logger.info('delete', `[ORIGINAL_DELETE_SUCCESS] Original Challan successfully deleted.`, user, { ...logDetails, originalId: challanToBackup._id });

    res.status(200).json({
      message: "Challan deleted and backed up successfully.",
      originalId: challanToBackup._id,
      backupId: newBackupEntry._id
    });

  } catch (error) {
    logger.error('delete', `[DELETE_ERROR] Error during Challan deletion process for ID: ${challanId}.`, error, user, logDetails);
    // Check if backup was made before error
    if (error.name === 'ValidationError' || !newBackupEntry || !newBackupEntry.isNew) { // Assuming newBackupEntry is defined if findById succeeds
        logger.warn('delete', `[ROLLBACK_DELETE] Backup failed or error before backup for Challan ID: ${challanId}. Original document will not be deleted.`, user, logDetails);
    } else {
        const backupExists = await ChallanBackup.findOne({ originalId: challanId });
        if (backupExists && !(await Challan.findById(challanId))) {
            logger.info('delete', `[CRITICAL_STATE] Challan was backed up (ID: ${backupExists._id}) but original might not have been deleted or error occurred after backup. Manual check recommended.`, user, { ...logDetails, backupId: backupExists._id });
        } else if (backupExists) {
            logger.warn(`[DELETE_POST_BACKUP_ERROR] Challan backup (ID: ${backupExists._id}) was created, but an error occurred before original deletion could be confirmed.`, { ...logDetails, backupId: backupExists._id });
        }
    }
    res.status(500).json({ message: 'Server error during the deletion process. Please check server logs.' });
  }
};
