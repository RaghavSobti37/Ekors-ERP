const Quotation = require("../models/quotation");
const Client = require("../models/client");
const UniversalBackup = require("../models/universalBackup"); // Using UniversalBackup
const Ticket = require("../models/opentickets");
const logger = require("../logger"); // Use unified logger
const mongoose = require("mongoose");
const ItemModel = require("../models/itemlist").Item; // Use correct model

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

const allowedUnits = ["Nos", "Kg", "Mtr", "Ltr"]; // Add all allowed units here

function normalizeUnit(unit) {
  if (!unit) return unit;
  const found = allowedUnits.find(
    (u) => u.toLowerCase() === String(unit).toLowerCase()
  );
  return found || unit;
}

// --- Main Controller Functions ---

// Create or Update Quotation
exports.handleQuotationUpsert = async (req, res) => {
  let operation;
  let logDetails = {};
  const session = await mongoose.startSession();

  try {
    session.startTransaction();
    const {
      client: clientInput,
      billingAddress,
      ...quotationDetails
    } = req.body;
    const quotationPayload = { ...quotationDetails, billingAddress };

    const { id: quotationId } = req.params;
    const user = req.user;
    operation = quotationId ? "update" : "create";
    logDetails = {
      userId: user._id,
      operation,
      quotationId,
      referenceNumber: quotationPayload.referenceNumber,
    };

    if (!quotationPayload.referenceNumber) {
      logger.log({
        user,
        page: "Quotation",
        action: `Quotation ${operation}`,
        api: req.originalUrl,
        req,
        message: "Missing reference number during quotation upsert",
        details: logDetails,
        level: "warn"
      });
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
      logger.log({
        user,
        page: "Quotation",
        action: `Quotation ${operation}`,
        api: req.originalUrl,
        req,
        message: "Reference number already exists for user",
        details: logDetails,
        level: "warn"
      });
      await session.abortTransaction();
      return res
        .status(400)
        .json({ message: "Reference number already exists for this user" });
    }

    let processedClient;
    if (clientInput && clientInput._id) {
      processedClient = await Client.findById(clientInput._id).session(session);
      if (!processedClient) {
        await session.abortTransaction();
        return res.status(404).json({ message: "Client not found." });
      }
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
        delete clientUpdatePayload.user;
        delete clientUpdatePayload.quotations;

        processedClient = await Client.findByIdAndUpdate(
          clientInput._id,
          clientUpdatePayload,
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
          return res.status(400).json({
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

    const goodsWithPrices = [];
    for (const g of quotationPayload.goods || []) {
      let price = Number(g.price || 0);
      let sellingPrice = price;
      let originalItemId = g.originalItem?._id || g.originalItem || g.itemId;

      // Fetch selling price from Item master if not present or outdated
      if (originalItemId) {
        const itemDoc = await ItemModel.findById(originalItemId).lean();
        if (itemDoc && typeof itemDoc.sellingPrice === "number") {
          sellingPrice = itemDoc.sellingPrice;
          price = sellingPrice;
        }
      }

      goodsWithPrices.push({
        ...g,
        hsnCode: g.hsnCode || g.hsnCode || "", // Accept both for backward compatibility
        quantity: Number(g.quantity || 0),
        price,
        sellingPrice,
        amount: Number(g.amount || 0),
        gstRate: parseFloat(g.gstRate || 0),
        unit: g.unit,
        originalItem: originalItemId || undefined,
      });
    }

    const data = {
      ...quotationPayload,
      user: user._id,
      date: new Date(quotationPayload.date),
      validityDate: new Date(quotationPayload.validityDate),
      client: processedClient._id,
      billingAddress: processedBillingAddress,
      goods: goodsWithPrices,
      roundOffTotal: Number(quotationPayload.roundOffTotal) || 0, // Ensure roundOffTotal is saved
    };

    let quotation;
    if (quotationId) {
      let findExistingQuery = { _id: quotationId };
      let updateQuery = { _id: quotationId };
      if (user.role !== "super-admin") {
        findExistingQuery.user = user._id;
      }
      const existingQuotation = await Quotation.findOne(
        findExistingQuery
      ).session(session);
      if (!existingQuotation) {
        await session.abortTransaction();
        return res
          .status(404)
          .json({ message: "Quotation not found or not authorized." });
      }
      if (
        quotationPayload.status &&
        quotationPayload.status !== existingQuotation.status
      ) {
        if (["running", "closed"].includes(existingQuotation.status)) {
          await session.abortTransaction();
          return res.status(400).json({
            message: `Cannot manually change status from '${existingQuotation.status}'.`,
          });
        }
        if (!["open", "hold"].includes(quotationPayload.status)) {
          await session.abortTransaction();
          return res.status(400).json({
            message: "Status can only be manually changed to 'open' or 'hold'.",
          });
        }
      } else if (!quotationPayload.hasOwnProperty("status")) {
        data.status = existingQuotation.status;
      }

      quotation = await Quotation.findOneAndUpdate(updateQuery, data, {
        new: true,
        runValidators: true,
        session,
      });
    } else {
      quotation = new Quotation(data);
      await quotation.save({ session });
    }

    if (!quotation) {
      await session.abortTransaction();
      logger.log({
        user,
        page: "Quotation",
        action: `Quotation ${operation}`,
        api: req.originalUrl,
        req,
        message: `Quotation ${operation} failed unexpectedly.`,
        details: logDetails,
        level: "error"
      });
      return res
        .status(500)
        .json({ message: `Failed to ${operation} quotation.` });
    }

    await Client.findByIdAndUpdate(
      processedClient._id,
      { $addToSet: { quotations: quotation._id } },
      { session }
    );

    if (quotationId && quotation) {
      const linkedTickets = await Ticket.find({
        quotationNumber: quotation.referenceNumber,
      }).session(session);
      if (linkedTickets.length > 0) {
        logger.log({
          user,
          page: "Quotation",
          action: "Quotation-Ticket Sync",
          api: req.originalUrl,
          req,
          message: `Found ${linkedTickets.length} tickets linked to quotation ${quotation.referenceNumber} for syncing.`,
          details: { quotationId: quotation._id },
          level: "info"
        });
        for (const ticket of linkedTickets) {
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
              goods: quotation.goods.map((g) => ({ ...g, _id: undefined })),
              totalQuantity: quotation.totalQuantity,
              totalAmount: quotation.totalAmount,
              termsAndConditions:
                quotation.termsAndConditions || ticket.termsAndConditions,
              dispatchDays: quotation.dispatchDays || ticket.dispatchDays,
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
            logger.log({
              user,
              page: "Quotation",
              action: "Quotation-Ticket Sync",
              api: req.originalUrl,
              req,
              message: `Synced ticket ${ticket.ticketNumber} with updated quotation ${quotation.referenceNumber}.`,
              details: { ticketId: ticket._id },
              level: "info"
            });
          } else {
            logger.log({
              user,
              page: "Quotation",
              action: "Quotation-Ticket Sync",
              api: req.originalUrl,
              req,
              message: `Skipped syncing ticket ${ticket.ticketNumber} (status: ${ticket.status}) with updated quotation ${quotation.referenceNumber}.`,
              details: { ticketId: ticket._id },
              level: "info"
            });
          }
        }
      }
    }

    await session.commitTransaction();
    const logMessage = quotationId
      ? "Quotation updated successfully"
      : "Quotation created successfully";
    logger.log({
      user,
      page: "Quotation",
      action: `Quotation ${operation}`,
      api: req.originalUrl,
      req,
      message: logMessage,
      details: { ...logDetails, quotationId: quotation._id, clientId: processedClient._id },
      level: "info"
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
    logger.log({
      user: req.user,
      page: "Quotation",
      action: `Quotation ${operation || "unknown"} Error`,
      api: req.originalUrl,
      req,
      message: `Error during quotation ${operation || "unknown"} process`,
      details: { ...logDetails, error: error.message, stack: error.stack },
      level: "error"
    });
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
    sortKey = "createdAt",
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
      let clientSearchQuery = {};
      if (user.role !== "super-admin" && user.role !== "admin") {
        clientSearchQuery.user = user._id;
      }
      clientSearchQuery.$or = [
        { companyName: searchRegex },
        { clientName: searchRegex },
        { gstNumber: searchRegex },
        { email: searchRegex },
      ];

      const matchingClients = await Client.find(clientSearchQuery)
        .select("_id")
        .lean();
      const clientIds = matchingClients.map((c) => c._id);

      const searchOrConditions = [{ referenceNumber: searchRegex }];
      if (clientIds.length > 0) {
        searchOrConditions.push({ client: { $in: clientIds } });
      }
      conditions.push({ $or: searchOrConditions });
    }

    const finalQuery = conditions.length > 0 ? { $and: conditions } : {};

    logger.log({
      user,
      page: "Quotation",
      action: "Get All Quotations",
      api: req.originalUrl,
      req,
      message: "Constructed final query for quotations",
      details: { finalQuery: JSON.stringify(finalQuery) },
      level: "debug"
    });

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
    logger.log({
      user,
      page: "Quotation",
      action: "Get All Quotations Error",
      api: req.originalUrl,
      req,
      message: "Failed to fetch all accessible quotations",
      details: { error: error.message, stack: error.stack, queryParams: req.query },
      level: "error"
    });
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
      logger.log({
        user,
        page: "Quotation",
        action: "Get Quotation By ID",
        api: req.originalUrl,
        req,
        message: `Quotation not found or access denied: ${req.params.id}`,
        details: { queryDetails: findQuery },
        level: "warn"
      });
      return res
        .status(404)
        .json({ message: "Quotation not found or access denied." });
    }
    res.json(quotation);
  } catch (error) {
    logger.log({
      user: req.user,
      page: "Quotation",
      action: "Get Quotation By ID Error",
      api: req.originalUrl,
      req,
      message: `Failed to fetch quotation by ID: ${req.params.id}`,
      details: { error: error.message, stack: error.stack },
      level: "error"
    });
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

  logger.log({
    user,
    page: "Quotation",
    action: "Delete Quotation Initiated",
    api: req.originalUrl,
    req,
    message: `[DELETE_INITIATED] Quotation ID: ${quotationId} by User: ${user.email}. Transaction started.`,
    details: logDetails,
    level: "info"
  });

  try {
    session.startTransaction();
    if (user.role !== "super-admin") {
      logger.log({
        user,
        page: "Quotation",
        action: "Delete Quotation Auth Failure",
        api: req.originalUrl,
        req,
        message: `[AUTH_FAILURE] Unauthorized delete attempt for Quotation ID: ${quotationId} by User: ${user.email}.`,
        details: logDetails,
        level: "warn"
      });
      await session.abortTransaction();
      return res
        .status(403)
        .json({ message: "Only superadmin can delete quotations" });
    }

    const quotationToBackup = await Quotation.findById(quotationId).session(
      session
    );
    if (!quotationToBackup) {
      logger.log({
        user,
        page: "Quotation",
        action: "Delete Quotation Not Found",
        api: req.originalUrl,
        req,
        message: `[NOT_FOUND] Quotation not found for deletion: ${quotationId}.`,
        details: logDetails,
        level: "warn"
      });
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
    };
    const newBackupEntry = new UniversalBackup(backupData);
    await newBackupEntry.save({ session });

    const deleteResult = await Quotation.findByIdAndDelete(quotationId, {
      session,
    });
    if (!deleteResult) {
      await session.abortTransaction();
      logger.log({
        user,
        page: "Quotation",
        action: "Delete Quotation Failed Unexpectedly",
        api: req.originalUrl,
        req,
        message: `[DELETE_FAILED_UNEXPECTEDLY] Quotation ${quotationId} found but failed to delete. Transaction aborted.`,
        details: logDetails,
        level: "error"
      });
      return res.status(500).json({
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
      logger.log({
        user,
        page: "Quotation",
        action: "Delete Quotation Client Ref Removed",
        api: req.originalUrl,
        req,
        message: `[CLIENT_REF_REMOVED] Quotation reference ${quotationToBackup._id} removed from Client ID: ${quotationToBackup.client}.`,
        details: { ...logDetails, targetClientId: quotationToBackup.client.toString() },
        level: "info"
      });
    }

    const linkedTickets = await Ticket.find({
      quotationNumber: quotationToBackup.referenceNumber,
    }).session(session);
    for (const ticket of linkedTickets) {
      let updateNeeded = false;
      let ticketStatusUpdate = {};

      if (ticket.quotationNumber === quotationToBackup.referenceNumber) {
        ticket.quotationNumber = `DEL_Q_${quotationToBackup.referenceNumber.slice(
          -6
        )}`;
        updateNeeded = true;
      }
      if (!["Closed", "Cancelled", "Hold"].includes(ticket.status)) {
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
        logger.log({
          user,
          page: "Quotation",
          action: "Delete Quotation Cascade",
          api: req.originalUrl,
          req,
          message: `Updated linked ticket ${ticket.ticketNumber} due to quotation deletion.`,
          details: { ticketId: ticket._id },
          level: "info"
        });
      }
    }

    await session.commitTransaction();
    logger.log({
      user,
      page: "Quotation",
      action: "Delete Quotation Success",
      api: req.originalUrl,
      req,
      message: `[DELETE_SUCCESS] Quotation ID: ${quotationId} deleted and backed up successfully by User: ${user.email}. Backup ID: ${newBackupEntry._id}`,
      details: { ...logDetails, backupId: newBackupEntry._id },
      level: "info"
    });
    res.status(200).json({
      message:
        "Quotation deleted, backed up, and linked entities updated successfully.",
      originalId: quotationToBackup._id,
      backupId: newBackupEntry._id,
    });
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    logger.log({
      user,
      page: "Quotation",
      action: "Delete Quotation Error",
      api: req.originalUrl,
      req,
      message: `[DELETE_ERROR] Error during Quotation deletion process for ID: ${quotationId} by ${user.email}.`,
      details: { ...logDetails, error: error.message, stack: error.stack },
      level: "error"
    });
    res.status(500).json({
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
    const newRefNum = await generateNextQuotationNumber(req.user._id);
    res.json({ nextQuotationNumber: newRefNum });
  } catch (error) {
    logger.log({
      user: req.user,
      page: "Quotation",
      action: "Get Next Quotation Number Error",
      api: req.originalUrl,
      req,
      message: "Failed to generate next quotation number",
      details: { error: error.message, stack: error.stack },
      level: "error"
    });
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
    logger.log({
      user: req.user,
      page: "Quotation",
      action: "Check Reference Number Error",
      api: req.originalUrl,
      req,
      message: "Failed to check reference number availability",
      details: { error: error.message, stack: error.stack, queryParams: req.query },
      level: "error"
    });
    res.status(500).json({ message: error.message });
  }
};

exports.getQuotationByReferenceNumber = async (req, res) => {
  try {
    const { refNumber } = req.params;
    const user = req.user;
    let query = { referenceNumber: refNumber };
    if (user.role !== "admin" && user.role !== "super-admin") {
      query.user = user._id;
    }

    const quotation = await Quotation.findOne(query)
      .populate("client")
      .populate("user", "firstname lastname email")
      .populate("orderIssuedBy", "firstname lastname");

    if (!quotation) {
      logger.log({
        user,
        page: "Quotation",
        action: "Get Quotation By Reference",
        api: req.originalUrl,
        req,
        message: `Quotation not found by reference: ${refNumber} for user ${user._id}`,
        details: { userId: user._id, role: user.role, queryUsed: JSON.stringify(query) },
        level: "warn"
      });
      return res.status(404).json({ message: "Quotation not found." });
    }
    res.json(quotation);
  } catch (error) {
    logger.log({
      user: req.user,
      page: "Quotation",
      action: "Get Quotation By Reference Error",
      api: req.originalUrl,
      req,
      message: `Error fetching quotation by reference: ${req.params.refNumber}`,
      details: { error: error.message, stack: error.stack },
      level: "error"
    });
    res.status(500).json({
      message: "Failed to fetch quotation details.",
      error: error.message,
    });
  }
};