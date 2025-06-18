const Quotation = require("../models/quotation");
const Client = require("../models/client");
const UniversalBackup = require("../models/universalBackup"); // Using UniversalBackup
const Ticket = require("../models/opentickets");
const logger = require("../utils/logger");
const mongoose = require("mongoose");

// --- Helper Functions ---
const generateNextQuotationNumber = async (userId) => {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  return `Q-${year}${month}${day}-${hours}${minutes}${seconds}`;
};

// --- Main Controller Functions ---

// Create or Update Quotation
exports.handleQuotationUpsert = async (req, res) => {
  let operation;
  let logDetails = {};
  const session = await mongoose.startSession(); // For transaction

  try {
    session.startTransaction();
    const {
      client: clientInput,
      billingAddress,
      ...quotationDetails
    } = req.body;
    const quotationPayload = { ...quotationDetails, billingAddress };

    const { id: quotationId } = req.params; // ID for update
    const user = req.user;
    operation = quotationId ? "update" : "create";
    logDetails = {
      userId: user._id,
      operation,
      quotationId,
      referenceNumber: quotationPayload.referenceNumber,
    };

    if (!quotationPayload.referenceNumber) {
      logger.warn(
        "quotation",
        `Missing reference number during quotation ${operation}`,
        user,
        logDetails
      );
      await session.abortTransaction();
      return res
        .status(400)
        .json({ message: "Missing quotation reference number" });
    }

    const refCheckQuery = {
      user: user._id,
      referenceNumber: quotationPayload.referenceNumber,
    };
    if (quotationId) {
      refCheckQuery._id = { $ne: quotationId };
    }
    const refCheck = await Quotation.findOne(refCheckQuery).session(session);

    if (refCheck) {
      logger.warn(
        "quotation",
        `Reference number already exists for user`,
        user,
        logDetails
      );
      await session.abortTransaction();
      return res
        .status(400)
        .json({ message: "Reference number already exists for this user" });
    }

    let processedClient;
    if (clientInput && clientInput._id) {
      processedClient = await Client.findOne({
        _id: clientInput._id,
        user: user._id,
      }).session(session);
      if (!processedClient) {
        await session.abortTransaction();
        return res
          .status(404)
          .json({
            message: "Client not found or does not belong to this user.",
          });
      }
      // Update existing client if details are different
      const { _id, ...updateData } = clientInput;
      let clientNeedsUpdate = false;
      Object.keys(updateData).forEach((key) => {
        if (
          key !== "quotations" &&
          String(processedClient[key]) !== String(updateData[key])
        ) {
          clientNeedsUpdate = true;
        }
      });

      if (clientNeedsUpdate) {
        if (updateData.email) updateData.email = updateData.email.toLowerCase();
        if (updateData.gstNumber)
          updateData.gstNumber = updateData.gstNumber.toUpperCase();

        const clientUpdatePayload = { ...updateData };
        delete clientUpdatePayload.user; // Prevent user field from being changed here
        delete clientUpdatePayload.quotations; // Prevent direct manipulation of quotations array

        processedClient = await Client.findByIdAndUpdate(
          clientInput._id,
          { ...clientUpdatePayload, user: user._id },
          { new: true, runValidators: true, session }
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
      processedClient = await Client.findOne({
        email: normalizedEmail,
        user: user._id,
      }).session(session);
      if (processedClient) {
        // Update if found by email
        processedClient = await Client.findByIdAndUpdate(
          processedClient._id,
          {
            ...clientInput,
            email: normalizedEmail,
            gstNumber: normalizedGst,
            user: user._id,
          },
          { new: true, runValidators: true, session }
        );
      } else {
        const gstCheck = await Client.findOne({
          gstNumber: normalizedGst,
          user: user._id,
        }).session(session);
        if (gstCheck) {
          await session.abortTransaction();
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
          user: user._id,
        });
        await processedClient.save({ session });
      }
    } else {
      await session.abortTransaction();
      return res
        .status(400)
        .json({ message: "Client information is missing or invalid." });
    }

    if (!processedClient || !processedClient._id) {
      await session.abortTransaction();
      return res
        .status(500)
        .json({ message: "Failed to process client information." });
    }

    const processedBillingAddress =
      typeof billingAddress === "object" && billingAddress !== null
        ? billingAddress
        : { address1: "", address2: "", city: "", state: "", pincode: "" };

    const data = {
      ...quotationPayload,
      user: user._id,
      date: new Date(quotationPayload.date),
      validityDate: new Date(quotationPayload.validityDate),
      client: processedClient._id,
      billingAddress: processedBillingAddress,
      // Ensure goods are processed correctly
      goods: (quotationPayload.goods || []).map((g) => ({
        ...g,
        quantity: Number(g.quantity || 0),
        price: Number(g.price || 0),
        amount: Number(g.amount || 0),
        gstRate: parseFloat(g.gstRate || 0),
      })),
    };

    let quotation;
    if (quotationId) {
      // Update
      const existingQuotation = await Quotation.findOne({
        _id: quotationId,
        user: user._id,
      }).session(session);
      if (!existingQuotation) {
        await session.abortTransaction();
        return res
          .status(404)
          .json({ message: "Quotation not found or not authorized." });
      }
      // Status change validation (from provided code)
      if (
        quotationPayload.status &&
        quotationPayload.status !== existingQuotation.status
      ) {
        if (["running", "closed"].includes(existingQuotation.status)) {
          await session.abortTransaction();
          return res
            .status(400)
            .json({
              message: `Cannot manually change status from '${existingQuotation.status}'.`,
            });
        }
        if (!["open", "hold"].includes(quotationPayload.status)) {
          await session.abortTransaction();
          return res
            .status(400)
            .json({
              message:
                "Status can only be manually changed to 'open' or 'hold'.",
            });
        }
      } else if (!quotationPayload.hasOwnProperty("status")) {
        data.status = existingQuotation.status;
      }

      quotation = await Quotation.findOneAndUpdate(
        { _id: quotationId, user: user._id },
        data,
        { new: true, runValidators: true, session }
      );
    } else {
      // Create
      quotation = new Quotation(data);
      await quotation.save({ session });
    }

    if (!quotation) {
      // Should not happen if logic above is correct
      await session.abortTransaction();
      logger.error(
        "quotation",
        `Quotation ${operation} failed unexpectedly.`,
        user,
        logDetails
      );
      return res
        .status(500)
        .json({ message: `Failed to ${operation} quotation.` });
    }

    // Add quotation reference to client
    await Client.findByIdAndUpdate(
      processedClient._id,
      { $addToSet: { quotations: quotation._id } },
      { session }
    );

    // Sync to linked tickets if updating
    if (quotationId && quotation) {
      const linkedTickets = await Ticket.find({
        quotationNumber: quotation.referenceNumber,
      }).session(session);
      if (linkedTickets.length > 0) {
        logger.info(
          "quotation-ticket-sync",
          `Found ${linkedTickets.length} tickets linked to quotation ${quotation.referenceNumber} for syncing.`,
          user,
          { quotationId: quotation._id }
        );
        for (const ticket of linkedTickets) {
          // Only sync if ticket is in an "early" stage, e.g., not "Closed" or "Invoice Sent"
          if (
            !["Closed", "Invoice Sent", "Packing List"].includes(ticket.status)
          ) {
            const ticketUpdatePayload = {
              companyName: processedClient.companyName || ticket.companyName,
              client: processedClient._id || ticket.client,
              clientPhone: processedClient.phone || ticket.clientPhone,
              clientGstNumber:
                processedClient.gstNumber || ticket.clientGstNumber,
              billingAddress: [
                processedBillingAddress.address1 || "",
                processedBillingAddress.address2 || "",
                processedBillingAddress.state || "",
                processedBillingAddress.city || "",
                processedBillingAddress.pincode || "",
              ],
              goods: quotation.goods.map((g) => ({ ...g, _id: undefined })), // Direct overwrite, ensure schema compatibility
              totalQuantity: quotation.totalQuantity,
              totalAmount: quotation.totalAmount,
              // Ticket's GST and grandTotal should be recalculated by its own logic/pre-save hook
              termsAndConditions:
                quotation.termsAndConditions || ticket.termsAndConditions,
              dispatchDays: quotation.dispatchDays || ticket.dispatchDays,
              // validityDate: quotation.validityDate ? new Date(quotation.validityDate).toISOString() : ticket.validityDate,
              // Deadline on ticket is usually independent of quotation validity once ticket is active
            };
            if (ticket.shippingSameAsBilling) {
              ticketUpdatePayload.shippingAddress = [
                ...ticketUpdatePayload.billingAddress,
              ];
            }
            await Ticket.findByIdAndUpdate(
              ticket._id,
              { $set: ticketUpdatePayload },
              { session }
            );
            logger.info(
              "quotation-ticket-sync",
              `Synced ticket ${ticket.ticketNumber} with updated quotation ${quotation.referenceNumber}.`,
              user,
              { ticketId: ticket._id }
            );
          } else {
            logger.info(
              "quotation-ticket-sync",
              `Skipped syncing ticket ${ticket.ticketNumber} (status: ${ticket.status}) with updated quotation ${quotation.referenceNumber}.`,
              user,
              { ticketId: ticket._id }
            );
          }
        }
      }
    }

    await session.commitTransaction();
    const logMessage = quotationId
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

    res.status(quotationId ? 200 : 201).json(populatedQuotation);
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    logger.error(
      "quotation",
      `Error during quotation ${operation || "unknown"} process`,
      error,
      req.user,
      logDetails
    );
    console.error(
      `Error in handleQuotationUpsert (${operation || "unknown"}):`,
      error
    );
    if (error.name === "ValidationError") {
      return res
        .status(400)
        .json({ message: error.message, errors: error.errors });
    }
    res
      .status(500)
      .json({ message: error.message || "An unexpected error occurred." });
  } finally {
    if (session && session.endSession) {
      session.endSession();
    }
  }
};

exports.getAllQuotations = async (req, res) => {
  const user = req.user;
  const {
    page = 1,
    limit = 5,
    sortKey = "createdAt", // Default sort by creation date
    sortDirection = "descending",
    search: searchTerm,
    status: statusFilter,
  } = req.query;

  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const skip = (pageNum - 1) * limitNum;

  try {
    let conditions = [];

    if (user.role !== "super-admin") {
      conditions.push({ user: user._id });
    }

    if (
      statusFilter &&
      statusFilter.toLowerCase() !== "all" &&
      statusFilter.toLowerCase() !== "undefined"
    ) {
      conditions.push({ status: statusFilter });
    }

    if (searchTerm) {
      const searchRegex = { $regex: searchTerm, $options: "i" };
      // Client search query should respect user's role for visibility of clients
      let clientSearchQuery = {};
      if (user.role !== "super-admin" && user.role !== "admin") {
        clientSearchQuery.user = user._id; // Regular users search only their own clients
      }
      // Add $or for client fields to the clientSearchQuery
      clientSearchQuery.$or = [
          { companyName: searchRegex },
          { clientName: searchRegex },
          { gstNumber: searchRegex },
          { email: searchRegex },
        ];

 const matchingClients = await Client.find(clientSearchQuery).select("_id").lean();
      const clientIds = matchingClients.map((c) => c._id);

      const searchOrConditions = [{ referenceNumber: searchRegex }];
      if (clientIds.length > 0) {
        searchOrConditions.push({ client: { $in: clientIds } });
      }
      // Optionally search in goods description or HSN
      // searchOrConditions.push({ "goods.description": searchRegex });
      // searchOrConditions.push({ "goods.hsnSacCode": searchRegex });
      conditions.push({ $or: searchOrConditions });
    }

    const finalQuery = conditions.length > 0 ? { $and: conditions } : {};

    logger.debug(
      "quotation-list",
      "Constructed final query for quotations",
      user,
      { finalQuery: JSON.stringify(finalQuery) }
    );

    const totalItems = await Quotation.countDocuments(finalQuery);
    const quotations = await Quotation.find(finalQuery)
      .populate("client", "companyName gstNumber email phone clientName _id")
      .populate("user", "firstname lastname email")
      .populate("orderIssuedBy", "firstname lastname")
      .sort({ [sortKey]: sortDirection === "ascending" ? 1 : -1 })
      .skip(skip)
      .limit(limitNum);

    res.json({
      data: quotations,
      totalItems,
      currentPage: pageNum,
      totalPages: Math.ceil(totalItems / limitNum),
    });
  } catch (error) {
    logger.error(
      "quotation",
      `Failed to fetch all accessible quotations`,
      error,
      user,
      { queryParams: req.query }
    );
    res
      .status(500)
      .json({ message: "Error fetching quotations", error: error.message });
  }
};

exports.getQuotationById = async (req, res) => {
  try {
    let findQuery = { _id: req.params.id };
    const user = req.user;

    if (user.role !== "super-admin") {
      findQuery.user = user._id;
    }

    const quotation = await Quotation.findOne(findQuery)
      .populate("client")
      .populate("user", "firstname lastname email")
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
};

exports.deleteQuotation = async (req, res) => {
  const quotationId = req.params.id;
  const user = req.user;
  const logDetails = {
    userId: user._id,
    quotationId,
    model: "Quotation",
    userEmail: user.email,
  };
  const session = await mongoose.startSession();

  logger.info(
    "delete",
    `[DELETE_INITIATED] Quotation ID: ${quotationId} by User: ${user.email}. Transaction started.`,
    user,
    logDetails
  );

  try {
    session.startTransaction();
    if (user.role !== "super-admin") {
      logger.warn(
        "delete",
        `[AUTH_FAILURE] Unauthorized delete attempt for Quotation ID: ${quotationId} by User: ${user.email}.`,
        user,
        logDetails
      );
      await session.abortTransaction();
      return res
        .status(403)
        .json({ message: "Only superadmin can delete quotations" });
    }

    const quotationToBackup = await Quotation.findById(quotationId).session(
      session
    );
    if (!quotationToBackup) {
      logger.warn(
        "delete",
        `[NOT_FOUND] Quotation not found for deletion: ${quotationId}.`,
        user,
        logDetails
      );
      await session.abortTransaction();
      return res.status(404).json({ message: "Quotation not found." });
    }

    const backupData = {
      originalId: quotationToBackup._id,
      originalModel: "Quotation",
      data: quotationToBackup.toObject(),
      deletedBy: user._id,
      deletedAt: new Date(),
      originalCreatedAt: quotationToBackup.createdAt,
      originalUpdatedAt: quotationToBackup.updatedAt,
      backupReason: "Admin-initiated deletion via API",
    };
    const newBackupEntry = new UniversalBackup(backupData);
    await newBackupEntry.save({ session });

    const deleteResult = await Quotation.findByIdAndDelete(quotationId, {
      session,
    });
    if (!deleteResult) {
      await session.abortTransaction();
      logger.error(
        "delete",
        `[DELETE_FAILED_UNEXPECTEDLY] Quotation ${quotationId} found but failed to delete. Transaction aborted.`,
        user,
        logDetails
      );
      return res
        .status(500)
        .json({
          message:
            "Failed to delete quotation after backup. Operation rolled back.",
        });
    }

    if (quotationToBackup.client) {
      await Client.findByIdAndUpdate(
        quotationToBackup.client,
        { $pull: { quotations: quotationToBackup._id } },
        { session }
      );
      logger.info(
        "delete",
        `[CLIENT_REF_REMOVED] Quotation reference ${quotationToBackup._id} removed from Client ID: ${quotationToBackup.client}.`,
        user,
        { ...logDetails, targetClientId: quotationToBackup.client.toString() }
      );
    }

    // Update linked tickets
    const linkedTickets = await Ticket.find({
      quotationNumber: quotationToBackup.referenceNumber,
    }).session(session);
    for (const ticket of linkedTickets) {
      let updateNeeded = false;
      let ticketStatusUpdate = {};

      if (ticket.quotationNumber === quotationToBackup.referenceNumber) {
        ticket.quotationNumber = `DEL_Q_${quotationToBackup.referenceNumber.slice(
          -6
        )}`; // Mark as deleted
        updateNeeded = true;
      }
      if (!["Closed", "Cancelled", "Hold"].includes(ticket.status)) {
        // Avoid changing already finalized/held tickets
        ticketStatusUpdate = {
          status: "Hold",
          $push: {
            statusHistory: {
              status: "Hold",
              changedAt: new Date(),
              changedBy: user._id,
              note: `Source Quotation ${quotationToBackup.referenceNumber} deleted.`,
            },
          },
        };
        updateNeeded = true;
      }
      if (updateNeeded) {
        await Ticket.updateOne(
          { _id: ticket._id },
          { ...ticketStatusUpdate, quotationNumber: ticket.quotationNumber },
          { session }
        );
        logger.info(
          "quotation-delete-cascade",
          `Updated linked ticket ${ticket.ticketNumber} due to quotation deletion.`,
          user,
          { ticketId: ticket._id }
        );
      }
    }

    await session.commitTransaction();
    logger.info(
      "delete",
      `[DELETE_SUCCESS] Quotation ID: ${quotationId} deleted and backed up successfully by User: ${user.email}. Backup ID: ${newBackupEntry._id}`,
      user,
      { ...logDetails, backupId: newBackupEntry._id }
    );
    res
      .status(200)
      .json({
        message:
          "Quotation deleted, backed up, and linked entities updated successfully.",
        originalId: quotationToBackup._id,
        backupId: newBackupEntry._id,
      });
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
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
  } finally {
    if (session && session.endSession) {
      session.endSession();
    }
  }
};

exports.getNextQuotationNumber = async (req, res) => {
  try {
    const newRefNum = await generateNextQuotationNumber(req.user._id); // Pass userId if needed for user-specific sequences
    res.json({ nextQuotationNumber: newRefNum });
  } catch (error) {
    logger.error(
      "quotation",
      `Failed to generate next quotation number`,
      error,
      req.user
    );
    res.status(500).json({ message: error.message });
  }
};

exports.checkReferenceNumber = async (req, res) => {
  try {
    const { referenceNumber, excludeId } = req.query;
    if (!referenceNumber) {
      return res
        .status(400)
        .json({ message: "referenceNumber query parameter is required." });
    }
    const query = { user: req.user._id, referenceNumber };
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
      req.user,
      { queryParams: req.query }
    );
    res.status(500).json({ message: error.message });
  }
};

exports.getQuotationByReferenceNumber = async (req, res) => {
  try {
    const { refNumber } = req.params;
    const user = req.user;
    // Quotations are user-specific, so include user in the query
    const quotation = await Quotation.findOne({
      referenceNumber: refNumber,
      user: user._id,
    })
      .populate("client")
      .populate("user", "firstname lastname email")
      .populate("orderIssuedBy", "firstname lastname");

    if (!quotation) {
      logger.warn(
        "quotation",
        `Quotation not found by reference: ${refNumber} for user ${user._id}`,
        user
      );
      return res.status(404).json({ message: "Quotation not found." });
    }
    res.json(quotation);
  } catch (error) {
    logger.error(
      "quotation",
      `Error fetching quotation by reference: ${req.params.refNumber}`,
      error,
      req.user
    );
    res
      .status(500)
      .json({
        message: "Failed to fetch quotation details.",
        error: error.message,
      });
  }
};

// --- Report Generation ---
// (generateQuotationsReport and exportToExcel logic from reportController.js would be here or imported)

// Placeholder for generateQuotationsReport (actual logic in reportController.js)
exports.generateQuotationsReport = async (req, res) => {
  // This function's core logic should be in reportController.js
  // For now, a placeholder or call the imported function
  try {
    // const reportData = await actualReportGenerationLogic(req.query.period, req.user);
    // res.json({ success: true, data: reportData });
    res
      .status(501)
      .json({
        message:
          "Report generation logic to be fully implemented in reportController.",
      });
  } catch (error) {
    logger.error(
      "quotation-report",
      "Error generating quotation report summary",
      error,
      req.user
    );
    res.status(500).json({ message: "Failed to generate report summary." });
  }
};

exports.exportQuotationsToExcel = async (req, res) => {
  // This function's core logic should be in reportController.js
  try {
    // const excelBuffer = await actualExcelExportLogic(req.query.period, req.user);
    // res.setHeader('Content-Disposition', 'attachment; filename="quotations_report.xlsx"');
    // res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    // res.send(excelBuffer);
    res
      .status(501)
      .json({
        message:
          "Excel export logic to be fully implemented in reportController.",
      });
  } catch (error) {
    logger.error(
      "quotation-report",
      "Error exporting quotations to Excel",
      error,
      req.user
    );
    res.status(500).json({ message: "Failed to export quotations to Excel." });
  }
};
