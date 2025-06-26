// server/controllers/quotationController.js
const Quotation = require("../models/quotation");
const Client = require("../models/client");
const UniversalBackup = require("../models/universalBackup");
const QuotationHistory = require("../models/quotationHistory");
const Ticket = require("../models/opentickets");
const logger = require("../utils/logger");
const mongoose = require("mongoose");

// In a real application, this should ideally be loaded from a global configuration or a dedicated company settings model.
const COMPANY_REFERENCE_STATE = "UTTAR PRADESH";

// --- Helper Functions ---

/**
 * This is the SINGLE SOURCE OF TRUTH for all quotation calculations.
 * It takes raw goods and billing address and returns all calculated totals.
 */
const calculateQuotationTotals = (goods, billingAddress) => {
  let totalQuantity = 0;
  let totalAmount = 0; // Pre-GST total
  let gstAmount = 0; // Total GST amount

  const processedGoods = (goods || []).map((g) => ({
    ...g,
    quantity: Number(g.quantity || 0),
    price: Number(g.price || 0),
    gstRate: parseFloat(g.gstRate || 0),
  }));

  processedGoods.forEach((item) => {
    item.amount = item.quantity * item.price;
    totalQuantity += item.quantity;
    totalAmount += item.amount;
  });

  const billingState = (billingAddress?.state || "").toUpperCase().trim();
  const isBillingStateSameAsCompany =
    billingState === COMPANY_REFERENCE_STATE.toUpperCase().trim();

  const gstGroups = {};
  processedGoods.forEach((item) => {
    const itemGstRate = item.gstRate;
    if (!isNaN(itemGstRate) && itemGstRate >= 0 && item.amount > 0) {
      if (!gstGroups[itemGstRate])
        gstGroups[itemGstRate] = { taxableAmount: 0 };
      gstGroups[itemGstRate].taxableAmount += item.amount;
    }
  });

  const gstBreakdown = [];
  let runningTotalCgst = 0;
  let runningTotalSgst = 0;
  let runningTotalIgst = 0;

  for (const rateKey in gstGroups) {
    const group = gstGroups[rateKey];
    const itemGstRate = parseFloat(rateKey);
    const taxableAmount = group.taxableAmount;
    let cgstAmount = 0, sgstAmount = 0, igstAmount = 0;
    let cgstRate = 0, sgstRate = 0, igstRate = 0;

    if (itemGstRate > 0) {
      if (isBillingStateSameAsCompany) {
        cgstRate = itemGstRate / 2;
        sgstRate = itemGstRate / 2;
        cgstAmount = (taxableAmount * cgstRate) / 100;
        sgstAmount = (taxableAmount * sgstRate) / 100;
        runningTotalCgst += cgstAmount;
        runningTotalSgst += sgstAmount;
      } else {
        igstRate = itemGstRate;
        igstAmount = (taxableAmount * igstRate) / 100;
        runningTotalIgst += igstAmount;
      }
    }
    gstBreakdown.push({ itemGstRate, taxableAmount, cgstRate, cgstAmount, sgstRate, sgstAmount, igstRate, igstAmount });
  }

  gstAmount = runningTotalCgst + runningTotalSgst + runningTotalIgst;
  const grandTotal = totalAmount + gstAmount;

  return { processedGoods, totalQuantity, totalAmount, gstAmount, grandTotal };
};

/**
 * Generates a unique quotation number based on the current timestamp.
 * This should be the ONLY source for generating new quotation numbers.
 */
const generateNextQuotationNumber = async () => {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  return `Q-${year}${month}${day}-${hours}${minutes}${seconds}`;
};

// --- Main Controller Functions (Refactored for clarity and robustness) ---

/**
 * @description Create a new quotation with backend calculation verification and history logging.
 */
exports.createQuotation = async (req, res) => {
  const operation = "create";
  const session = await mongoose.startSession();

  try {
    session.startTransaction();
    const {
      client: clientInput,
      billingAddress,
      goods: rawGoods,
      ...quotationDetails
    } = req.body;
    const user = req.user;

    // --- Validation and Pre-computation ---
    if (!quotationDetails.referenceNumber) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Missing quotation reference number" });
    }
    const refCheck = await Quotation.findOne({ user: user._id, referenceNumber: quotationDetails.referenceNumber }).session(session);
    if (refCheck) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Reference number already exists for this user" });
    }
    if (!Array.isArray(rawGoods) || rawGoods.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Quotation must contain at least one item." });
    }

    // --- Client Processing ---
    let processedClient;
    if (clientInput && clientInput._id) {
      processedClient = await Client.findById(clientInput._id).session(session);
      if (!processedClient) {
        await session.abortTransaction();
        return res.status(404).json({ message: "Client not found." });
      }
    } else if (clientInput && clientInput.email && clientInput.companyName) {
      const normalizedEmail = clientInput.email.toLowerCase();
      const normalizedGst = (clientInput.gstNumber || "").toUpperCase();
      processedClient = await Client.findOneAndUpdate(
        { email: normalizedEmail, user: user._id },
        { ...clientInput, email: normalizedEmail, gstNumber: normalizedGst, user: user._id },
        { new: true, upsert: true, runValidators: true, session }
      );
    } else {
      await session.abortTransaction();
      return res.status(400).json({ message: "Client information is missing or invalid." });
    }

    // --- Backend Calculation & Verification ---
    const processedBillingAddress = typeof billingAddress === "object" && billingAddress !== null ? billingAddress : {};
    const { processedGoods, totalQuantity, totalAmount, gstAmount, grandTotal } = calculateQuotationTotals(rawGoods, processedBillingAddress);

    const frontendTotals = {
      totalQuantity: Number(req.body.totalQuantity || 0),
      totalAmount: Number(req.body.totalAmount || 0),
      gstAmount: Number(req.body.gstAmount || 0),
      grandTotal: Number(req.body.grandTotal || 0),
    };
    const tolerance = 0.01; // Allow for minor floating point discrepancies
    if (
      Math.abs(totalQuantity - frontendTotals.totalQuantity) > tolerance ||
      Math.abs(totalAmount - frontendTotals.totalAmount) > tolerance ||
      Math.abs(gstAmount - frontendTotals.gstAmount) > tolerance ||
      Math.abs(grandTotal - frontendTotals.grandTotal) > tolerance
    ) {
      logger.warn("quotation", `Calculation mismatch for new quotation ${quotationDetails.referenceNumber}.`, user, { frontend: frontendTotals, backend: { totalQuantity, totalAmount, gstAmount, grandTotal }, action: "CALCULATION_MISMATCH_CREATE" });
      await session.abortTransaction();
      return res.status(400).json({ message: "Calculation mismatch detected. Please re-check quotation details." });
    }

    // --- Data Persistence ---
    const data = {
      ...quotationDetails,
      user: user._id,
      date: new Date(quotationDetails.date),
      validityDate: new Date(quotationDetails.validityDate),
      client: processedClient._id,
      billingAddress: processedBillingAddress,
      goods: processedGoods,
      totalQuantity, totalAmount, gstAmount, grandTotal,
    };

    const quotation = new Quotation(data);
    await quotation.save({ session });

    await Client.findByIdAndUpdate(processedClient._id, { $addToSet: { quotations: quotation._id } }, { session });

    await QuotationHistory.create([{
      quotationId: quotation._id,
      changedBy: user._id,
      action: "CREATE",
      changes: { snapshot: quotation.toObject() },
    }], { session });

    await session.commitTransaction();
    logger.info("quotation", "Quotation created successfully", user, { quotationId: quotation._id, clientId: processedClient._id });

    const populatedQuotation = await Quotation.findById(quotation._id).populate("client").populate("user", "firstname lastname email").populate("orderIssuedBy", "firstname lastname");
    res.status(201).json(populatedQuotation);

  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    logger.error("quotation", `Error during quotation ${operation} process`, error, req.user);
    if (error.name === "ValidationError") return res.status(400).json({ message: error.message, errors: error.errors });
    res.status(500).json({ message: error.message || "An unexpected error occurred." });
  } finally {
    session.endSession();
  }
};

/**
 * @description Update an existing quotation with backend calculation verification and history logging.
 */
exports.updateQuotation = async (req, res) => {
    const operation = "update";
    const { id: quotationId } = req.params;
    const session = await mongoose.startSession();

    try {
        session.startTransaction();
        const {
            client: clientInput,
            billingAddress,
            goods: rawGoods,
            ...quotationDetails
        } = req.body;
        const user = req.user;

        // --- Find Existing Quotation & Authorization ---
        let findQuery = { _id: quotationId };
        if (user.role !== "super-admin") findQuery.user = user._id;
        const existingQuotation = await Quotation.findOne(findQuery).session(session);
        if (!existingQuotation) {
            await session.abortTransaction();
            return res.status(404).json({ message: "Quotation not found or you are not authorized to update it." });
        }

        // --- Validation and Pre-computation ---
        if (!quotationDetails.referenceNumber) {
            await session.abortTransaction();
            return res.status(400).json({ message: "Missing quotation reference number" });
        }
        const refCheck = await Quotation.findOne({ user: user._id, referenceNumber: quotationDetails.referenceNumber, _id: { $ne: quotationId } }).session(session);
        if (refCheck) {
            await session.abortTransaction();
            return res.status(400).json({ message: "Reference number already exists for this user" });
        }
        if (!Array.isArray(rawGoods) || rawGoods.length === 0) {
            await session.abortTransaction();
            return res.status(400).json({ message: "Quotation must contain at least one item." });
        }

        // --- Client Processing ---
        let processedClient;
        // Logic to find/update/create client similar to createQuotation
        if (clientInput && clientInput._id) {
            processedClient = await Client.findById(clientInput._id).session(session);
            if (!processedClient) {
                await session.abortTransaction();
                return res.status(404).json({ message: "Client not found." });
            }
            // Optionally update client if details changed
            const { _id, ...updateData } = clientInput;
            const clientUpdatePayload = { ...updateData };
            delete clientUpdatePayload.user;
            delete clientUpdatePayload.quotations;
            processedClient = await Client.findByIdAndUpdate(clientInput._id, clientUpdatePayload, { new: true, runValidators: true, session });
        } else {
            await session.abortTransaction();
            return res.status(400).json({ message: "Client information is missing or invalid." });
        }

        // --- Backend Calculation & Verification ---
        const processedBillingAddress = typeof billingAddress === "object" && billingAddress !== null ? billingAddress : {};
        const { processedGoods, totalQuantity, totalAmount, gstAmount, grandTotal } = calculateQuotationTotals(rawGoods, processedBillingAddress);
        const frontendTotals = {
            totalQuantity: Number(req.body.totalQuantity || 0),
            totalAmount: Number(req.body.totalAmount || 0),
            gstAmount: Number(req.body.gstAmount || 0),
            grandTotal: Number(req.body.grandTotal || 0),
        };
        const tolerance = 0.01;
        if (
            Math.abs(totalQuantity - frontendTotals.totalQuantity) > tolerance ||
            Math.abs(totalAmount - frontendTotals.totalAmount) > tolerance ||
            Math.abs(gstAmount - frontendTotals.gstAmount) > tolerance ||
            Math.abs(grandTotal - frontendTotals.grandTotal) > tolerance
        ) {
            logger.warn("quotation", `Calculation mismatch for quotation update ${quotationDetails.referenceNumber}.`, user, { frontend: frontendTotals, backend: { totalQuantity, totalAmount, gstAmount, grandTotal }, action: "CALCULATION_MISMATCH_UPDATE" });
            await session.abortTransaction();
            return res.status(400).json({ message: "Calculation mismatch detected. Please re-check quotation details." });
        }

        // --- Status Validation ---
        if (quotationDetails.status && quotationDetails.status !== existingQuotation.status) {
            if (["running", "closed"].includes(existingQuotation.status)) {
                await session.abortTransaction();
                return res.status(400).json({ message: `Cannot manually change status from '${existingQuotation.status}'.` });
            }
            if (!["open", "hold"].includes(quotationDetails.status)) {
                await session.abortTransaction();
                return res.status(400).json({ message: "Status can only be manually changed to 'open' or 'hold'." });
            }
        }

        // --- Data Persistence ---
        const data = {
            ...quotationDetails,
            date: new Date(quotationDetails.date),
            validityDate: new Date(quotationDetails.validityDate),
            client: processedClient._id,
            billingAddress: processedBillingAddress,
            goods: processedGoods,
            totalQuantity, totalAmount, gstAmount, grandTotal,
        };

        const updatedQuotation = await Quotation.findByIdAndUpdate(quotationId, data, { new: true, runValidators: true, session });

        await QuotationHistory.create([{
            quotationId: updatedQuotation._id,
            changedBy: user._id,
            action: "UPDATE",
            changes: { snapshot: updatedQuotation.toObject() },
        }], { session });

        // --- Sync with Linked Tickets ---
        const linkedTickets = await Ticket.find({ quotationNumber: updatedQuotation.referenceNumber }).session(session);
        for (const ticket of linkedTickets) {
            if (!["Closed", "Invoice Sent", "Packing List"].includes(ticket.status)) {
                const ticketUpdatePayload = {
                    companyName: processedClient.companyName,
                    client: processedClient._id,
                    clientPhone: processedClient.phone,
                    clientGstNumber: processedClient.gstNumber,
                    billingAddress: [processedBillingAddress.address1, processedBillingAddress.address2, processedBillingAddress.state, processedBillingAddress.city, processedBillingAddress.pincode],
                    goods: updatedQuotation.goods.map(g => ({ ...g, _id: undefined })),
                    totalQuantity: updatedQuotation.totalQuantity,
                    totalAmount: updatedQuotation.totalAmount,
                    termsAndConditions: updatedQuotation.termsAndConditions,
                    dispatchDays: updatedQuotation.dispatchDays,
                };
                if (ticket.shippingSameAsBilling) {
                    ticketUpdatePayload.shippingAddress = [...ticketUpdatePayload.billingAddress];
                }
                await Ticket.findByIdAndUpdate(ticket._id, { $set: ticketUpdatePayload }, { session });
            }
        }

        await session.commitTransaction();
        logger.info("quotation", "Quotation updated successfully", user, { quotationId: updatedQuotation._id });

        const populatedQuotation = await Quotation.findById(updatedQuotation._id).populate("client").populate("user", "firstname lastname email").populate("orderIssuedBy", "firstname lastname");
        res.status(200).json(populatedQuotation);

    } catch (error) {
        if (session.inTransaction()) await session.abortTransaction();
        logger.error("quotation", `Error during quotation ${operation} process`, error, req.user);
        if (error.name === "ValidationError") return res.status(400).json({ message: error.message, errors: error.errors });
        res.status(500).json({ message: error.message || "An unexpected error occurred." });
    } finally {
        session.endSession();
    }
};

/**
 * @description Get a lightweight list of quotations for the main page.
 */
exports.getAllQuotations = async (req, res) => {
    const user = req.user;
    const { page = 1, limit = 5, sortKey = "createdAt", sortDirection = "descending", search: searchTerm, status: statusFilter } = req.query;
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;
    const coreFields = 'referenceNumber client user validityDate status grandTotal date createdAt';

    try {
        let conditions = [];
        if (user.role !== "super-admin") conditions.push({ user: user._id });
        if (statusFilter && statusFilter.toLowerCase() !== "all") conditions.push({ status: statusFilter });
        if (searchTerm) {
            const searchRegex = { $regex: searchTerm, $options: "i" };
            let clientSearchQuery = {};
            if (user.role !== "super-admin" && user.role !== "admin") clientSearchQuery.user = user._id;
            clientSearchQuery.$or = [{ companyName: searchRegex }, { clientName: searchRegex }, { gstNumber: searchRegex }, { email: searchRegex }];
            const matchingClients = await Client.find(clientSearchQuery).select("_id").lean();
            const clientIds = matchingClients.map(c => c._id);
            const searchOrConditions = [{ referenceNumber: searchRegex }];
            if (clientIds.length > 0) searchOrConditions.push({ client: { $in: clientIds } });
            conditions.push({ $or: searchOrConditions });
        }
        const finalQuery = conditions.length > 0 ? { $and: conditions } : {};

        const totalItems = await Quotation.countDocuments(finalQuery);
        const quotations = await Quotation.find(finalQuery)
            .populate("client", "companyName")
            .populate("user", "firstname lastname")
            .sort({ [sortKey]: sortDirection === "ascending" ? 1 : -1 })
            .select(coreFields)
            .skip(skip)
            .limit(limitNum)
            .lean();

        res.json({ data: quotations, totalItems, currentPage: pageNum, totalPages: Math.ceil(totalItems / limitNum) });
    } catch (error) {
        logger.error("quotation", `Failed to fetch all accessible quotations`, error, user, { queryParams: req.query });
        res.status(500).json({ message: "Error fetching quotations", error: error.message });
    }
};

/**
 * @description Get the full details of a single quotation for editing or previewing.
 */
exports.getQuotationById = async (req, res) => {
    try {
        let findQuery = { _id: req.params.id };
        const user = req.user;
        if (user.role !== "super-admin") findQuery.user = user._id;

        const quotation = await Quotation.findOne(findQuery).populate("client").populate("user", "firstname lastname email").populate("orderIssuedBy", "firstname lastname");
        if (!quotation) {
            logger.warn("quotation", `Quotation not found or access denied: ${req.params.id}`, user);
            return res.status(404).json({ message: "Quotation not found or access denied." });
        }
        res.json(quotation);
    } catch (error) {
        logger.error("quotation", `Failed to fetch quotation by ID: ${req.params.id}`, error, req.user);
        res.status(500).json({ message: error.message });
    }
};

/**
 * @description Delete a quotation, create a backup, and update linked entities.
 */
exports.deleteQuotation = async (req, res) => {
    const quotationId = req.params.id;
    const user = req.user;
    const session = await mongoose.startSession();

    try {
        session.startTransaction();
        if (user.role !== "super-admin") {
            await session.abortTransaction();
            return res.status(403).json({ message: "Only superadmin can delete quotations" });
        }

        const quotationToBackup = await Quotation.findById(quotationId).session(session);
        if (!quotationToBackup) {
            await session.abortTransaction();
            return res.status(404).json({ message: "Quotation not found." });
        }

        const backupData = {
            originalId: quotationToBackup._id,
            originalModel: "Quotation",
            data: quotationToBackup.toObject(),
            deletedBy: user._id,
        };
        await new UniversalBackup(backupData).save({ session });
        await Quotation.findByIdAndDelete(quotationId, { session });

        if (quotationToBackup.client) {
            await Client.findByIdAndUpdate(quotationToBackup.client, { $pull: { quotations: quotationToBackup._id } }, { session });
        }

        const linkedTickets = await Ticket.find({ quotationNumber: quotationToBackup.referenceNumber }).session(session);
        for (const ticket of linkedTickets) {
            let update = { quotationNumber: `DEL_Q_${quotationToBackup.referenceNumber.slice(-6)}` };
            if (!["Closed", "Cancelled", "Hold"].includes(ticket.status)) {
                update.status = "Hold";
                update.$push = { statusHistory: { status: "Hold", changedAt: new Date(), changedBy: user._id, note: `Source Quotation ${quotationToBackup.referenceNumber} deleted.` } };
            }
            await Ticket.updateOne({ _id: ticket._id }, update, { session });
        }

        await session.commitTransaction();
        logger.info("delete", `Quotation ID: ${quotationId} deleted and backed up successfully.`, user);
        res.status(200).json({ message: "Quotation deleted, backed up, and linked entities updated successfully." });
    } catch (error) {
        if (session.inTransaction()) await session.abortTransaction();
        logger.error("delete", `Error during Quotation deletion process for ID: ${quotationId}.`, error, user);
        res.status(500).json({ message: "Server error during the deletion process." });
    } finally {
        session.endSession();
    }
};

/**
 * @description Get default values for the new quotation form.
 */
exports.getQuotationDefaults = async (req, res) => {
    try {
        const nextRefNum = await generateNextQuotationNumber();
        const defaultValidityDate = new Date();
        defaultValidityDate.setDate(defaultValidityDate.getDate() + 2);

        res.json({
            nextQuotationNumber: nextRefNum,
            defaultValidityDate: defaultValidityDate.toISOString().split("T")[0],
            defaultDispatchDays: "7-10 working days",
            defaultTermsAndConditions: "1. Goods once sold will not be taken back.\n2. Interest @18% p.a. will be charged if payment is not made within the stipulated time.\n3. Subject to Noida jurisdiction.",
        });
    } catch (error) {
        logger.error("quotation", `Failed to fetch quotation defaults`, error, req.user);
        res.status(500).json({ message: error.message });
    }
};

/**
 * @description Get only the next quotation number.
 */
exports.getNextQuotationNumber = async (req, res) => {
    try {
        const newRefNum = await generateNextQuotationNumber();
        res.json({ nextQuotationNumber: newRefNum });
    } catch (error) {
        logger.error("quotation", `Failed to generate next quotation number`, error, req.user);
        res.status(500).json({ message: error.message });
    }
};

/**
 * @description Check if a reference number already exists for the current user.
 */
exports.checkReferenceNumber = async (req, res) => {
    try {
        const { referenceNumber, excludeId } = req.query;
        if (!referenceNumber) return res.status(400).json({ message: "referenceNumber query parameter is required." });
        const query = { user: req.user._id, referenceNumber };
        if (excludeId) query._id = { $ne: excludeId };
        const existing = await Quotation.findOne(query);
        res.json({ exists: !!existing });
    } catch (error) {
        logger.error("quotation", `Failed to check reference number availability`, error, req.user, { queryParams: req.query });
        res.status(500).json({ message: error.message });
    }
};

/**
 * @description Get quotation by reference number (used for linking tickets).
 */
exports.getQuotationByReferenceNumber = async (req, res) => {
    try {
        const { refNumber } = req.params;
        const user = req.user;
        let query = { referenceNumber: refNumber };
        if (user.role !== "admin" && user.role !== "super-admin") query.user = user._id;

        const quotation = await Quotation.findOne(query).populate("client").populate("user", "firstname lastname email").populate("orderIssuedBy", "firstname lastname");
        if (!quotation) {
            logger.warn("quotation", `Quotation not found by reference: ${refNumber} for user ${user.email}`);
            return res.status(404).json({ message: "Quotation not found." });
        }
        res.json(quotation);
    } catch (error) {
        logger.error("quotation", `Error fetching quotation by reference: ${req.params.refNumber}`, error, req.user);
        res.status(500).json({ message: "Failed to fetch quotation details.", error: error.message });
    }
};
