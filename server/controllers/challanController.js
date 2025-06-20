const Challan = require("../models/challan");
const UniversalBackup = require("../models/universalBackup.js"); // Import backup model
const logger = require("../utils/logger"); // Import logger

// Create or Submit Challan
exports.createChallan = async (req, res) => {
  const user = req.user;
  try {
    const { companyName, phone, email, totalBilling, billNumber } = req.body;
    const challanData = {
      companyName,
      phone,
      email,
      totalBilling,
      billNumber,
      createdBy: user._id, // Track creator
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

    logger.info("challan", `Challan created by user: ${user._id}`, user, {
      challanId: newChallan._id,
      companyName: newChallan.companyName,
    });

    res.status(201).json(newChallan);
  } catch (err) {
    logger.error(
      "challan",
      `Failed to create challan by user: ${user._id}`,
      err,
      user
    );
    res.status(500).json({ error: "Failed to create challan" });
  }
};

// Get All Challans
exports.getAllChallans = async (req, res) => {
  const user = req.user;
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10; // Default limit to 10, adjust as needed
  const skip = (page - 1) * limit;
  try {
    let query = {};

    // If the user is not a super-admin, filter challans by createdBy
    if (user.role !== "super-admin") {
      query.createdBy = user._id;
    }

    const totalItems = await Challan.countDocuments(query);

    const challans = await Challan.find(query) // Apply the query
      .sort({ createdAt: -1 }) // Sort by creation date, newest first
      .skip(skip)
      .limit(limit)
      .select("-document")
      .populate("createdBy", "firstname lastname email") // Populate creator info
      .populate("updatedBy", "firstname lastname email"); // Populate updater info

    res.json({
      data: challans,
      totalItems,
      currentPage: page,
      totalPages: Math.ceil(totalItems / limit),
    });
  } catch (err) {
    logger.error(
      "challan",
      `Failed to fetch all challans for user: ${user._id}, role: ${user.role}`,
      err,
      user
    );
    res.status(500).json({ error: "Failed to fetch challans" });
  }
};

// Get Single Challan
exports.getChallanById = async (req, res) => {
  try {
    const challan = await Challan.findById(req.params.id)
      .select("-document.data")
      .populate("createdBy", "firstname lastname email")
      .populate("updatedBy", "firstname lastname email");

    if (!challan) return res.status(404).json({ error: "Challan not found" });
    res.json(challan);
  } catch (err) {
    logger.error("challan", `Failed to fetch challan: ${req.params.id}`, err);
    res.status(500).json({ error: "Failed to fetch challan" });
  }
};

// Get Document Preview
exports.getDocument = async (req, res) => {
  try {
    const challan = await Challan.findById(req.params.id);
    if (!challan || !challan.document || !challan.document.data) {
      logger.warn(
        "challan",
        `Document not found for Challan ID: ${req.params.id}`,
        req.user
      );
      return res.status(404).json({ error: "Document not found" });
    }

    logger.debug(
      "challan",
      `Serving document for Challan ID: ${req.params.id}`,
      req.user
    );
    res.set("Content-Type", challan.document.contentType);
    res.send(challan.document.data);
  } catch (err) {
    logger.error(
      "challan",
      `Failed to retrieve document for Challan ID: ${req.params.id}`,
      err,
      req.user
    );
    res.status(500).json({ error: "Failed to retrieve document" });
  }
};

// Update Challan
exports.updateChallan = async (req, res) => {
  const user = req.user;
  try {
    // Explicitly pick fields to update to prevent unintended modifications
    const { companyName, phone, email, totalBilling, billNumber } = req.body;
    const updateData = {};

    if (companyName !== undefined) updateData.companyName = companyName;
    if (phone !== undefined) updateData.phone = phone;
    if (email !== undefined) updateData.email = email;
    if (totalBilling !== undefined) updateData.totalBilling = totalBilling;
    // Allow billNumber to be set to an empty string (cleared) or a new value
    if (billNumber !== undefined) updateData.billNumber = billNumber;

    // Always set updatedBy
    updateData.updatedBy = user._id;

    if (req.file) {
      updateData.document = {
        data: req.file.buffer,
        contentType: req.file.mimetype,
        originalName: req.file.originalname,
      };
    }

    // If no actual data fields are being updated (e.g., only a file or nothing)
    // and no file, we might still want to update 'updatedBy' and 'updatedAt'
    // Mongoose handles updatedAt automatically. findByIdAndUpdate will proceed.
    // If updateData (excluding updatedBy and document) is empty, it means only metadata or file might change.

    const updated = await Challan.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
    });

    logger.info("challan", `Challan updated by user: ${user._id}`, user, {
      challanId: updated._id,
      companyName: updated.companyName,
    });

    res.json(updated);
  } catch (err) {
    logger.error("challan", `Update failed by user: ${user._id}`, err, user);
    res.status(500).json({ error: "Failed to update challan" });
  }
};

// Delete Challan with backup
exports.deleteChallan = async (req, res) => {
  const challanId = req.params.id;
  const user = req.user; // Assuming req.user is populated by auth middleware
  const userId = user?._id;
  let newBackupEntry = null; // Declare newBackupEntry here to ensure it's in scope for the catch block

  const logDetails = { userId, challanId, model: "Challan" };
  logger.info(
    "delete",
    `[DELETE_INITIATED] Challan ID: ${challanId}`,
    user,
    logDetails
  );

  try {
    logger.debug(
      "delete",
      `[FETCH_ATTEMPT] Finding Challan ID: ${challanId} for backup and deletion.`,
      user,
      logDetails
    );
    const challanToBackup = await Challan.findById(challanId);

    if (!challanToBackup) {
      logger.warn(
        "delete",
        `[NOT_FOUND] Challan not found for deletion.`,
        user,
        logDetails
      );
      return res.status(404).json({ message: "Challan not found." });
    }
    logger.debug(
      "delete",
      `[FETCH_SUCCESS] Found Challan ID: ${challanId}. Preparing for backup.`,
      user,
      logDetails
    );

    const challanDataToBackup = challanToBackup.toObject();

    newBackupEntry = new UniversalBackup({
      // Assign to the already declared variable
      originalId: challanToBackup._id,
      originalModel: "Challan", // Specify the model being backed up
      data: challanDataToBackup,
      deletedBy: userId,
      deletedAt: new Date(),
      originalCreatedAt: challanToBackup.createdAt,
      originalUpdatedAt: challanToBackup.updatedAt,
      // backupReason: "User-initiated deletion via API",
    });

    logger.debug(
      "delete",
      `[PRE_BACKUP_SAVE] Attempting to save backup for Challan ID: ${challanToBackup._id}.`,
      user,
      { ...logDetails, originalId: challanToBackup._id }
    );
    await newBackupEntry.save();
    logger.info(
      "delete",
      `[BACKUP_SUCCESS] Challan successfully backed up. Backup ID: ${newBackupEntry._id}.`,
      user,
      {
        ...logDetails,
        originalId: challanToBackup._id,
        backupId: newBackupEntry._id,
        backupModel: "UniversalBackup",
      }
    );

    logger.debug(
      "delete",
      `[PRE_ORIGINAL_DELETE] Attempting to delete original Challan ID: ${challanToBackup._id}.`,
      user,
      { ...logDetails, originalId: challanToBackup._id }
    );
    await Challan.findByIdAndDelete(challanId);
    logger.info(
      "delete",
      `[ORIGINAL_DELETE_SUCCESS] Original Challan successfully deleted.`,
      user,
      { ...logDetails, originalId: challanToBackup._id }
    );

    res.status(200).json({
      message: "Challan deleted and backed up successfully.",
      originalId: challanToBackup._id,
      backupId: newBackupEntry._id,
    });
  } catch (error) {
    logger.error(
      "delete",
      `[DELETE_ERROR] Error during Challan deletion process for ID: ${challanId}.`,
      error,
      user,
      logDetails
    );
    // Check if backup was made before error
    // If newBackupEntry is null (error before its creation) OR
    // if newBackupEntry exists but isNew is true (meaning .save() likely failed or didn't happen)
    if (
      error.name === "ValidationError" ||
      !newBackupEntry ||
      (newBackupEntry && newBackupEntry.isNew)
    ) {
      logger.warn(
        "delete",
        `[ROLLBACK_DELETE] Backup failed or error before backup for Challan ID: ${challanId}. Original document will not be deleted.`,
        user,
        logDetails
      );
    } else {
      const backupExists = await UniversalBackup.findOne({
        originalId: challanId,
      });
      if (backupExists && !(await Challan.findById(challanId))) {
        logger.info(
          "delete",
          `[CRITICAL_STATE] Challan was backed up (ID: ${backupExists._id}) but original might not have been deleted or error occurred after backup. Manual check recommended.`,
          user,
          { ...logDetails, backupId: backupExists._id }
        );
      } else if (backupExists) {
        logger.warn(
          `[DELETE_POST_BACKUP_ERROR] Challan backup (ID: ${backupExists._id}) was created, but an error occurred before original deletion could be confirmed.`,
          { ...logDetails, backupId: backupExists._id }
        );
      }
    }
    res
      .status(500)
      .json({
        message:
          "Server error during the deletion process. Please check server logs.",
      });
  }
};
