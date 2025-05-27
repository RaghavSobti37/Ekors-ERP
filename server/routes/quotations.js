const express = require("express");
const router = express.Router();
const Quotation = require("../models/quotation");
const Client = require("../models/client");
const QuotationBackup = require("../models/quotationBackup"); // Import backup model
const auth = require("../middleware/auth");
const logger = require("../utils/logger"); // Import logger

// Create or update quotation
const handleQuotationUpsert = async (req, res) => {
  try {
    const { client: clientInput, ...quotationPayload } = req.body; // clientInput contains client details from FE
    const { id } = req.params;

    // Validate required fields
    if (!quotationPayload.referenceNumber) {
      return res.status(400).json({ message: "Missing quotation reference number" });
    }

    // Check reference number uniqueness for this user
    const refCheck = await Quotation.findOne({
      user: req.user._id,
      referenceNumber: quotationPayload.referenceNumber,
      ...(id && { _id: { $ne: id } }),
    });

    if (refCheck) {
      return res
        .status(400)
        .json({ message: "Reference number already exists for this user" });
    }

    let processedClient; // This will hold the final client Mongoose document

    if (clientInput && clientInput._id) {
      // Client ID is provided by frontend (either selected existing or just saved via "Save New Client")
      processedClient = await Client.findOne({ _id: clientInput._id, user: req.user._id });
      if (!processedClient) {
        return res.status(404).json({ message: "Client not found or does not belong to this user." });
      }
      // Optionally update client details if they were sent and differ.
      // Frontend should make fields read-only after selection/save, but this is a safeguard.
      const { _id, ...updateData } = clientInput;
      if (Object.keys(updateData).length > 0) {
        if (updateData.email) updateData.email = updateData.email.toLowerCase();
        if (updateData.gstNumber) updateData.gstNumber = updateData.gstNumber.toUpperCase();
        
        // Before updating, check for GST conflict if GST number is being changed
        if (updateData.gstNumber && updateData.gstNumber !== processedClient.gstNumber) {
            const gstConflictCheck = await Client.findOne({
                gstNumber: updateData.gstNumber,
                user: req.user._id,
                _id: { $ne: processedClient._id } 
            });
            if (gstConflictCheck) {
                return res.status(400).json({ message: "GST Number conflicts with another existing client.", field: "gstNumber" });
            }
        }
        processedClient = await Client.findByIdAndUpdate(clientInput._id, { ...updateData, user: req.user._id }, { new: true });
      }
    } else if (clientInput && clientInput.email && clientInput.companyName && clientInput.gstNumber && clientInput.phone) {
      // Fallback: No client ID, but full details provided.
      // This path implies frontend didn't use "Save New Client" or an issue occurred.
      // Attempt to find by email or create.
      const normalizedEmail = clientInput.email.toLowerCase();
      const normalizedGst = clientInput.gstNumber.toUpperCase();

      processedClient = await Client.findOne({ email: normalizedEmail, user: req.user._id });
      if (processedClient) { // Found by email
        // Update if details differ, check GST conflict if changing
        if (normalizedGst !== processedClient.gstNumber) {
           const gstConflictCheck = await Client.findOne({ gstNumber: normalizedGst, user: req.user._id, _id: { $ne: processedClient._id } });
           if (gstConflictCheck) return res.status(400).json({ message: "GST Number conflicts with another client.", field: "gstNumber" });
        }
        processedClient = await Client.findByIdAndUpdate(processedClient._id, { ...clientInput, email: normalizedEmail, gstNumber: normalizedGst, user: req.user._id }, { new: true });
      } else { // Not found by email, try to create
        const gstCheck = await Client.findOne({ gstNumber: normalizedGst, user: req.user._id });
        if (gstCheck) {
          return res.status(400).json({ message: "GST Number already exists for another client.", field: "gstNumber" });
        }
        processedClient = new Client({ ...clientInput, email: normalizedEmail, gstNumber: normalizedGst, user: req.user._id });
        await processedClient.save();
      }
    } else {
      return res.status(400).json({ message: "Client information is missing or invalid. Please select or provide full client details." });
    }

    if (!processedClient || !processedClient._id) {
      return res.status(500).json({ message: "Failed to process client information for the quotation." });
    }

    // Prepare quotation data
    const data = {
      ...quotationPayload,
      user: req.user._id,
      date: new Date(quotationPayload.date),
      validityDate: new Date(quotationPayload.validityDate),
      client: processedClient._id, // Link to the processed client's ID
    };

    let quotation;
    if (id) { // Update existing quotation
      quotation = await Quotation.findOneAndUpdate(
        { _id: id, user: req.user._id }, // Ensure user owns the quotation
        data,
        { new: true, runValidators: true }
      );
      if (!quotation) {
        return res.status(404).json({ message: "Quotation not found or you do not have permission to update it." });
      }
    } else { // Create new quotation
      quotation = new Quotation(data);
      await quotation.save();
    }

    const populatedQuotation = await Quotation.findById(quotation._id)
      .populate("client") // Populate with full client details
      .populate("user", "name email firstname lastname") // Added firstname, lastname
      .populate("orderIssuedBy", "firstname lastname");

    // Add quotation reference to the client's list of quotations
    if (populatedQuotation && processedClient) {
      try {
        await Client.findByIdAndUpdate(
          processedClient._id,
          { $addToSet: { quotations: populatedQuotation._id } }
        );
      } catch (clientUpdateError) {
        console.error("Error updating client with quotation ID:", clientUpdateError);
        // Log error, but don't fail the main response
      }
    }
    res.status(id ? 200 : 201).json(populatedQuotation);
  } catch (error) {
    console.error("Error in handleQuotationUpsert:", error);
    if (error.name === 'ValidationError') {
        return res.status(400).json({ message: error.message, errors: error.errors });
    }
    res.status(500).json({ message: error.message || "An unexpected error occurred." });
  }
};

router.get("/next-number", auth, async (req, res) => {
  try {
    // This route seems to be duplicated later. Assuming one is correct.
    // This version uses a sequence generator, which is generally more robust for unique numbers.
    // If 'getNextSequence' is not defined or used elsewhere, the other version might be intended.
    // For now, keeping this one. If `getNextSequence` is not a global helper, this will fail.
    // Let's assume the other /next-number logic (Q-000001 format) is the one to keep if `getNextSequence` is not defined.
    // The duplicate route later seems more specific to quotation number format.
    // Removing this one to avoid conflict and use the specific one below.
    // const nextNumber = await getNextSequence("quotationNumber"); 
    // const nextQuotationNumber = `Q-${String(nextNumber).padStart(6, "0")}`;
    // res.json({ nextQuotationNumber });

    // Using the logic from the duplicated route as it's more specific to quotation format
    const latestQuotation = await Quotation.findOne({})
      .sort({ referenceNumber: -1 }) // This sort might be problematic if ref numbers aren't purely sequential/sortable strings
      .select("referenceNumber");

    let nextNumber = 1;
    if (latestQuotation && latestQuotation.referenceNumber) {
      const match = latestQuotation.referenceNumber.match(/Q-(\d+)/);
      if (match && match[1]) {
        nextNumber = parseInt(match[1], 10) + 1;
      } else {
        // Fallback if parsing fails, try to extract any number part or start fresh
        const numPart = latestQuotation.referenceNumber.replace(/[^0-9]/g, "");
        if (numPart) {
            try {
                nextNumber = parseInt(numPart, 10) + 1;
            } catch (e) { /* ignore, use default nextNumber=1 */ }
        }
      }
    }
    const nextQuotationNumber = `Q-${String(nextNumber).padStart(6, "0")}`;
    res.json({ nextQuotationNumber });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Replace the existing GET /quotations route with this:
router.get("/", auth, async (req, res) => {
  try {
    let query = {};

    // For non-superadmin users, only show their own quotations
    if (req.user.role !== "super-admin") {
      query.user = req.user._id;
    }

    // Handle status filter if provided
    if (req.query.status && req.query.status !== "all") { // Ensure 'all' doesn't filter
      query.status = req.query.status;
    }

    const quotations = await Quotation.find(query)
      .populate("client")
      .populate("user", "firstname lastname email") // Added email
      .sort({ date: -1 });

    res.json(quotations);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching quotations",
      error: error.message,
    });
  }
});

// Create new quotation
router.post("/", auth, handleQuotationUpsert);

// Update quotation
router.put("/:id", auth, handleQuotationUpsert);

// Check reference number availability
router.get("/check-reference", auth, async (req, res) => {
  try {
    const { referenceNumber, excludeId } = req.query;
    if (!referenceNumber) {
        return res.status(400).json({ message: "referenceNumber query parameter is required." });
    }
    const query = {
      user: req.user._id,
      referenceNumber,
    };

    if (excludeId) {
      query._id = { $ne: excludeId };
    }

    const existing = await Quotation.findOne(query);
    res.json({ exists: !!existing });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get single quotation
router.get("/:id", auth, async (req, res) => {
  try {
    let findQuery = { _id: req.params.id };
    // Non-superadmin can only get their own quotations
    if (req.user.role !== 'super-admin') {
        findQuery.user = req.user._id;
    }

    const quotation = await Quotation.findOne(findQuery)
      .populate("client")
      .populate("orderIssuedBy", "firstname lastname");

    if (!quotation) {
      return res.status(404).json({ message: "Quotation not found or access denied." });
    }

    res.json(quotation);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Replace the existing DELETE route with this:
router.delete("/:id", auth, async (req, res) => {
  const quotationId = req.params.id;
  const userId = req.user ? req.user._id : null;
  const userEmail = req.user ? req.user.email : 'N/A';
  const logDetails = { userId, quotationId, model: 'Quotation', operation: 'delete', userEmail };

  logger.info(`[DELETE_INITIATED] Quotation ID: ${quotationId} by User: ${userEmail}.`, logDetails);

  try {
    // Authorization: Only superadmin can delete quotations
    if (req.user.role !== "super-admin") {
      logger.warn(`[AUTH_FAILURE] Unauthorized delete attempt for Quotation ID: ${quotationId} by User: ${userEmail}.`, logDetails);
      return res
        .status(403)
        .json({ message: "Only superadmin can delete quotations" });
    }
    logger.debug(`[FETCH_ATTEMPT] Finding Quotation ID: ${quotationId} for backup and deletion.`, logDetails);
    const quotationToBackup = await Quotation.findById(quotationId);

    if (!quotationToBackup) {
      logger.warn(`[NOT_FOUND] Quotation not found for deletion: ${quotationId}.`, logDetails);
      return res.status(404).json({ message: "Quotation not found or you do not have permission to delete it." });
    }
    logger.debug(`[FETCH_SUCCESS] Found Quotation ID: ${quotationId} (Ref: ${quotationToBackup.referenceNumber}). Preparing for backup.`, { ...logDetails, referenceNumber: quotationToBackup.referenceNumber });

    const backupData = quotationToBackup.toObject();
    const newBackupEntry = new QuotationBackup({
      ...backupData,
      originalId: quotationToBackup._id,
      deletedBy: userId, // User performing the delete
      deletedAt: new Date(),
      originalCreatedAt: quotationToBackup.createdAt,
      originalUpdatedAt: quotationToBackup.updatedAt,
      backupReason: "Admin-initiated deletion via API"
    });

    logger.debug(`[PRE_BACKUP_SAVE] Attempting to save backup for Quotation ID: ${quotationToBackup._id}.`, { ...logDetails, originalId: quotationToBackup._id });
    await newBackupEntry.save();
    logger.info(`[BACKUP_SUCCESS] Quotation successfully backed up. Backup ID: ${newBackupEntry._id}.`, { ...logDetails, originalId: quotationToBackup._id, backupId: newBackupEntry._id, backupModel: 'QuotationBackup' });

    logger.debug(`[PRE_ORIGINAL_DELETE] Attempting to delete original Quotation ID: ${quotationToBackup._id}.`, { ...logDetails, originalId: quotationToBackup._id });
    await Quotation.findByIdAndDelete(quotationId);
    logger.info(`[ORIGINAL_DELETE_SUCCESS] Original Quotation successfully deleted.`, { ...logDetails, originalId: quotationToBackup._id });

    // If quotation had a client, remove this quotation from that client's list
    if (quotationToBackup.client) {
      try {
        await Client.findByIdAndUpdate(quotationToBackup.client, {
          $pull: { quotations: quotationToBackup._id },
        });
        logger.info(`[CLIENT_REF_REMOVE_SUCCESS] Removed quotation reference ${quotationToBackup._id} from Client ID: ${quotationToBackup.client}.`, { ...logDetails, targetModel: 'Client', targetClientId: quotationToBackup.client.toString() });
      } catch (clientUpdateError) {
        logger.error(`[CLIENT_REF_REMOVE_ERROR] Error removing quotation reference ${quotationToBackup._id} from Client ID: ${quotationToBackup.client}.`, clientUpdateError, { ...logDetails, targetModel: 'Client', targetClientId: quotationToBackup.client.toString() });
      }
    }

    res.status(200).json({
      message: "Quotation deleted and backed up successfully.",
      originalId: quotationToBackup._id,
      backupId: newBackupEntry._id
    });

  } catch (error) {
    logger.error(`[DELETE_ERROR] Error during Quotation deletion process for ID: ${quotationId} by ${userEmail}.`, error, logDetails);
    if (error.name === 'ValidationError' || (typeof quotationToBackup === 'undefined' || (quotationToBackup && (!newBackupEntry || newBackupEntry.isNew)))) {
        logger.warn(`[ROLLBACK_DELETE] Backup failed or error before backup for Quotation ID: ${quotationId}. Original document will not be deleted.`, logDetails);
    }
    res.status(500).json({ message: "Server error during the deletion process. Please check server logs." });
  }
});

module.exports = router;