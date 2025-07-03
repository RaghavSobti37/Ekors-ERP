const Challan = require("../models/challan");
const UniversalBackup = require("../models/universalBackup.js");
const logger = require("../logger"); // Use unified logger

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
      createdBy: user._id,
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

    logger.log({
      user,
      page: "Challan",
      action: "Create Challan",
     
      req,
      message: `Challan created by user: ${user._id}`,
      details: {
        challanId: newChallan._id,
        companyName: newChallan.companyName,
      },
      level: "info",
    });

    res.status(201).json(newChallan);
  } catch (err) {
    logger.log({
      user,
      page: "Challan",
      action: "Create Challan Error",
     
      req,
      message: `Failed to create challan by user: ${user._id}`,
      details: { error: err.message, stack: err.stack },
      level: "error",
    });
    res.status(500).json({ error: "Failed to create challan" });
  }
};

// Get All Challans
exports.getAllChallans = async (req, res) => {
  const user = req.user;
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;
  try {
    let query = {};

    if (user.role !== "super-admin") {
      query.createdBy = user._id;
    }

    const totalItems = await Challan.countDocuments(query);

    const challans = await Challan.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("-document")
      .populate("createdBy", "firstname lastname email")
      .populate("updatedBy", "firstname lastname email");

    logger.log({
      user,
      page: "Challan",
      action: "Get All Challans",
     
      req,
      message: `Fetched challans for user: ${user._id}, role: ${user.role}`,
      details: { totalItems, page, limit },
      level: "info",
    });

    res.json({
      data: challans,
      totalItems,
      currentPage: page,
      totalPages: Math.ceil(totalItems / limit),
    });
  } catch (err) {
    logger.log({
      user,
      page: "Challan",
      action: "Get All Challans Error",
     
      req,
      message: `Failed to fetch all challans for user: ${user._id}, role: ${user.role}`,
      details: { error: err.message, stack: err.stack },
      level: "error",
    });
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

    if (!challan) {
      logger.log({
        page: "Challan",
        action: "Get Challan By ID",
       
        req,
        message: `Challan not found: ${req.params.id}`,
        details: { challanId: req.params.id },
        level: "warn",
      });
      return res.status(404).json({ error: "Challan not found" });
    }

    logger.log({
      user: req.user,
      page: "Challan",
      action: "Get Challan By ID",
     
      req,
      message: `Fetched challan: ${req.params.id}`,
      details: { challanId: req.params.id },
      level: "info",
    });

    res.json(challan);
  } catch (err) {
    logger.log({
      user: req.user,
      page: "Challan",
      action: "Get Challan By ID Error",
     
      req,
      message: `Failed to fetch challan: ${req.params.id}`,
      details: { error: err.message, stack: err.stack },
      level: "error",
    });
    res.status(500).json({ error: "Failed to fetch challan" });
  }
};

// Get Document Preview
exports.getDocument = async (req, res) => {
  try {
    const challan = await Challan.findById(req.params.id);
    if (!challan || !challan.document || !challan.document.data) {
      logger.log({
        user: req.user,
        page: "Challan",
        action: "Get Document",
       
        req,
        message: `Document not found for Challan ID: ${req.params.id}`,
        details: { challanId: req.params.id },
        level: "warn",
      });
      return res.status(404).json({ error: "Document not found" });
    }

    logger.log({
      user: req.user,
      page: "Challan",
      action: "Get Document",
     
      req,
      message: `Serving document for Challan ID: ${req.params.id}`,
      details: { challanId: req.params.id },
      level: "debug",
    });

    res.set("Content-Type", challan.document.contentType);
    res.send(challan.document.data);
  } catch (err) {
    logger.log({
      user: req.user,
      page: "Challan",
      action: "Get Document Error",
     
      req,
      message: `Failed to retrieve document for Challan ID: ${req.params.id}`,
      details: { error: err.message, stack: err.stack },
      level: "error",
    });
    res.status(500).json({ error: "Failed to retrieve document" });
  }
};

// Update Challan
exports.updateChallan = async (req, res) => {
  const user = req.user;
  try {
    const { companyName, phone, email, totalBilling, billNumber } = req.body;
    const updateData = {};

    if (companyName !== undefined) updateData.companyName = companyName;
    if (phone !== undefined) updateData.phone = phone;
    if (email !== undefined) updateData.email = email;
    if (totalBilling !== undefined) updateData.totalBilling = totalBilling;
    if (billNumber !== undefined) updateData.billNumber = billNumber;

    updateData.updatedBy = user._id;

    if (req.file) {
      updateData.document = {
        data: req.file.buffer,
        contentType: req.file.mimetype,
        originalName: req.file.originalname,
      };
    }

    const updated = await Challan.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
    });

    logger.log({
      user,
      page: "Challan",
      action: "Update Challan",
     
      req,
      message: `Challan updated by user: ${user._id}`,
      details: {
        challanId: updated?._id,
        companyName: updated?.companyName,
      },
      level: "info",
    });

    res.json(updated);
  } catch (err) {
    logger.log({
      user,
      page: "Challan",
      action: "Update Challan Error",
     
      req,
      message: `Update failed by user: ${user._id}`,
      details: { error: err.message, stack: err.stack },
      level: "error",
    });
    res.status(500).json({ error: "Failed to update challan" });
  }
};

// Delete Challan with backup
exports.deleteChallan = async (req, res) => {
  const challanId = req.params.id;
  const user = req.user;
  const userId = user?._id;
  let newBackupEntry = null;

  const logDetails = { userId, challanId, model: "Challan" };
  logger.log({
    user,
    page: "Challan",
    action: "Delete Challan Initiated",
   
    req,
    message: `[DELETE_INITIATED] Challan ID: ${challanId}`,
    details: logDetails,
    level: "info",
  });

  try {
    logger.log({
      user,
      page: "Challan",
      action: "Delete Challan Fetch Attempt",
     
      req,
      message: `[FETCH_ATTEMPT] Finding Challan ID: ${challanId} for backup and deletion.`,
      details: logDetails,
      level: "debug",
    });
    const challanToBackup = await Challan.findById(challanId);

    if (!challanToBackup) {
      logger.log({
        user,
        page: "Challan",
        action: "Delete Challan Not Found",
       
        req,
        message: `[NOT_FOUND] Challan not found for deletion.`,
        details: logDetails,
        level: "warn",
      });
      return res.status(404).json({ message: "Challan not found." });
    }
    logger.log({
      user,
      page: "Challan",
      action: "Delete Challan Fetch Success",
     
      req,
      message: `[FETCH_SUCCESS] Found Challan ID: ${challanId}. Preparing for backup.`,
      details: logDetails,
      level: "debug",
    });

    const challanDataToBackup = challanToBackup.toObject();

    newBackupEntry = new UniversalBackup({
      originalId: challanToBackup._id,
      originalModel: "Challan",
      data: challanDataToBackup,
      deletedBy: userId,
      deletedAt: new Date(),
      originalCreatedAt: challanToBackup.createdAt,
      originalUpdatedAt: challanToBackup.updatedAt,
    });

    logger.log({
      user,
      page: "Challan",
      action: "Delete Challan Pre Backup Save",
     
      req,
      message: `[PRE_BACKUP_SAVE] Attempting to save backup for Challan ID: ${challanToBackup._id}.`,
      details: { ...logDetails, originalId: challanToBackup._id },
      level: "debug",
    });
    await newBackupEntry.save();
    logger.log({
      user,
      page: "Challan",
      action: "Delete Challan Backup Success",
     
      req,
      message: `[BACKUP_SUCCESS] Challan successfully backed up. Backup ID: ${newBackupEntry._id}.`,
      details: {
        ...logDetails,
        originalId: challanToBackup._id,
        backupId: newBackupEntry._id,
        backupModel: "UniversalBackup",
      },
      level: "info",
    });

    logger.log({
      user,
      page: "Challan",
      action: "Delete Challan Pre Original Delete",
     
      req,
      message: `[PRE_ORIGINAL_DELETE] Attempting to delete original Challan ID: ${challanToBackup._id}.`,
      details: { ...logDetails, originalId: challanToBackup._id },
      level: "debug",
    });
    await Challan.findByIdAndDelete(challanId);
    logger.log({
      user,
      page: "Challan",
      action: "Delete Challan Original Delete Success",
     
      req,
      message: `[ORIGINAL_DELETE_SUCCESS] Original Challan successfully deleted.`,
      details: { ...logDetails, originalId: challanToBackup._id },
      level: "info",
    });

    res.status(200).json({
      message: "Challan deleted and backed up successfully.",
      originalId: challanToBackup._id,
      backupId: newBackupEntry._id,
    });
  } catch (error) {
    logger.log({
      user,
      page: "Challan",
      action: "Delete Challan Error",
     
      req,
      message: `[DELETE_ERROR] Error during Challan deletion process for ID: ${challanId}.`,
      details: { ...logDetails, error: error.message, stack: error.stack },
      level: "error",
    });
    if (
      error.name === "ValidationError" ||
      !newBackupEntry ||
      (newBackupEntry && newBackupEntry.isNew)
    ) {
      logger.log({
        user,
        page: "Challan",
        action: "Delete Challan Rollback",
       
        req,
        message: `[ROLLBACK_DELETE] Backup failed or error before backup for Challan ID: ${challanId}. Original document will not be deleted.`,
        details: logDetails,
        level: "warn",
      });
    } else {
      const backupExists = await UniversalBackup.findOne({
        originalId: challanId,
      });
      if (backupExists && !(await Challan.findById(challanId))) {
        logger.log({
          user,
          page: "Challan",
          action: "Delete Challan Critical State",
         
          req,
          message: `[CRITICAL_STATE] Challan was backed up (ID: ${backupExists._id}) but original might not have been deleted or error occurred after backup. Manual check recommended.`,
          details: { ...logDetails, backupId: backupExists._id },
          level: "info",
        });
      } else if (backupExists) {
        logger.log({
          user,
          page: "Challan",
          action: "Delete Challan Post Backup Error",
         
          req,
          message: `[DELETE_POST_BACKUP_ERROR] Challan backup (ID: ${backupExists._id}) was created, but an error occurred before original deletion could be confirmed.`,
          details: { ...logDetails, backupId: backupExists._id },
          level: "warn",
        });
      }
    }
    res.status(500).json({
      message:
        "Server error during the deletion process. Please check server logs.",
    });
  }
};
