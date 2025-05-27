const express = require("express");
const router = express.Router();
const Quotation = require("../models/quotation");
const Client = require("../models/client");
const QuotationBackup = require("../models/quotationBackup");
const auth = require("../middleware/auth");
const logger = require("../utils/logger");

const handleQuotationUpsert = async (req, res) => {
  let operation;
  try {
    const { client: clientInput, ...quotationPayload } = req.body;
    const { id } = req.params;

    const user = req.user || null;
    operation = id ? 'update' : 'create';
    const logDetails = { 
      userId: req.user._id, 
      operation, 
      quotationId: id, 
      referenceNumber: quotationPayload.referenceNumber 
    };

    if (!quotationPayload.referenceNumber) {
      logger.warn('quotation', `Missing reference number during quotation ${operation}`, user, logDetails);
      return res.status(400).json({ message: "Missing quotation reference number" });
    }

    const refCheck = await Quotation.findOne({
      user: req.user._id,
      referenceNumber: quotationPayload.referenceNumber,
      ...(id && { _id: { $ne: id } }),
    });

    if (refCheck) {
      logger.warn('quotation', `Reference number already exists for user`, user, logDetails);
      return res.status(400).json({ message: "Reference number already exists for this user" });
    }

    let processedClient;

    if (clientInput && clientInput._id) {
      processedClient = await Client.findOne({ _id: clientInput._id, user: req.user._id });
      logger.debug('quotation', `Processing client with ID: ${clientInput._id} for quotation ${operation}`, user, { ...logDetails, clientId: clientInput._id });
      if (!processedClient) {
        return res.status(404).json({ message: "Client not found or does not belong to this user." });
      }

      const { _id, ...updateData } = clientInput;
      if (Object.keys(updateData).length > 0) {
        if (updateData.email) updateData.email = updateData.email.toLowerCase();
        if (updateData.gstNumber) updateData.gstNumber = updateData.gstNumber.toUpperCase();
        
        if (updateData.gstNumber && updateData.gstNumber !== processedClient.gstNumber) {
          const gstConflictCheck = await Client.findOne({
            gstNumber: updateData.gstNumber,
            user: req.user._id,
            _id: { $ne: processedClient._id } 
          });
          if (gstConflictCheck) {
            logger.warn('quotation', `GST Number conflict during client update for quotation ${operation}`, user, { ...logDetails, clientId: processedClient._id, gstNumber: updateData.gstNumber });
            return res.status(400).json({ message: "GST Number conflicts with another existing client.", field: "gstNumber" });
          }
        }
        processedClient = await Client.findByIdAndUpdate(clientInput._id, { ...updateData, user: req.user._id }, { new: true });
      }
    } else if (clientInput && clientInput.email && clientInput.companyName && clientInput.gstNumber && clientInput.phone) {
      const normalizedEmail = clientInput.email.toLowerCase();
      const normalizedGst = clientInput.gstNumber.toUpperCase();

      logger.debug('quotation', `Processing new/potential client details for quotation ${operation}`, user, { ...logDetails, clientEmail: normalizedEmail, clientGst: normalizedGst });
      processedClient = await Client.findOne({ email: normalizedEmail, user: req.user._id });
      if (processedClient) {
        logger.debug('quotation', `Found existing client by email: ${normalizedEmail}`, user, { ...logDetails, clientId: processedClient._id });
        if (normalizedGst !== processedClient.gstNumber) {
          const gstConflictCheck = await Client.findOne({ gstNumber: normalizedGst, user: req.user._id, _id: { $ne: processedClient._id } });
          if (gstConflictCheck) return res.status(400).json({ message: "GST Number conflicts with another client.", field: "gstNumber" });
        }
        processedClient = await Client.findByIdAndUpdate(processedClient._id, { ...clientInput, email: normalizedEmail, gstNumber: normalizedGst, user: req.user._id }, { new: true });
        logger.info('quotation', `Updated existing client for quotation ${operation}`, user, { ...logDetails, clientId: processedClient._id });
      } else {
        const gstCheck = await Client.findOne({ gstNumber: normalizedGst, user: req.user._id });
        if (gstCheck) {
          logger.warn('quotation', `GST Number already exists for another client during new client creation attempt`, user, { ...logDetails, clientGst: normalizedGst });
          return res.status(400).json({ message: "GST Number already exists for another client.", field: "gstNumber" });
        }
        processedClient = new Client({ ...clientInput, email: normalizedEmail, gstNumber: normalizedGst, user: req.user._id });
        await processedClient.save();
      }
    } else {
      logger.warn('quotation', `Missing or invalid client information during quotation ${operation}`, user, logDetails);
      return res.status(400).json({ message: "Client information is missing or invalid. Please select or provide full client details." });
    }

    if (!processedClient || !processedClient._id) {
      return res.status(500).json({ message: "Failed to process client information for the quotation." });
    }

    const data = {
      ...quotationPayload,
      user: req.user._id,
      date: new Date(quotationPayload.date),
      validityDate: new Date(quotationPayload.validityDate),
      client: processedClient._id,
    };

    let quotation;
    if (id) {
      quotation = await Quotation.findOneAndUpdate(
        { _id: id, user: req.user._id },
        data,
        { new: true, runValidators: true }
      );
      logger.info('quotation', `Quotation updated successfully`, user, { ...logDetails, quotationId: quotation._id, clientId: processedClient._id });

      if (!quotation) {
        return res.status(404).json({ message: "Quotation not found or you do not have permission to update it." });
      }
    } else {
      quotation = new Quotation(data);
      await quotation.save();
      logger.info('quotation', `Quotation created successfully`, user, { ...logDetails, quotationId: quotation._id, clientId: processedClient._id });
    }

    const populatedQuotation = await Quotation.findById(quotation._id)
      .populate("client")
      .populate("user", "name email firstname lastname")
      .populate("orderIssuedBy", "firstname lastname");

    if (populatedQuotation && processedClient) {
      try {
        await Client.findByIdAndUpdate(
          processedClient._id,
          { $addToSet: { quotations: populatedQuotation._id } }
        );
        logger.debug('quotation', `Added quotation reference ${populatedQuotation._id} to client ${processedClient._id}`, user, { ...logDetails, clientId: processedClient._id });
      } catch (clientUpdateError) {
        logger.error('quotation', `Error adding quotation reference ${populatedQuotation._id} to client ${processedClient._id}`, clientUpdateError, user, { ...logDetails, clientId: processedClient._id });
      }
    }
    res.status(id ? 200 : 201).json(populatedQuotation);
  } catch (error) {
    logger.error('quotation', `Error during quotation ${operation} process`, error, req.user, logDetails);
    console.error("Error in handleQuotationUpsert:", error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message, errors: error.errors });
    }
    res.status(500).json({ message: error.message || "An unexpected error occurred." });
  }
};

router.get("/next-number", auth, async (req, res) => {
  try {
    const latestQuotation = await Quotation.findOne({})
      .sort({ referenceNumber: -1 })
      .select("referenceNumber");

    let nextNumber = 1;
    if (latestQuotation && latestQuotation.referenceNumber) {
      const match = latestQuotation.referenceNumber.match(/Q-(\d+)/);
      if (match && match[1]) {
        nextNumber = parseInt(match[1], 10) + 1;
      } else {
        const numPart = latestQuotation.referenceNumber.replace(/[^0-9]/g, "");
        if (numPart) {
          try {
            nextNumber = parseInt(numPart, 10) + 1;
          } catch (e) { }
        }
      }
    }
    const nextQuotationNumber = `Q-${String(nextNumber).padStart(6, "0")}`;
    res.json({ nextQuotationNumber });
  } catch (error) {
    res.status(500).json({ message: error.message });
    logger.error('quotation', `Failed to generate next quotation number`, error, req.user);
  }
});

router.get("/", auth, async (req, res) => {
  try {
    let query = {};
    const user = req.user || null;

    if (req.user.role !== "super-admin") {
      query.user = req.user._id;
    }

    if (req.query.status && req.query.status !== "all") {
      query.status = req.query.status;
    }

    const quotations = await Quotation.find(query)
      .populate("client")
      .populate("user", "firstname lastname email")
      .sort({ date: -1 });

    res.json(quotations);
  } catch (error) {
    logger.error('quotation', `Failed to fetch all accessible quotations`, error, req.user, { query: req.query });
    res.status(500).json({
      message: "Error fetching quotations",
      error: error.message,
    });
  }
});

router.post("/", auth, handleQuotationUpsert);
router.put("/:id", auth, handleQuotationUpsert);

router.get("/check-reference", auth, async (req, res) => {
  try {
    const { referenceNumber, excludeId } = req.query;
    const user = req.user || null;
    if (!referenceNumber) {
      return res.status(400).json({ message: "referenceNumber query parameter is required." });
    }
    const query = {
      user: req.user._id,
      referenceNumber,
      ...(excludeId && { _id: { $ne: excludeId } }),
    };

    const existing = await Quotation.findOne(query);
    res.json({ exists: !!existing });
  } catch (error) {
    res.status(500).json({ message: error.message });
    logger.error('quotation', `Failed to check reference number availability`, error, user, { query });
  }
});

router.get("/:id", auth, async (req, res) => {
  try {
    let findQuery = { _id: req.params.id };
    const user = req.user || null;

    if (req.user.role !== 'super-admin') {
      findQuery.user = req.user._id;
    }

    const quotation = await Quotation.findOne(findQuery)
      .populate("client")
      .populate("orderIssuedBy", "firstname lastname");

    if (!quotation) {
      logger.warn('quotation', `Quotation not found or access denied: ${req.params.id}`, user, { findQuery });
      return res.status(404).json({ message: "Quotation not found or access denied." });
    }

    res.json(quotation);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete("/:id", auth, async (req, res) => {
  const quotationId = req.params.id;
  const userId = req.user ? req.user._id : null;
  const userEmail = req.user ? req.user.email : 'N/A';
  const user = req.user || null;
  const logDetails = { userId, quotationId, model: 'Quotation', userEmail };

  logger.info('delete', `[DELETE_INITIATED] Quotation ID: ${quotationId} by User: ${userEmail}.`, user, logDetails);

  try {
    if (req.user.role !== "super-admin") {
      logger.warn('delete', `[AUTH_FAILURE] Unauthorized delete attempt for Quotation ID: ${quotationId} by User: ${userEmail}.`, user, logDetails);
      return res.status(403).json({ message: "Only superadmin can delete quotations" });
    }

    const quotationToBackup = await Quotation.findById(quotationId);
    if (!quotationToBackup) {
      logger.warn('delete', `[NOT_FOUND] Quotation not found for deletion: ${quotationId}.`, logDetails);
      return res.status(404).json({ message: "Quotation not found or you do not have permission to delete it." });
    }

    const backupData = quotationToBackup.toObject();
    const newBackupEntry = new QuotationBackup({
      ...backupData,
      originalId: quotationToBackup._id,
      deletedBy: userId,
      deletedAt: new Date(),
      originalCreatedAt: quotationToBackup.createdAt,
      originalUpdatedAt: quotationToBackup.updatedAt,
      backupReason: "Admin-initiated deletion via API"
    });

    await newBackupEntry.save();
    await Quotation.findByIdAndDelete(quotationId);

    if (quotationToBackup.client) {
      try {
        await Client.findByIdAndUpdate(quotationToBackup.client, {
          $pull: { quotations: quotationToBackup._id },
        });
      } catch (clientUpdateError) {
        logger.error('delete', `[CLIENT_REF_REMOVE_ERROR] Error removing quotation reference ${quotationToBackup._id} from Client ID: ${quotationToBackup.client}.`, clientUpdateError, user, { ...logDetails, targetClientId: quotationToBackup.client.toString() });
      }
    }

    res.status(200).json({
      message: "Quotation deleted and backed up successfully.",
      originalId: quotationToBackup._id,
      backupId: newBackupEntry._id
    });

  } catch (error) {
    logger.error('delete', `[DELETE_ERROR] Error during Quotation deletion process for ID: ${quotationId} by ${userEmail}.`, error, user, logDetails);
    res.status(500).json({ message: "Server error during the deletion process. Please check server logs." });
  }
});

module.exports = router;