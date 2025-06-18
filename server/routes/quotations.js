const express = require("express");
const router = express.Router();
const Quotation = require("../models/quotation");
const Client = require("../models/client");
const QuotationBackup = require("../models/quotationBackup");
const auth = require("../middleware/auth");
const logger = require("../utils/logger");
const { generateQuotationsReport } = require("../controllers/reportController");
const excelJS = require("exceljs");
const Ticket = require("../models/opentickets"); // Import Ticket model

const handleQuotationUpsert = async (req, res) => {
  let operation;
  let logDetails = {}; // Initialize logDetails
  try {
    // Destructure billingAddress from quotationPayload
    const { client: clientInput, billingAddress, ...quotationDetails } = req.body;
    const quotationPayload = { ...quotationDetails, billingAddress }; // Re-include billingAddress

    const { id } = req.params;
    const user = req.user || null; // Ensure user is available for logging even if auth fails (though auth middleware should handle)
    operation = id ? "update" : "create";
    logDetails = { // Assign here after user and operation are defined
      userId: user ? user._id : null, // Safely access user._id
      operation,
      quotationId: id,
      referenceNumber: quotationPayload.referenceNumber,
    };

    if (!quotationPayload.referenceNumber) {
      logger.warn(
        "quotation",
        `Missing reference number during quotation ${operation}`,
        user,
        logDetails
      );
      return res
        .status(400)
        .json({ message: "Missing quotation reference number" });
    }

    const refCheckQuery = {
      user: req.user._id,
      referenceNumber: quotationPayload.referenceNumber,
    };
    if (id) {
      refCheckQuery._id = { $ne: id };
    }
    const refCheck = await Quotation.findOne(refCheckQuery);


    if (refCheck) {
      logger.warn(
        "quotation",
        `Reference number already exists for user`,
        user,
        logDetails
      );
      return res
        .status(400)
        .json({ message: "Reference number already exists for this user" });
    }

    let processedClient;

    if (clientInput && clientInput._id) {
      processedClient = await Client.findOne({
        _id: clientInput._id,
        user: req.user._id,
      });
      logger.debug(
        "quotation",
        `Processing client with ID: ${clientInput._id} for quotation ${operation}`,
        user,
        { ...logDetails, clientId: clientInput._id }
      );
      if (!processedClient) {
        return res
          .status(404)
          .json({
            message: "Client not found or does not belong to this user.",
          });
      }

      const { _id, ...updateData } = clientInput;
      if (Object.keys(updateData).length > 0) {
        if (updateData.email) updateData.email = updateData.email.toLowerCase();
        if (updateData.gstNumber)
          updateData.gstNumber = updateData.gstNumber.toUpperCase();

        if (
          updateData.gstNumber &&
          updateData.gstNumber !== processedClient.gstNumber
        ) {
          const gstConflictCheck = await Client.findOne({
            gstNumber: updateData.gstNumber,
            user: req.user._id,
            _id: { $ne: processedClient._id },
          });
          if (gstConflictCheck) {
            logger.warn(
              "quotation",
              `GST Number conflict during client update for quotation ${operation}`,
              user,
              {
                ...logDetails,
                clientId: processedClient._id,
                gstNumber: updateData.gstNumber,
              }
            );
            return res
              .status(400)
              .json({
                message: "GST Number conflicts with another existing client.",
                field: "gstNumber",
              });
          }
        }
        // Ensure user field is not accidentally overwritten if present in updateData
        const clientUpdatePayload = { ...updateData };
        delete clientUpdatePayload.user; // Prevent user field from being changed here

        processedClient = await Client.findByIdAndUpdate(
          clientInput._id,
          { ...clientUpdatePayload, user: req.user._id }, // Explicitly set user from auth
          { new: true, runValidators: true }
        );
      }
    } else if (
      clientInput &&
      clientInput.email &&
      clientInput.companyName &&
      clientInput.gstNumber &&
      clientInput.phone
    ) {
      const normalizedEmail = clientInput.email.toLowerCase();
      const normalizedGst = clientInput.gstNumber.toUpperCase();

      logger.debug(
        "quotation",
        `Processing new/potential client details for quotation ${operation}`,
        user,
        {
          ...logDetails,
          clientEmail: normalizedEmail,
          clientGst: normalizedGst,
        }
      );
      processedClient = await Client.findOne({
        email: normalizedEmail,
        user: req.user._id,
      });
      if (processedClient) {
        logger.debug(
          "quotation",
          `Found existing client by email: ${normalizedEmail}`,
          user,
          { ...logDetails, clientId: processedClient._id }
        );
        if (normalizedGst !== processedClient.gstNumber) {
          const gstConflictCheck = await Client.findOne({
            gstNumber: normalizedGst,
            user: req.user._id,
            _id: { $ne: processedClient._id },
          });
          if (gstConflictCheck)
            return res
              .status(400)
              .json({
                message: "GST Number conflicts with another client.",
                field: "gstNumber",
              });
        }
        // Ensure user field is not accidentally overwritten
        const clientUpdatePayload = { ...clientInput };
        delete clientUpdatePayload.user;

        processedClient = await Client.findByIdAndUpdate(
          processedClient._id,
          {
            ...clientUpdatePayload,
            email: normalizedEmail,
            gstNumber: normalizedGst,
            user: req.user._id, // Explicitly set user from auth
          },
          { new: true, runValidators: true }
        );
        logger.info(
          "quotation",
          `Updated existing client for quotation ${operation}`,
          user,
          { ...logDetails, clientId: processedClient._id }
        );
      } else {
        const gstCheck = await Client.findOne({
          gstNumber: normalizedGst,
          user: req.user._id,
        });
        if (gstCheck) {
          logger.warn(
            "quotation",
            `GST Number already exists for another client during new client creation attempt`,
            user,
            { ...logDetails, clientGst: normalizedGst }
          );
          return res
            .status(400)
            .json({
              message: "GST Number already exists for another client.",
              field: "gstNumber",
            });
        }
        processedClient = new Client({
          ...clientInput,
          email: normalizedEmail,
          gstNumber: normalizedGst,
          user: req.user._id,
        });
        await processedClient.save();
        logger.info(
          "quotation",
          `Created new client for quotation ${operation}`,
          user,
          { ...logDetails, clientId: processedClient._id }
        );
      }
    } else {
      logger.warn(
        "quotation",
        `Missing or invalid client information during quotation ${operation}`,
        user,
        logDetails
      );
      return res
        .status(400)
        .json({
          message:
            "Client information is missing or invalid. Please select or provide full client details.",
        });
    }

    if (!processedClient || !processedClient._id) {
      logger.error(
        "quotation",
        `Client processing failed unexpectedly for quotation ${operation}`,
        user,
        logDetails
      );
      return res
        .status(500)
        .json({
          message: "Failed to process client information for the quotation.",
        });
    }

    const processedBillingAddress = typeof billingAddress === 'object' && billingAddress !== null
                                      ? billingAddress
                                      : { address1: '', address2: '', city: '', state: '', pincode: '' };

    const data = {
      ...quotationPayload,
      user: req.user._id,
      date: new Date(quotationPayload.date),
      validityDate: new Date(quotationPayload.validityDate),
      client: processedClient._id,
      billingAddress: processedBillingAddress,
    };

    let quotation;
    if (id) {
      const existingQuotation = await Quotation.findOne({
        _id: id,
        user: req.user._id,
      });
      if (!existingQuotation) {
        logger.warn(
          "quotation",
          `Update failed: Quotation ${id} not found or user ${req.user._id} not authorized.`,
          user,
          logDetails
        );
        return res
          .status(404)
          .json({
            message:
              "Quotation not found or you do not have permission to update it.",
          });
      }

      if (
        quotationPayload.status &&
        quotationPayload.status !== existingQuotation.status
      ) {
        if (
          existingQuotation.status === "running" ||
          existingQuotation.status === "closed"
        ) {
          logger.warn(
            "quotation",
            `Attempt to change system-managed status for quotation ${id}. Current: ${existingQuotation.status}, Attempted: ${quotationPayload.status}`,
            user,
            logDetails
          );
          return res
            .status(400)
            .json({
              message: `Cannot manually change status from '${existingQuotation.status}'. It is system-managed.`,
            });
        }
        if (!["open", "hold"].includes(quotationPayload.status)) {
          logger.warn(
            "quotation",
            `Invalid status update attempt for quotation ${id}. Attempted: ${quotationPayload.status}`,
            user,
            logDetails
          );
          return res
            .status(400)
            .json({
              message:
                "Status can only be manually changed to 'open' or 'hold'.",
            });
        }
        // Valid manual status change is in 'data' via quotationPayload
      } else if (quotationPayload.hasOwnProperty("status") && quotationPayload.status === existingQuotation.status) {
        // If status in payload is same as existing, no change, so remove from data if it was spread from quotationPayload
        // This ensures data.status is not unnecessarily set if it's not changing.
        // However, if it's intentionally being set to the same value, this logic might be too aggressive.
        // For simplicity and to ensure intended updates, it might be better to let it be part of 'data'.
        // The current logic is: if status is provided and same, it's in 'data'. If not provided, it's not in 'data'.
      } else if (!quotationPayload.hasOwnProperty("status")) {
        // If status is not in payload, ensure it's not accidentally removed from 'data'
        data.status = existingQuotation.status; // Keep existing status
      }


      quotation = await Quotation.findOneAndUpdate(
        { _id: id, user: req.user._id },
        data,
        { new: true, runValidators: true }
      );

      if (!quotation) {
        // This case might be redundant due to the existingQuotation check, but good for safety.
        logger.warn(
          "quotation",
          `Update failed after initial check for quotation ${id}.`,
          user,
          logDetails
        );
        return res
          .status(404)
          .json({
            message:
              "Quotation not found during update or permission issue.",
          });
      }
    } else {
      quotation = new Quotation(data);
      await quotation.save();
    }

    const logMessage = id
      ? "Quotation updated successfully"
      : "Quotation created successfully";
    logger.info("quotation", logMessage, user, {
      ...logDetails,
      quotationId: quotation._id,
      clientId: processedClient._id,
    });

    const populatedQuotation = await Quotation.findById(quotation._id)
      .populate("client")
      .populate("user", "name email firstname lastname")
      .populate("orderIssuedBy", "firstname lastname");

    if (populatedQuotation && processedClient) {
      try {
        await Client.findByIdAndUpdate(processedClient._id, {
          $addToSet: { quotations: populatedQuotation._id },
        });
        logger.debug(
          "quotation",
          `Added quotation reference ${populatedQuotation._id} to client ${processedClient._id}`,
          user,
          { ...logDetails, quotationIdFromOp: populatedQuotation._id, clientId: processedClient._id }
        );
      } catch (clientUpdateError) {
        logger.error(
          "quotation",
          `Error adding quotation reference ${populatedQuotation._id} to client ${processedClient._id}`,
          clientUpdateError,
          user,
          { ...logDetails, quotationIdFromOp: populatedQuotation._id, clientId: processedClient._id }
        );
      }
    }
        // If quotation was updated, sync relevant data to linked tickets
    if (id && quotation) {
      try {
        const linkedTickets = await Ticket.find({ quotationNumber: quotation.referenceNumber });
        if (linkedTickets.length > 0) {
          logger.info("quotation-ticket-sync", `Found ${linkedTickets.length} tickets linked to quotation ${quotation.referenceNumber} for syncing.`, user, { quotationId: quotation._id });
          
          const quotationClient = quotation.client; // Assuming client is populated or is an ID
          const quotationBillingAddress = quotation.billingAddress || {};

          for (const ticket of linkedTickets) {
            const ticketUpdatePayload = {
              companyName: quotationClient?.companyName || ticket.companyName,
              client: quotationClient?._id || ticket.client,
              clientPhone: quotationClient?.phone || ticket.clientPhone,
              clientGstNumber: quotationClient?.gstNumber || ticket.clientGstNumber,
              billingAddress: [
                quotationBillingAddress.address1 || "",
                quotationBillingAddress.address2 || "",
                quotationBillingAddress.state || "",
                quotationBillingAddress.city || "",
                quotationBillingAddress.pincode || "",
              ],
              // Goods sync: This is a direct overwrite. Consider conditional logic if needed.
              goods: quotation.goods.map(g => ({...g, _id: undefined})), // Ensure goods don't carry over old _id if schema differs
              totalQuantity: quotation.totalQuantity,
              totalAmount: quotation.totalAmount,
              // Assuming ticket's GST/grandTotal will be recalculated based on new goods/amounts
              // or you can explicitly set them if quotation has final calculated values.
              // For simplicity, let's assume ticket recalculates.
              termsAndConditions: quotation.termsAndConditions || ticket.termsAndConditions,
              dispatchDays: quotation.dispatchDays || ticket.dispatchDays,
              validityDate: quotation.validityDate ? new Date(quotation.validityDate).toISOString() : ticket.validityDate,
            };

            // If shippingSameAsBilling is true on the ticket, update its shippingAddress too
            if (ticket.shippingSameAsBilling) {
                ticketUpdatePayload.shippingAddress = [...ticketUpdatePayload.billingAddress];
            }

            await Ticket.findByIdAndUpdate(ticket._id, { $set: ticketUpdatePayload });
            logger.info("quotation-ticket-sync", `Synced ticket ${ticket.ticketNumber} with updated quotation ${quotation.referenceNumber}.`, user, { ticketId: ticket._id });
          }
        }
      } catch (syncError) {
        logger.error("quotation-ticket-sync", `Error syncing tickets for quotation ${quotation.referenceNumber}: ${syncError.message}`, user, { quotationId: quotation._id, error: syncError });
      }
    }
    res.status(id ? 200 : 201).json(populatedQuotation);
  } catch (error) {
    logger.error(
      "quotation",
      `Error during quotation ${operation || 'unknown'} process`, // Ensure operation is defined
      error,
      req.user, // req.user might be null if auth middleware failed or wasn't hit
      logDetails // logDetails might be partially initialized
    );
    console.error(`Error in handleQuotationUpsert (${operation || 'unknown'}):`, error); // Log to console for immediate visibility
    if (error.name === "ValidationError") {
      return res
        .status(400)
        .json({ message: error.message, errors: error.errors });
    }
    res
      .status(500)
      .json({ message: error.message || "An unexpected error occurred." });
  }
};

router.get("/next-number", auth, async (req, res) => {
  try {
    const latestQuotation = await Quotation.findOne({})
      .sort({ referenceNumber: -1 }) // This might not give the true "latest" if format varies wildly
      .select("referenceNumber");

    let nextNumber = 1;
    // A more robust way to get the next number might involve a dedicated sequence collection or more complex parsing.
    // For "Q-000001" format:
    if (latestQuotation && latestQuotation.referenceNumber) {
      const match = latestQuotation.referenceNumber.match(/Q-(\d+)/);
      if (match && match[1]) {
        nextNumber = parseInt(match[1], 10) + 1;
      } else {
        // Fallback for other potential formats, less reliable
        const numPart = latestQuotation.referenceNumber.replace(/[^0-9]/g, "");
        if (numPart) {
          try {
            nextNumber = parseInt(numPart, 10) + 1;
          } catch (e) {
            logger.warn("quotation", "Failed to parse number from latest reference for next-number", e, req.user);
          }
        }
      }
    }
    const nextQuotationNumber = `Q-${String(nextNumber).padStart(6, "0")}`;
    res.json({ nextQuotationNumber });
  } catch (error) {
    logger.error(
      "quotation",
      `Failed to generate next quotation number`,
      error,
      req.user
    );
    res.status(500).json({ message: error.message });
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

    if (req.query.search) {
      const searchTerm = req.query.search;
      const searchRegex = { $regex: searchTerm, $options: "i" };

      const clientQuery = {
        companyName: searchRegex,
      };
      if (req.user.role !== "super-admin") {
        clientQuery.user = req.user._id;
      }
      const matchingClients = await Client.find(clientQuery).select("_id");
      const clientIds = matchingClients.map((c) => c._id);

      query.$or = [{ referenceNumber: searchRegex }];
      if (clientIds.length > 0) {
        query.$or.push({ client: { $in: clientIds } });
      }
      // Add search by goods description or HSN if needed
      // query.$or.push({ "goods.description": searchRegex });
      // query.$or.push({ "goods.hsnSacCode": searchRegex });
    }

    const quotations = await Quotation.find(query)
      .populate("client", "companyName gstNumber email phone clientName _id")
      .populate("user", "firstname lastname email")
      .populate("orderIssuedBy", "firstname lastname")
      .sort({ createdAt: -1 });

    res.json(quotations);
  } catch (error) {
    logger.error(
      "quotation",
      `Failed to fetch all accessible quotations`,
      error,
      req.user,
      { queryParams: req.query }
    );
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
    const user = req.user || null; // For logging
    if (!referenceNumber) {
      return res
        .status(400)
        .json({ message: "referenceNumber query parameter is required." });
    }
    const query = {
      user: req.user._id, // Check only for the current user
      referenceNumber,
    };
    if (excludeId) {
      query._id = { $ne: excludeId };
    }

    const existing = await Quotation.findOne(query);
    res.json({ exists: !!existing });
  } catch (error) {
    logger.error(
      "quotation",
      `Failed to check reference number availability`,
      error,
      req.user, // Use req.user for consistency in logging
      { queryParams: req.query }
    );
    res.status(500).json({ message: error.message });
  }
});

router.get("/:id", auth, async (req, res) => {
  try {
    let findQuery = { _id: req.params.id };
    const user = req.user || null;

    if (req.user.role !== "super-admin") {
      findQuery.user = req.user._id;
    }

    const quotation = await Quotation.findOne(findQuery)
      .populate("client")
      .populate("user", "firstname lastname email") // Added user populate
      .populate("orderIssuedBy", "firstname lastname");

    if (!quotation) {
      logger.warn(
        "quotation",
        `Quotation not found or access denied: ${req.params.id}`,
        user,
        { queryDetails: findQuery }
      );
      return res
        .status(404)
        .json({ message: "Quotation not found or access denied." });
    }

    res.json(quotation);
  } catch (error) {
    logger.error(
      "quotation",
      `Failed to fetch quotation by ID: ${req.params.id}`,
      error,
      req.user
    );
    res.status(500).json({ message: error.message });
  }
});

router.delete("/:id", auth, async (req, res) => {
  const quotationId = req.params.id;
  const user = req.user || { _id: 'unknown', email: 'unknown' }; // Fallback for logging if req.user is somehow undefined
  const logDetails = { userId: user._id, quotationId, model: "Quotation", userEmail: user.email };

  logger.info(
    "delete",
    `[DELETE_INITIATED] Quotation ID: ${quotationId} by User: ${user.email}.`,
    user,
    logDetails
  );

  try {
    if (req.user.role !== "super-admin") {
      logger.warn(
        "delete",
        `[AUTH_FAILURE] Unauthorized delete attempt for Quotation ID: ${quotationId} by User: ${user.email}.`,
        user,
        logDetails
      );
      return res
        .status(403)
        .json({ message: "Only superadmin can delete quotations" });
    }

    const quotationToBackup = await Quotation.findById(quotationId);
    if (!quotationToBackup) {
      logger.warn(
        "delete",
        `[NOT_FOUND] Quotation not found for deletion: ${quotationId}.`,
        user, // Pass user object
        logDetails
      );
      return res
        .status(404)
        .json({
          message:
            "Quotation not found.",
        });
    }

    const backupData = quotationToBackup.toObject();
    const newBackupEntry = new QuotationBackup({
      ...backupData,
      originalId: quotationToBackup._id,
      deletedBy: user._id,
      deletedAt: new Date(),
      originalCreatedAt: quotationToBackup.createdAt,
      originalUpdatedAt: quotationToBackup.updatedAt,
      backupReason: "Admin-initiated deletion via API",
    });

    await newBackupEntry.save();
    await Quotation.findByIdAndDelete(quotationId);

    if (quotationToBackup.client) {
      try {
        await Client.findByIdAndUpdate(quotationToBackup.client, {
          $pull: { quotations: quotationToBackup._id },
        });
        logger.info(
          "delete",
          `[CLIENT_REF_REMOVED] Quotation reference ${quotationToBackup._id} removed from Client ID: ${quotationToBackup.client}.`,
          user,
          { ...logDetails, targetClientId: quotationToBackup.client.toString() }
        );
      } catch (clientUpdateError) {
        logger.error(
          "delete",
          `[CLIENT_REF_REMOVE_ERROR] Error removing quotation reference ${quotationToBackup._id} from Client ID: ${quotationToBackup.client}.`,
          clientUpdateError,
          user,
          { ...logDetails, targetClientId: quotationToBackup.client.toString() }
        );
      }
    }
    logger.info(
      "delete",
      `[DELETE_SUCCESS] Quotation ID: ${quotationId} deleted and backed up successfully by User: ${user.email}. Backup ID: ${newBackupEntry._id}`,
      user,
      { ...logDetails, backupId: newBackupEntry._id }
    );
    res.status(200).json({
      message: "Quotation deleted and backed up successfully.",
      originalId: quotationToBackup._id,
      backupId: newBackupEntry._id,
    });
  } catch (error) {
    logger.error(
      "delete",
      `[DELETE_ERROR] Error during Quotation deletion process for ID: ${quotationId} by ${user.email}.`,
      error,
      user,
      logDetails
    );
    res
      .status(500)
      .json({
        message:
          "Server error during the deletion process. Please check server logs.",
      });
  }
});

router.get("/report/summary", auth, generateQuotationsReport);
router.get("/report/excel", auth, (req, res, next) => {
  req.query.exportToExcel = "true";
  generateQuotationsReport(req, res, next);
});

// GET a quotation by its reference number
router.get("/by-reference/:refNumber", auth, async (req, res) => {
  try {
    const { refNumber } = req.params;
    const user = req.user; // For user context in query if needed

    // Find the quotation.
    // If quotations are user-specific, you might need to include user in the query:
    // const quotation = await Quotation.findOne({ referenceNumber: refNumber, user: user._id });
    // If referenceNumbers are globally unique or accessible by users who can see the ticket:
    const quotation = await Quotation.findOne({
      referenceNumber: refNumber,
    });

    if (!quotation) {
      logger.warn("quotation", `Quotation not found by reference: ${refNumber}`, user);
      return res.status(404).json({ message: "Quotation not found." });
    }

    // Optionally populate client or other details if needed by the QuotationFormPage
    // For this use case, just returning the quotation with its _id is sufficient
    // as the QuotationFormPage will fetch full details if it navigates there.
    // const populatedQuotation = await Quotation.findById(quotation._id).populate('client');
    // res.json(populatedQuotation);

    res.json(quotation); // Send back the quotation object (must include _id)

  } catch (error) {
    logger.error("quotation", `Error fetching quotation by reference: ${req.params.refNumber}`, error, req.user);
    res.status(500).json({ message: "Failed to fetch quotation details.", error: error.message });
  }
});

module.exports = router;
