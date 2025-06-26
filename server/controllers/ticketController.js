// server/controllers/ticketController.js
const Ticket = require("../models/opentickets");
const UniversalBackup = require("../models/universalBackup"); // Using UniversalBackup
const Quotation = require("../models/quotation"); // Import Quotation model
const OpenticketModel = require("../models/opentickets.js"); // Used by index.js logic
const User = require("../models/users");
const logger = require("../utils/logger"); // Import logger
const { Item } = require("../models/itemlist"); // Import Item model for inventory
const fs = require("fs-extra"); // fs-extra for recursive directory removal
const path = require("path");
const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose"); // Added mongoose for session
const ReportController = require("./reportController"); // Import the report controller

// Define COMPANY_REFERENCE_STATE at a scope accessible by tax calculation logic
const COMPANY_REFERENCE_STATE = "UTTAR PRADESH";

// --- Helper Function for Ticket Calculations ---
/**
 * Calculates all derived fields for a ticket (totals, GST, rounding).
 * This is the SINGLE SOURCE OF TRUTH for ticket calculations on the backend.
 * @param {Array} goods - Array of goods items.
 * @param {Array} billingAddress - Array representing the billing address (e.g., [addr1, addr2, state, city, pincode]).
 * @returns {Object} Object containing all calculated fields.
 */
const calculateTicketTotals = (goods, billingAddress) => {
  let totalQuantity = 0;
  let totalAmount = 0; // Pre-GST total

  // Ensure goods is an array and each item has necessary numeric properties
  const processedGoods = (goods || []).map((g) => ({
    ...g,
    quantity: Number(g.quantity || 0),
    price: Number(g.price || 0),
    amount: Number(g.amount || (Number(g.quantity || 0) * Number(g.price || 0))), // Recalculate amount for safety
    gstRate: parseFloat(g.gstRate || 0),
  }));

  processedGoods.forEach((item) => {
    totalQuantity += item.quantity;
    totalAmount += item.amount;
  });

  const billingState = (billingAddress && billingAddress[2] ? billingAddress[2] : "")
    .toUpperCase()
    .trim();
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

  const newGstBreakdown = [];
  let runningTotalCgst = 0;
  let runningTotalSgst = 0;
  let runningTotalIgst = 0;

  for (const rateKey in gstGroups) {
    const group = gstGroups[rateKey];
    const itemGstRate = parseFloat(rateKey);
    if (isNaN(itemGstRate) || itemGstRate < 0) continue;

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
    newGstBreakdown.push({ itemGstRate, taxableAmount, cgstRate, cgstAmount, sgstRate, sgstAmount, igstRate, igstAmount });
  }

  const finalGstAmount = runningTotalCgst + runningTotalSgst + runningTotalIgst;
  const grandTotal = totalAmount + finalGstAmount;

  // Rounding logic is now mandatory and always applied
  const finalRoundedAmount = Math.round(grandTotal);
  const roundOff = finalRoundedAmount - grandTotal;

  return { processedGoods, totalQuantity, totalAmount, gstBreakdown: newGstBreakdown, totalCgstAmount: runningTotalCgst, totalSgstAmount: runningTotalSgst, totalIgstAmount: runningTotalIgst, finalGstAmount, grandTotal, isBillingStateSameAsCompany, roundOff, finalRoundedAmount };
};

exports.createTicket = asyncHandler(async (req, res) => {
  const user = req.user; // Auth middleware should ensure req.user exists
  const session = await mongoose.startSession(); // Start session for potential transaction

  if (!user || !user.id) {
    logger.error(
      "ticket-create",
      "User not found in request. Auth middleware might not be working correctly."
    );
    return res
      .status(401)
      .json({ error: "Unauthorized: User not authenticated." });
  }
  const { newTicketDetails, sourceQuotationData } = req.body;

  if (!newTicketDetails) {
    logger.error(
      "ticket-create",
      "Missing newTicketDetails in request body.",
      user
    );
    return res
      .status(400)
      .json({ error: "Missing newTicketDetails in request body." });
  }

  let finalTicketData;

  // If creating from a quotation, prioritize sourceQuotationData
  if (sourceQuotationData && sourceQuotationData.referenceNumber) {
    const clientData = sourceQuotationData.client || {};
    const quotationBillingAddress = sourceQuotationData.billingAddress || {};

    // Determine deadline: Use newTicketDetails.deadline if provided, else use quotation's validityDate
    let determinedDeadline = newTicketDetails.deadline
      ? new Date(newTicketDetails.deadline)
      : sourceQuotationData.validityDate
      ? new Date(sourceQuotationData.validityDate)
      : null; // Will be validated later

    finalTicketData = {
      ...newTicketDetails, // Keep any specific newTicketDetails not from quotation
      companyName: clientData.companyName || newTicketDetails.companyName,
      quotationNumber: sourceQuotationData.referenceNumber, // This should be the defining link
      client: clientData._id || newTicketDetails.client?._id,
      clientPhone: clientData.phone || newTicketDetails.clientPhone,
      clientGstNumber: clientData.gstNumber || newTicketDetails.clientGstNumber,
      billingAddress: [
        // Transform quotation billing address to ticket format
        quotationBillingAddress.address1 || "",
        quotationBillingAddress.address2 || "",
        quotationBillingAddress.state || "",
        quotationBillingAddress.city || "",
        quotationBillingAddress.pincode || "",
      ],
      goods: (sourceQuotationData.goods || newTicketDetails.goods || []).map((qGood, index) => ({
        srNo: qGood.srNo || index + 1,
        description: qGood.description,
        hsnSacCode: qGood.hsnSacCode,
        quantity: Number(qGood.quantity || 0),
        unit: qGood.unit || "Nos",
        price: Number(qGood.price || 0),
        amount: Number(qGood.amount || (Number(qGood.quantity || 0) * Number(qGood.price || 0))), // Ensure amount is calculated
        originalPrice: Number(qGood.originalPrice || qGood.price || 0),
        maxDiscountPercentage: Number(qGood.maxDiscountPercentage || 0),
        gstRate: Number(qGood.gstRate || 0),
        subtexts: qGood.subtexts || [],
      })),
      termsAndConditions:
        sourceQuotationData.termsAndConditions ||
        newTicketDetails.termsAndConditions, // If terms are on quotation
      dispatchDays:
        sourceQuotationData.dispatchDays ||
        newTicketDetails.dispatchDays ||
        "7-10 working", // Ensure default
      deadline: determinedDeadline,
    };
  } else {
    // If not from quotation, use newTicketDetails directly
    finalTicketData = {
      ...newTicketDetails,
      goods: (newTicketDetails.goods || []).map((g, index) => ({
        ...g,
        srNo: g.srNo || index + 1,
        quantity: Number(g.quantity || 0),
        price: Number(g.price || 0),
        amount: Number(g.amount || (Number(g.quantity || 0) * Number(g.price || 0))),
      })),
    };
  }

  // Ensure deadline is null if an empty string is passed, otherwise Mongoose handles valid date strings/null.
  if (
    finalTicketData.hasOwnProperty("deadline") &&
    finalTicketData.deadline === ""
  ) {
    finalTicketData.deadline = null;
  }

  // Set common fields
  finalTicketData.createdBy = user.id;
  finalTicketData.currentAssignee = user.id;
  finalTicketData.assignedTo = user.id; // Default assignedTo to creator
  finalTicketData.dispatchDays = finalTicketData.dispatchDays || "7-10 working days"; // Ensure default

  // Validate required fields before calculations
  if (!finalTicketData.goods || finalTicketData.goods.length === 0) {
    logger.error(
      "ticket-create",
      "Ticket must contain at least one item.",
      user,
      { finalTicketData }
    );
    return res.status(400).json({ error: "Ticket must contain at least one item." });
  }
  if (!finalTicketData.deadline) {
    logger.error(
      "ticket-create",
      "Deadline is required but not provided or derived.",
      user,
      { finalTicketData }
    );
    return res.status(400).json({ error: "Ticket deadline is required." });
  }
  if (!finalTicketData.ticketNumber) {
    return res.status(400).json({ error: "Ticket number is required." });
  }
  if (!finalTicketData.companyName) {
    return res.status(400).json({ error: "Company name is required." });
  }
  
  // Set client ObjectId if available from sourceQuotationData
  if (
    !finalTicketData.client && // Only if not already set by sourceQuotationData block
    newTicketDetails.client &&
    newTicketDetails.client._id
  ) {
    finalTicketData.client = newTicketDetails.client._id;
  } else if (
    sourceQuotationData &&
    sourceQuotationData.client &&
    sourceQuotationData.client._id &&
    !finalTicketData.client
  ) {
    finalTicketData.client = sourceQuotationData.client._id;
  }

  // Ensure statusHistory is correctly formatted and initial status is set
  if (
    Array.isArray(finalTicketData.statusHistory) &&
    finalTicketData.statusHistory.length > 0
  ) {
    finalTicketData.statusHistory = finalTicketData.statusHistory.map(
      (entry) => ({
        ...entry,
        changedBy: entry.changedBy || user.id, // Ensure changedBy is set by backend
        changedAt: entry.changedAt || new Date(),
      })
    );
  } else {
    finalTicketData.statusHistory = [
      { status: finalTicketData.status || "Quotation Sent", changedAt: new Date(), changedBy: user.id, note: sourceQuotationData && sourceQuotationData.referenceNumber ? "Ticket created from quotation." : "Ticket created." },
    ];
  }
  if (!finalTicketData.status) {
    finalTicketData.status = "Quotation Sent"; // Ensure status is set
  }

  // Validate billing and shipping addresses
  if (!Array.isArray(finalTicketData.billingAddress) || finalTicketData.billingAddress.length !== 5) {
    logger.error("ticket-create", "Billing address is not in the expected array format.", user, { billingAddress: finalTicketData.billingAddress });
    return res.status(400).json({ error: "Invalid billing address format." });
  }

  // Construct shippingAddress array
  if (finalTicketData.shippingSameAsBilling === true) {
    finalTicketData.shippingAddress = [
      ...(finalTicketData.billingAddress || ["", "", "", "", ""]),
    ];
  } else if (finalTicketData.shippingAddressObj) {
    const saObj = finalTicketData.shippingAddressObj;
    finalTicketData.shippingAddress = [
      saObj.address1 || "",
      saObj.address2 || "",
      saObj.state || "",
      saObj.city || "",
      saObj.pincode || "",
    ];
  } else if (
    !Array.isArray(finalTicketData.shippingAddress) ||
    finalTicketData.shippingAddress.length !== 5
  ) {
    finalTicketData.shippingAddress = ["", "", "", "", ""]; // Default if not properly provided
  }
  delete finalTicketData.shippingAddressObj; // Remove if not part of schema

  // --- Calculate Totals and GST using the helper function ---
  const {
    processedGoods,
    totalQuantity,
    totalAmount,
    gstBreakdown,
    totalCgstAmount,
    totalSgstAmount,
    totalIgstAmount,
    finalGstAmount,
    grandTotal,
    isBillingStateSameAsCompany,
    roundOff, // Calculated by helper
    finalRoundedAmount, // Calculated by helper
  } = calculateTicketTotals(finalTicketData.goods, finalTicketData.billingAddress);

  // Apply calculated values to finalTicketData
  finalTicketData.goods = processedGoods; // Use processed goods (with recalculated amounts)
  finalTicketData.totalQuantity = totalQuantity;
  finalTicketData.totalAmount = totalAmount;
  finalTicketData.gstBreakdown = gstBreakdown;
  finalTicketData.totalCgstAmount = totalCgstAmount;
  finalTicketData.totalSgstAmount = totalSgstAmount;
  finalTicketData.totalIgstAmount = totalIgstAmount;
  finalTicketData.finalGstAmount = finalGstAmount;
  finalTicketData.grandTotal = grandTotal;
  finalTicketData.isBillingStateSameAsCompany = isBillingStateSameAsCompany;
  finalTicketData.roundOff = roundOff; // Set calculated roundOff
  finalTicketData.finalRoundedAmount = finalRoundedAmount; // Set calculated finalRoundedAmount

  // --- Frontend Calculation Verification (Optional but Recommended) ---
  // If frontend sends these, verify them against backend calculations
  const frontendTotals = {
    totalQuantity: Number(req.body.newTicketDetails.totalQuantity || 0),
    totalAmount: Number(req.body.newTicketDetails.totalAmount || 0),
    finalGstAmount: Number(req.body.newTicketDetails.finalGstAmount || 0),
    grandTotal: Number(req.body.newTicketDetails.grandTotal || 0),
    roundOff: Number(req.body.newTicketDetails.roundOff || 0),
    finalRoundedAmount: Number(req.body.newTicketDetails.finalRoundedAmount || 0),
  };
  const tolerance = 0.01; // Allow for minor floating point discrepancies

  if (
    Math.abs(totalQuantity - frontendTotals.totalQuantity) > tolerance ||
    Math.abs(totalAmount - frontendTotals.totalAmount) > tolerance ||
    Math.abs(finalGstAmount - frontendTotals.finalGstAmount) > tolerance ||
    Math.abs(grandTotal - frontendTotals.grandTotal) > tolerance ||
    Math.abs(roundOff - frontendTotals.roundOff) > tolerance ||
    Math.abs(finalRoundedAmount - frontendTotals.finalRoundedAmount) > tolerance
  ) {
    logger.warn("ticket-create", `Calculation mismatch for new ticket ${finalTicketData.ticketNumber}. Frontend vs Backend.`, user, { frontend: frontendTotals, backend: { totalQuantity, totalAmount, finalGstAmount, grandTotal, roundOff, finalRoundedAmount }, action: "CALCULATION_MISMATCH_CREATE" });
    await session.abortTransaction();
    return res.status(400).json({ message: "Calculation mismatch detected. Please re-check ticket details." });
  }

  if (
    !Array.isArray(finalTicketData.shippingAddress) ||
    finalTicketData.shippingAddress.length !== 5
  ) {
    logger.error(
      "ticket-create",
      "Shipping address is not in the expected array format after construction.",
      user,
      { shippingAddress: finalTicketData.shippingAddress }
    );
    return res.status(400).json({ error: "Invalid shipping address format." });
  }

  // Instantiate the ticket object here to get its _id for logging purposes before saving.
  const ticket = new Ticket(finalTicketData);

  try {
    session.startTransaction(); // Start transaction before DB operations

    // --- Inventory Deduction Logic ---
    if (finalTicketData.goods && finalTicketData.goods.length > 0) {
      for (const good of finalTicketData.goods) {
        if (!good.description || Number(good.quantity) <= 0) { // Ensure valid quantity
          continue;
        }
        const itemToUpdate = await Item.findOne({
          name: good.description,
          ...(good.hsnSacCode && { hsnCode: good.hsnSacCode }),
        }).session(session);

        if (itemToUpdate) {
          const { quantityInBaseUnit, unitNameUsed } = convertToBaseUnit(good.quantity, good.unit, itemToUpdate);
          const quantityToDecrementInBaseUnit = quantityInBaseUnit;
          const baseUnitName = itemToUpdate.baseUnit;

          if (quantityToDecrementInBaseUnit === 0) {
            logger.warn("inventory", `Calculated quantity to decrement is zero for item ${good.description}. Skipping inventory update.`, user);
            continue;
          }

          itemToUpdate.quantity -= quantityToDecrementInBaseUnit;

          // Add to inventoryLog for ticket creation deduction
          const historyEntry = {
            type: "Ticket Deduction (Creation)",
            date: new Date(),
            quantityChange: -quantityToDecrementInBaseUnit, // Negative for deduction
            details: `Items deducted for new Ticket ${finalTicketData.ticketNumber}. Transaction: ${good.quantity} ${unitNameUsed}. Action by: ${user.firstname || user.email}.`,
             ticketReference: ticket._id,
            userReference: user.id,
          };
          itemToUpdate.inventoryLog = itemToUpdate.inventoryLog || [];
          itemToUpdate.inventoryLog.push(historyEntry);

          // Update needsRestock based on lowStockThreshold
          if (itemToUpdate.quantity <= itemToUpdate.lowStockThreshold) {
            itemToUpdate.needsRestock = true;
            itemToUpdate.restockAmount = Math.max(
              0,
              itemToUpdate.lowStockThreshold - itemToUpdate.quantity
            );
          } else { // If quantity is not below threshold
            itemToUpdate.needsRestock = false;
            itemToUpdate.restockAmount = 0;
          }
          await itemToUpdate.save({ session }); // Save within the transaction
          logger.info(
            "inventory",
            `Updated inventory for ${itemToUpdate.name}: -${quantityToDecrementInBaseUnit.toFixed(2)} ${baseUnitName} (from ${good.quantity} ${unitNameUsed}), new qty: ${itemToUpdate.quantity.toFixed(2)}`,
            user
          );
        } else {
          logger.warn(
            "inventory",
            `Item "${good.description}" (HSN: ${
              good.hsnSacCode || "N/A"
            }) not found. Skipping stock update.`,
            user
          );
        }
      }
    }

    // --- Ticket Creation ---
    await ticket.save({ session }); // Save within the transaction

    logger.info(
      "ticket",
      `Ticket ${ticket.ticketNumber} created successfully.`,
      user,
      {
        ticketId: ticket._id,
        ticketNumber: ticket.ticketNumber,
        companyName: ticket.companyName,
      }
    );

    // --- Update Quotation Status if applicable ---
    if (finalTicketData.quotationNumber && sourceQuotationData && sourceQuotationData._id) { // Ensure quotation ID is present
      try {
        const quotationOwnerId =
          sourceQuotationData.user?._id || sourceQuotationData.user;
        if (!quotationOwnerId) {
          logger.error(
            "quotation-update-error",
            "Source quotation user ID is missing.",
            user,
            { quotationNumber: ticket.quotationNumber }
          ); // Log error, but don't block ticket creation
        } else {
          const updatedQuotation = await Quotation.findOneAndUpdate(
            {
              referenceNumber: ticket.quotationNumber,
              user: quotationOwnerId,
            },
            {
              $set: { status: "running" },
              $addToSet: { linkedTickets: ticket._id },
            },
            { new: true, session: session }
          );

          if (updatedQuotation) {
            logger.info(
              "quotation",
              `Quotation ${ticket.quotationNumber} status set to 'running' and linked to ticket ${ticket.ticketNumber}.`,
              user,
              { quotationId: updatedQuotation._id, ticketId: ticket._id }
            );
          } else {
            logger.warn(
              "quotation",
              `Could not find quotation ${ticket.quotationNumber} (User: ${quotationOwnerId}) to update status after ticket creation.`,
              user
            ); // Log warning, but don't block ticket creation
          }
        }
      } catch (quotationError) {
        logger.error(
          "quotation",
          `Failed to update quotation status to 'running' for ${finalTicketData.quotationNumber} after ticket creation.`,
          quotationError,
          user
        );
        // This error should ideally not abort the transaction if the ticket itself was created successfully.
      }
    }

    await session.commitTransaction();
    return res.status(201).json(ticket);
  } catch (error) {
    await session.abortTransaction();
    logger.error("ticket", `Failed to create ticket`, error, user, {
      finalTicketDataAttempted: finalTicketData,
    });
    if (error.name === "ValidationError") {
      return res.status(400).json({
        error: "Validation failed",
        details: error.message,
        errors: error.errors,
      });
    }
    return res
      .status(500)
      .json({ error: "Failed to create ticket", details: error.message });
  } finally {
    session.endSession();
  }
});

// Get All Tickets with Pagination, Sorting, and Filtering
exports.getAllTickets = asyncHandler(async (req, res) => {
  const user = req.user;
  const {
    page = 1,
    limit = 5, // Default to 5 as per request, frontend can override
    sortKey = "createdAt",
    sortDirection = "descending",
    searchTerm,
    status, // Will be 'undefined' if "all" is selected on frontend
    populate, // Get populate string from query
  } = req.query;

  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const skip = (pageNum - 1) * limitNum;

  let queryConditions = [];

  // 1. Base query based on role
  if (user.role !== "super-admin" && user.role !== "admin") {
    queryConditions.push({
      $or: [{ currentAssignee: user.id }, { createdBy: user.id }],
    });
  }

  // 2. Search term filter
  if (searchTerm) {
    queryConditions.push({
      $or: [
        { ticketNumber: { $regex: searchTerm, $options: "i" } },
        { companyName: { $regex: searchTerm, $options: "i" } },
        { quotationNumber: { $regex: searchTerm, $options: "i" } },
      ],
    });
  }

  // 3. Status filter
  if (
    status &&
    status.toLowerCase() !== "all" &&
    status.toLowerCase() !== "undefined"
  ) {
    if (status.toLowerCase() === "open") {
      // "Open (Active)"
      queryConditions.push({ status: { $nin: ["Closed", "Hold"] } });
    } else {
      queryConditions.push({ status: status }); // Assumes status is a valid enum value from frontend
    }
  }

  const finalQuery =
    queryConditions.length > 0 ? { $and: queryConditions } : {};

  logger.debug(
    "ticket-list-query",
    "Constructed final query for tickets",
    user,
    { finalQuery: JSON.stringify(finalQuery) }
  );

  const totalItems = await Ticket.countDocuments(finalQuery);
  let ticketsQuery = Ticket.find(finalQuery)
    .sort({ [sortKey]: sortDirection === "ascending" ? 1 : -1 })
    .skip(skip)
    .limit(limitNum);

  // Apply populate if provided in the query string
  if (populate) {
    const populatePaths = populate.split(",");
    populatePaths.forEach((pathObj) => {
      // Basic populate, can be enhanced with select fields if needed
      ticketsQuery = ticketsQuery.populate({ path: pathObj.trim() });
    });
  } else {
    // Default essential populates if not specified by frontend
    ticketsQuery = ticketsQuery
      .populate({ path: "currentAssignee", select: "firstname lastname email" })
      .populate({ path: "createdBy", select: "firstname lastname email" });
  }

  const tickets = await ticketsQuery.exec();

  logger.info(
    "ticket-list",
    `Fetched ${tickets.length} of ${totalItems} tickets.`,
    user,
    { page: pageNum, limit: limitNum, query: finalQuery }
  );
  res.json({
    data: tickets,
    totalItems,
    currentPage: pageNum,
    totalPages: Math.ceil(totalItems / limitNum),
  });
});

// Get all tickets for the logged-in user (Potentially deprecated if getAllTickets covers this)
exports.getUserTickets = async (req, res) => {
  // This might be for a specific "My Tickets" view
  const user = req.user || null;
  try {
    const tickets = await Ticket.find({ createdBy: req.user.id }).sort({
      createdAt: -1,
    });
    res.json(tickets);
  } catch (error) {
    logger.error("ticket", `Failed to fetch user tickets`, error, user);
    res.status(500).json({ error: "Failed to fetch tickets" });
  }
};

// Get single ticket (only if created by the user or assigned, or if super-admin)
exports.getTicketById = async (req, res) => { 
  try {
    const user = req.user || null;
    let query = { _id: req.params.id };

    if (user.role !== "super-admin") {
      query.$or = [{ createdBy: user.id }, { currentAssignee: user.id }];
    }

    const ticket = await Ticket.findOne(query)
      .populate({ path: "currentAssignee", select: "firstname lastname email" })
      .populate({ path: "createdBy", select: "firstname lastname email" })
      .populate({
        path: "transferHistory.from",
        select: "firstname lastname email",
      })
      .populate({
        path: "transferHistory.to",
        select: "firstname lastname email",
      })
      .populate({
        path: "transferHistory.transferredBy",
        select: "firstname lastname email",
      })
      .populate({
        path: "documents.quotation.uploadedBy",
        select: "firstname lastname email",
      })
      .populate({
        path: "documents.po.uploadedBy",
        select: "firstname lastname email",
      })
      .populate({
        path: "documents.pi.uploadedBy",
        select: "firstname lastname email",
      })
      .populate({
        path: "documents.challan.uploadedBy",
        select: "firstname lastname email",
      })
      .populate({
        path: "documents.packingList.uploadedBy",
        select: "firstname lastname email",
      })
      .populate({
        path: "documents.feedback.uploadedBy",
        select: "firstname lastname email",
      })
      .populate({
        path: "documents.other.uploadedBy",
        select: "firstname lastname email",
      })
      .populate({
        path: "statusHistory.changedBy",
        select: "firstname lastname email",
      });

    if (!ticket) {
      logger.warn(
        "ticket-fetch",
        `Ticket not found or access denied for ID: ${req.params.id}`,
        req.user
      );
      return res
        .status(404)
        .json({ error: "Ticket not found or access denied" });
    }

    res.json(ticket);
  } catch (error) {
    logger.error(
      "ticket",
      `Failed to fetch single ticket by ID: ${req.params.id}`,
      error,
      user
    );
    res.status(500).json({ error: "Failed to fetch ticket" });
  }
};

exports.updateTicket = async (req, res) => {
  const user = req.user || null;
  const ticketId = req.params.id;
  const session = await mongoose.startSession();
  // The entire request body is our payload.
  const ticketDataForUpdate = req.body;

  // Destructure specific fields from the payload for verification and logic.
  const {
    shippingSameAsBilling,
    statusChangeComment,
    totalQuantity: frontendTotalQuantity,
    totalAmount: frontendTotalAmount,
    finalGstAmount: frontendFinalGstAmount,
    grandTotal: frontendGrandTotal,
    roundOff: frontendRoundOff,
    finalRoundedAmount: frontendFinalRoundedAmount
  } = ticketDataForUpdate;

  // Ensure deadline is null if an empty string is passed.
  // Frontend should send ISOString or null, but this is a safeguard.
  if (
    ticketDataForUpdate.hasOwnProperty("deadline") &&
    ticketDataForUpdate.deadline === ""
  ) {
    ticketDataForUpdate.deadline = null;
  }
  try {
    session.startTransaction();
    const originalTicket = await Ticket.findById(ticketId).session(
      session
    );

    if (!originalTicket) {
      logger.warn("ticket", `Ticket not found for update: ${ticketId}`, user);
      await session.abortTransaction();
      return res.status(404).json({ error: "Ticket not found" });
    }

    // Ensure goods are properly formatted for calculation
    if (ticketDataForUpdate.goods && Array.isArray(ticketDataForUpdate.goods)) {
      ticketDataForUpdate.goods = ticketDataForUpdate.goods.map(g => ({ ...g, quantity: Number(g.quantity || 0), price: Number(g.price || 0), amount: Number(g.amount || (Number(g.quantity || 0) * Number(g.price || 0))) }));
    }


    // Handle status change and history
    if (
      ticketDataForUpdate.status &&
      ticketDataForUpdate.status !== originalTicket.status
    ) {
      if (
        !statusChangeComment &&
        ticketDataForUpdate.status !== originalTicket.status
      ) {
        // Only require comment if status actually changes
        logger.warn(
          "ticket",
          `Status changed for ticket ${ticketId} but no statusChangeComment was provided.`,
          user
        );
        await session.abortTransaction();
        return res
          .status(400)
          .json({
            error: "A comment is required when changing the ticket status.",
          });
      }
      const newStatusEntry = {
        status: ticketDataForUpdate.status,
        changedAt: new Date(),
        changedBy: user.id,
        note: statusChangeComment || "Status updated.",
      };
      ticketDataForUpdate.statusHistory = [
        ...(originalTicket.statusHistory || []),
        newStatusEntry,
      ];
    }

    const canUpdate =
      originalTicket.createdBy.toString() === user.id.toString() ||
      (originalTicket.currentAssignee &&
        originalTicket.currentAssignee.toString() === user.id.toString()) ||
      user.role === "super-admin";

    if (!canUpdate) {
      logger.warn(
        "ticket",
        `User ${user.id} not authorized to update ticket ${ticketId}. Creator: ${originalTicket.createdBy}, Assignee: ${originalTicket.currentAssignee}`,
        user
      );
      await session.abortTransaction();
      return res
        .status(403)
        .json({ error: "Not authorized to update this ticket" });
    }

    // --- New Inventory Adjustment Logic based on Status Transitions ---
    const oldStatus = originalTicket.status;
    const newStatus = ticketDataForUpdate.status; // This is the incoming status from req.body

    // Scenario 1: Ticket is being put ON HOLD
    if (newStatus === "Hold" && oldStatus !== "Hold") {
      logger.info("inventory", `Ticket ${ticketId} moved to HOLD. Rolling back item quantities.`, user);
      for (const good of originalTicket.goods) { // Use original goods for rollback
        if (!good.description || Number(good.quantity) <= 0) continue;
        try {
          const itemToUpdate = await Item.findOne({ name: good.description, ...(good.hsnSacCode && { hsnCode: good.hsnSacCode }) }).session(session);
          if (itemToUpdate) {
            const { quantityInBaseUnit, unitNameUsed } = convertToBaseUnit(good.quantity, good.unit, itemToUpdate);
            const quantityToRollbackInBaseUnit = quantityInBaseUnit;
            const baseUnitName = itemToUpdate.baseUnit;

            if (quantityToRollbackInBaseUnit === 0) { // Skip if conversion resulted in 0
              logger.warn("inventory", `Calculated quantity to rollback is zero for item ${good.description}. Skipping inventory update.`, user);
              continue;
            }

            itemToUpdate.quantity += quantityToRollbackInBaseUnit;

            const historyEntry = {
              type: "Temporary Rollback (Ticket Hold)",
              date: new Date(),
              quantityChange: quantityToRollbackInBaseUnit, // Positive for addition
              details: `Ticket ${originalTicket.ticketNumber} put on hold. Rolled back ${good.quantity} ${unitNameUsed}. Action by: ${user.firstname || user.email}.`,

              ticketReference: originalTicket._id,
              userReference: user.id,
            };
            itemToUpdate.inventoryLog = itemToUpdate.inventoryLog || [];
            itemToUpdate.inventoryLog.push(historyEntry);
            if (itemToUpdate.quantity <= itemToUpdate.lowStockThreshold) {
              itemToUpdate.needsRestock = true;
              itemToUpdate.restockAmount = Math.max(0, itemToUpdate.lowStockThreshold - itemToUpdate.quantity);
            } else {
              itemToUpdate.needsRestock = false;
              itemToUpdate.restockAmount = 0;
            }
            await itemToUpdate.save({ session });
            logger.info("inventory", `Rolled back ${quantityToRollbackInBaseUnit.toFixed(2)} ${baseUnitName} for ${itemToUpdate.name} (Ticket ${ticketId} to Hold). New Qty: ${itemToUpdate.quantity.toFixed(2)}`, user);

          } else {
            logger.warn("inventory", `Item "${good.description}" (HSN: ${good.hsnSacCode || 'N/A'}) not found for Hold rollback (Ticket ${ticketId}).`, user);
          }
        } catch (invError) {
          logger.error("inventory", `Error rolling back stock for item "${good.description}" (Ticket ${ticketId} to Hold): ${invError.message}`, user, { error: invError });
        }
      }
    }
    // Scenario 2: Ticket is being taken OFF HOLD (and was previously Hold)
    else if (newStatus !== "Hold" && oldStatus === "Hold") {
      logger.info("inventory", `Ticket ${ticketId} moved FROM HOLD. Re-deducting item quantities.`, user);
      // Use current/new goods for re-deduction. If goods were changed while on hold, this reflects the new state.
      const goodsToDeduct = ticketDataForUpdate.goods || originalTicket.goods; // Prefer updated goods if available
      for (const good of goodsToDeduct) { 
        if (!good.description || Number(good.quantity) <= 0) continue;
        try {
          const itemToUpdate = await Item.findOne({ name: good.description, ...(good.hsnSacCode && { hsnCode: good.hsnSacCode }) }).session(session);
          if (itemToUpdate) {
            const { quantityInBaseUnit, unitNameUsed } = convertToBaseUnit(good.quantity, good.unit, itemToUpdate);
            const quantityToDeductInBaseUnit = quantityInBaseUnit;
            const baseUnitName = itemToUpdate.baseUnit;

            if (quantityToDeductInBaseUnit === 0) { // Skip if conversion resulted in 0
              logger.warn("inventory", `Calculated quantity to re-deduct is zero for item ${good.description}. Skipping inventory update.`, user);
              continue;
            }

            itemToUpdate.quantity -= quantityToDeductInBaseUnit;

            const historyEntry = {
              type: "Re-deducted (Ticket Off Hold)",
              date: new Date(),
              quantityChange: -quantityToDeductInBaseUnit, // Negative for deduction
              details: `Ticket ${originalTicket.ticketNumber} taken off hold. Deducted ${good.quantity} ${unitNameUsed}. Action by: ${user.firstname || user.email}.`,
              ticketReference: originalTicket._id,
              userReference: user.id,
            };
            itemToUpdate.inventoryLog = itemToUpdate.inventoryLog || [];
            itemToUpdate.inventoryLog.push(historyEntry);
            if (itemToUpdate.quantity <= itemToUpdate.lowStockThreshold) {
              itemToUpdate.needsRestock = true;
              itemToUpdate.restockAmount = Math.max(0, itemToUpdate.lowStockThreshold - itemToUpdate.quantity);
            } else {
              itemToUpdate.needsRestock = false;
              itemToUpdate.restockAmount = 0;
            }
            await itemToUpdate.save({ session });
            logger.info("inventory", `Re-deducted ${quantityToDeductInBaseUnit.toFixed(2)} ${baseUnitName} for ${itemToUpdate.name} (Ticket ${ticketId} from Hold). New Qty: ${itemToUpdate.quantity.toFixed(2)}`, user);
          } else {
            logger.warn("inventory", `Item "${good.description}" (HSN: ${good.hsnSacCode || 'N/A'}) not found for re-deduction (Ticket ${ticketId} from Hold).`, user);
          }
        } catch (invError) {
          logger.error("inventory", `Error re-deducting stock for item "${good.description}" (Ticket ${ticketId} from Hold): ${invError.message}`, user, { error: invError });
        }
      }
    }
    // Scenario 3: General update (not a Hold status transition OR status remains the same but goods might have changed)
    // This also covers if status changes but neither old nor new is "Hold"
    else if (newStatus !== "Hold" && oldStatus !== "Hold") {
      await handleInventoryAdjustmentOnTicketUpdate(originalTicket, ticketDataForUpdate, user, session);
    }
    // --- End New Inventory Adjustment Logic ---


    if (typeof shippingSameAsBilling === "boolean") {
      ticketDataForUpdate.shippingSameAsBilling = shippingSameAsBilling;
      if (shippingSameAsBilling === true) {
        ticketDataForUpdate.shippingAddress =
          ticketDataForUpdate.billingAddress || originalTicket.billingAddress; // Use updated billingAddress if available
      } else {
        if (
          Array.isArray(ticketDataForUpdate.shippingAddress) &&
          ticketDataForUpdate.shippingAddress.length === 5
        ) {
          // Correct format
        } else if (
          typeof ticketDataForUpdate.shippingAddress === "object" &&
          ticketDataForUpdate.shippingAddress !== null
        ) {
          const sa = ticketDataForUpdate.shippingAddress;
          ticketDataForUpdate.shippingAddress = [
            sa.address1 || "",
            sa.address2 || "",
            sa.state || "",
            sa.city || "",
            sa.pincode || "",
          ];
        } else {
          if (!ticketDataForUpdate.shippingAddress) {
            ticketDataForUpdate.shippingAddress =
              originalTicket.shippingAddress;
          }
        }
      }
    }

    // --- Recalculate Totals and GST based on updated goods using helper ---
    const {
      processedGoods,
      totalQuantity,
      totalAmount,
      gstBreakdown,
      totalCgstAmount,
      totalSgstAmount,
      totalIgstAmount,
      finalGstAmount,
      grandTotal,
      isBillingStateSameAsCompany,
      roundOff, // Calculated by helper
      finalRoundedAmount, // Calculated by helper
    } = calculateTicketTotals(ticketDataForUpdate.goods, ticketDataForUpdate.billingAddress || originalTicket.billingAddress);

    // Apply calculated values to ticketDataForUpdate
    ticketDataForUpdate.goods = processedGoods;
    ticketDataForUpdate.totalQuantity = totalQuantity;
    ticketDataForUpdate.totalAmount = totalAmount;
    ticketDataForUpdate.gstBreakdown = gstBreakdown;
    ticketDataForUpdate.totalCgstAmount = totalCgstAmount;
    ticketDataForUpdate.totalSgstAmount = totalSgstAmount;
    ticketDataForUpdate.totalIgstAmount = totalIgstAmount;
    ticketDataForUpdate.finalGstAmount = finalGstAmount;
    ticketDataForUpdate.grandTotal = grandTotal;
    ticketDataForUpdate.isBillingStateSameAsCompany = isBillingStateSameAsCompany;
    ticketDataForUpdate.roundOff = roundOff; // Set calculated roundOff
    ticketDataForUpdate.finalRoundedAmount = finalRoundedAmount; // Set calculated finalRoundedAmount

    // --- Frontend Calculation Verification ---
    const tolerance = 0.01;
    if (
      Math.abs(totalQuantity - frontendTotalQuantity) > tolerance ||
      Math.abs(totalAmount - frontendTotalAmount) > tolerance ||
      Math.abs(finalGstAmount - frontendFinalGstAmount) > tolerance ||
      Math.abs(grandTotal - frontendGrandTotal) > tolerance ||
      Math.abs(roundOff - frontendRoundOff) > tolerance ||
      Math.abs(finalRoundedAmount - frontendFinalRoundedAmount) > tolerance
    ) {
      logger.warn("ticket-update", `Calculation mismatch for ticket update ${ticketId}. Frontend vs Backend.`, user, { frontend: { totalQuantity: frontendTotalQuantity, totalAmount: frontendTotalAmount, finalGstAmount: frontendFinalGstAmount, grandTotal: frontendGrandTotal, roundOff: frontendRoundOff, finalRoundedAmount: frontendFinalRoundedAmount }, backend: { totalQuantity, totalAmount, finalGstAmount, grandTotal, roundOff, finalRoundedAmount }, action: "CALCULATION_MISMATCH_UPDATE" });
      await session.abortTransaction();
      return res.status(400).json({ message: "Calculation mismatch detected. Please re-check ticket details." });
    }

    const ticket = await Ticket.findOneAndUpdate(
      { _id: ticketId },
      ticketDataForUpdate,
      { new: true, runValidators: true, session: session }
    );

    if (!ticket) { // Should not happen if originalTicket was found
      logger.error("ticket", `Ticket update failed unexpectedly for ID: ${ticketId}.`, user, { requestBody: ticketDataForUpdate });
      await session.abortTransaction();
      return res.status(500).json({ error: "Failed to update ticket unexpectedly." });
    }

    // Update quotation status if ticket is closed and linked to a quotation
    if (
      originalTicket.status !== ticket.status &&
      ticket.status === "Closed" &&
      ticket.quotationNumber
    ) {
      try {
        const updatedQuotation = await Quotation.findOneAndUpdate(
          {
            referenceNumber: ticket.quotationNumber,
            user: originalTicket.createdBy, // Use original creator of the ticket to find the quotation
          },
          { $set: { status: "closed" } }, // Use $set for clarity
          { new: true, session: session }
        );
        if (updatedQuotation) {
          logger.info(
            "quotation",
            `Quotation ${ticket.quotationNumber} status updated to 'closed' as ticket is closed.`,
            user,
            { quotationId: updatedQuotation._id }
          );
        }
      } catch (quotationError) {
        logger.error(
          "quotation",
          `Failed to update quotation ${ticket.quotationNumber} status to 'closed'.`,
          quotationError,
          user
        );
        // Decide if this error should abort the transaction. For now, it's not critical.
      }
    }

    await session.commitTransaction();
    logger.info(
      "ticket",
      `Ticket ${ticket.ticketNumber} updated successfully by controller function.`,
      user,
      {
        ticketId: ticket._id,
        ticketNumber: ticket.ticketNumber,
      }
    );
    res.json(ticket);
  } catch (error) {
    await session.abortTransaction();
    logger.error(
      "ticket",
      `Failed to update ticket ID: ${ticketId}`,
      error,
      user,
      { requestBody: ticketDataForUpdate }
    );
    res.status(500).json({ error: "Failed to update ticket" });
  } finally {
    session.endSession();
  }
};

// Helper to convert quantity to base unit
const convertToBaseUnit = (quantity, unit, item) => {
  const transactionalUnitName = unit || item.baseUnit;
  const baseUnitName = item.baseUnit;
  let quantityInBaseUnit = Number(quantity);

  if (transactionalUnitName.toLowerCase() === baseUnitName.toLowerCase()) {
    return { quantityInBaseUnit, unitNameUsed: baseUnitName };
  }

  const transactionalUnitInfo = item.units.find(u => u.name.toLowerCase() === transactionalUnitName.toLowerCase());
  if (transactionalUnitInfo) {
    const conversionFactor = Number(transactionalUnitInfo.conversionFactor);
    quantityInBaseUnit = Number(quantity) * conversionFactor;
    return { quantityInBaseUnit, unitNameUsed: transactionalUnitName };
  }

  logger.warn("inventory", `Unit "${transactionalUnitName}" not found for item "${item.name}". Assuming quantity is in base unit.`, null);
  return { quantityInBaseUnit, unitNameUsed: baseUnitName }; // Fallback to base unit if conversion not found
};

// Helper for general inventory adjustment on ticket update (not Hold transitions)
const handleInventoryAdjustmentOnTicketUpdate = async (originalTicket, updatedTicketData, user, session) => {
  // Create a map to track net changes for each item.
  // Key: 'description-hsnSacCode', Value: { oldBaseQty: 0, newBaseQty: 0 }
  const itemBaseQtyChanges = new Map();

  // Helper function to get base quantity, with caching to reduce DB calls
  const getItemDetailsAndBaseQuantity = async (good, itemCache) => {
    const itemKey = `${good.description}-${good.hsnSacCode || ""}`;
    let itemDetails = itemCache.get(itemKey);
    if (!itemDetails) {
      itemDetails = await Item.findOne({ name: good.description, ...(good.hsnSacCode && { hsnCode: good.hsnSacCode }) }).lean();
      if (itemDetails) itemCache.set(itemKey, itemDetails);
    }

    if (!itemDetails) {
      logger.warn("inventory", `Item "${good.description}" not found for quantity calculation.`, user);
      return { quantity: 0, item: null };
    }

    const { quantityInBaseUnit } = convertToBaseUnit(good.quantity, good.unit, itemDetails);
    return { quantity: quantityInBaseUnit, item: itemDetails };
  };

  const itemCache = new Map(); // Cache item details

  // Populate old quantities in base units
  for (const good of originalTicket.goods || []) {
    if (!good.description || Number(good.quantity) <= 0) continue;
    const key = `${good.description}-${good.hsnSacCode || ""}`;
    const { quantity: oldBaseQty } = await getItemDetailsAndBaseQuantity(good, itemCache);
    if (!itemBaseQtyChanges.has(key)) itemBaseQtyChanges.set(key, { oldBaseQty: 0, newBaseQty: 0 });
    itemBaseQtyChanges.get(key).oldBaseQty += oldBaseQty;
  }

  // Populate new quantities in base units
  for (const good of updatedTicketData.goods || []) {
    if (!good.description || Number(good.quantity) <= 0) continue;
    const key = `${good.description}-${good.hsnSacCode || ""}`;
    const { quantity: newBaseQty } = await getItemDetailsAndBaseQuantity(good, itemCache);
    if (!itemBaseQtyChanges.has(key)) itemBaseQtyChanges.set(key, { oldBaseQty: 0, newBaseQty: 0 });
    itemBaseQtyChanges.get(key).newBaseQty += newBaseQty;
  }

  // Apply net changes to the database
  for (const [key, { oldBaseQty, newBaseQty }] of itemBaseQtyChanges) {
    const netChangeInBaseUnit = newBaseQty - oldBaseQty;
    if (netChangeInBaseUnit === 0) continue; // No change, skip

    const [description, hsnSacCode] = key.split("-");
    try {
      const itemToUpdate = await Item.findOne({ name: description, ...(hsnSacCode && { hsnCode: hsnSacCode }) }).session(session);
      if (itemToUpdate) {
        if (itemToUpdate.quantity === undefined || itemToUpdate.quantity === null) {
          logger.error("inventory", `Item "${description}" has NULL quantity before adjustment! Setting to 0.`, user);
          itemToUpdate.quantity = 0;
        }

        itemToUpdate.quantity -= netChangeInBaseUnit; // Deduct if netChange is positive (more used), add if negative (less used/removed)

        const historyEntry = {
          type: "Inventory Adjustment (Ticket Update)",
          date: new Date(),
          quantityChange: -netChangeInBaseUnit, // Negative for deduction, positive for addition
          details: `Ticket ${originalTicket.ticketNumber} updated. Base quantity changed from ${oldBaseQty.toFixed(2)} to ${newBaseQty.toFixed(2)}. Net stock change: ${(-netChangeInBaseUnit).toFixed(2)}. Action by: ${user.firstname || user.email}.`,
          ticketReference: originalTicket._id,
          userReference: user.id,
        };
        itemToUpdate.inventoryLog = itemToUpdate.inventoryLog || [];
        itemToUpdate.inventoryLog.push(historyEntry);

        if (itemToUpdate.quantity <= itemToUpdate.lowStockThreshold) {
          itemToUpdate.needsRestock = true;
          itemToUpdate.restockAmount = Math.max(0, itemToUpdate.lowStockThreshold - itemToUpdate.quantity);
        } else {
          itemToUpdate.needsRestock = false;
          itemToUpdate.restockAmount = 0;
        }
        await itemToUpdate.save({ session });
        logger.info("inventory", `Adjusted stock for ${itemToUpdate.name} (Ticket ${originalTicket.ticketNumber} general update). Inventory Change: ${(-netChangeInBaseUnit).toFixed(2)}, New Qty: ${itemToUpdate.quantity.toFixed(2)}`, user);
      } else if (netChangeInBaseUnit > 0) { // Item was added to ticket but not found in DB
        logger.warn("inventory", `Item "${description}" (HSN: ${hsnSacCode || "N/A"}) not found for stock deduction (Ticket ${originalTicket.ticketNumber} general update).`, user);
      }
    } catch (invError) {
      logger.error("inventory", `Error adjusting stock for item "${description}" (Ticket ${originalTicket.ticketNumber} general update): ${invError.message}`, user, { error: invError });
    }
  }
};

exports.deleteTicket = async (req, res) => {
  const ticketId = req.params.id;
  const userId = req.user ? req.user.id : null;
  const userEmail = req.user ? req.user.email : "N/A";
  const user = req.user || null;
  const logDetails = { userId, ticketId, model: "Ticket", userEmail };
  const session = await mongoose.startSession();

  logger.info(
    "delete",
    `[DELETE_INITIATED] Ticket ID: ${ticketId} by User: ${userEmail}. Transaction started.`,
    user,
    logDetails
  );

  try {
    session.startTransaction();
    const ticketToBackup = await Ticket.findOne({ _id: ticketId }).session(
      session
    );

    if (!ticketToBackup) {
      logger.warn(
        "delete",
        `[NOT_FOUND] Ticket not found for deletion: ${ticketId}.`,
        user,
        logDetails
      );
      await session.abortTransaction();
      return res.status(404).json({ error: "Ticket not found" });
    }

    // If ticket status is not "Hold", "Closed", or any other status that implies items are already "logically" returned or consumed,
    // then add quantities back to inventory.
    // If it's "Hold", items were already returned. If "Closed", items are considered consumed/delivered.
    if (!["Hold", "Closed"].includes(ticketToBackup.status)) {
        logger.info("inventory", `Ticket ${ticketId} being deleted (status: ${ticketToBackup.status}). Rolling back item quantities.`, user);
        for (const good of ticketToBackup.goods) {
            if (!good.description || Number(good.quantity) <= 0) continue;
            try {
                const itemToUpdate = await Item.findOne({ name: good.description, ...(good.hsnSacCode && { hsnCode: good.hsnSacCode }) }).session(session);
                if (itemToUpdate) {
                    const { quantityInBaseUnit, unitNameUsed } = convertToBaseUnit(good.quantity, good.unit, itemToUpdate);
                    const quantityToRollbackInBaseUnit = quantityInBaseUnit;
                    const baseUnitName = itemToUpdate.baseUnit;
                    if (quantityToRollbackInBaseUnit === 0) { // Skip if conversion resulted in 0
                      logger.warn("inventory", `Calculated quantity to rollback is zero for item ${good.description}. Skipping inventory update.`, user);
                      continue;
                    }

                    itemToUpdate.quantity += quantityToRollbackInBaseUnit;

                    const historyEntry = {
                        type: "Rollback (Ticket Deletion)",
                        date: new Date(),
                        quantityChange: quantityToRollbackInBaseUnit, // Positive for addition
                        details: `Ticket ${ticketToBackup.ticketNumber} deleted. Rolled back ${good.quantity} ${unitNameUsed}. Action by: ${user.firstname || user.email}.`,
                        ticketReference: ticketToBackup._id,
                        userReference: user.id,
                    };
                    itemToUpdate.inventoryLog = itemToUpdate.inventoryLog || [];
                    itemToUpdate.inventoryLog.push(historyEntry);

                    if (itemToUpdate.quantity < itemToUpdate.lowStockThreshold) {
                        itemToUpdate.needsRestock = true;
                        itemToUpdate.restockAmount = Math.max(0, itemToUpdate.lowStockThreshold - itemToUpdate.quantity);
                    } else {
                        itemToUpdate.needsRestock = false;
                        itemToUpdate.restockAmount = 0;
                    }
                    await itemToUpdate.save({ session });
                    logger.info("inventory", `Rolled back ${quantityToRollbackInBaseUnit.toFixed(2)} ${baseUnitName} for ${itemToUpdate.name} (Ticket ${ticketId} deletion). New Qty: ${itemToUpdate.quantity.toFixed(2)}`, user);

                } else {
                    logger.warn("inventory", `Item "${good.description}" (HSN: ${good.hsnSacCode || 'N/A'}) not found for rollback during Ticket ${ticketId} deletion.`, user);
                }
            } catch (invError) {
                logger.error("inventory", `Error rolling back stock for item "${good.description}" (Ticket ${ticketId} deletion): ${invError.message}`, user, { error: invError });
                // Decide if this should abort the transaction. For now, it won't to allow ticket deletion to proceed.
            }
        }
    }


    if (ticketToBackup.quotationNumber) {
      try {
        const updatedQuotation = await Quotation.findOneAndUpdate(
          {
            referenceNumber: ticketToBackup.quotationNumber,
            user: ticketToBackup.createdBy,
          },
          { $set: { status: "hold" } }, // Use $set
          { new: true, session: session }
        );
        if (updatedQuotation) {
          logger.info(
            "quotation",
            `Quotation ${ticketToBackup.quotationNumber} status updated to 'hold' due to linked ticket deletion.`,
            user,
            { quotationId: updatedQuotation._id, ticketId: ticketToBackup._id }
          );
        } else {
          logger.warn(
            "quotation",
            `Quotation ${ticketToBackup.quotationNumber} not found or not updated to 'hold' during linked ticket deletion.`,
            user,
            { ticketId: ticketToBackup._id }
          );
        }
      } catch (quotationError) {
        logger.error(
          "quotation",
          `Failed to update quotation ${ticketToBackup.quotationNumber} status to 'hold' during linked ticket deletion.`,
          quotationError,
          user,
          { ticketId: ticketToBackup._id }
        );
        // Decide if this error should abort the transaction. For now, it won't.
      }
    }

    const isCreator = ticketToBackup.createdBy.toString() === userId;
    const isSuperAdmin = req.user.role === "super-admin";

    if (!isCreator && !isSuperAdmin) {
      logger.warn(
        `[AUTH_FAILURE] Unauthorized delete attempt for Ticket ID: ${ticketId} by User: ${userEmail}.`,
        { ...logDetails, createdBy: ticketToBackup.createdBy.toString() }
      );
      await session.abortTransaction();
      return res.status(403).json({
        error: "Forbidden: You do not have permission to delete this ticket.",
      });
    }

    const backupData = {
      originalModel: "Ticket",
      data: ticketToBackup.toObject(), // Store the full ticket object
      originalId: ticketToBackup._id,
      deletedBy: userId,
      deletedAt: new Date(),
      originalCreatedAt: ticketToBackup.createdAt,
      originalUpdatedAt: ticketToBackup.updatedAt,
      // backupReason: `${
      //   isSuperAdmin ? "Admin" : "User"
      // }-initiated deletion via API`,
    };
    // Remove fields that are specific to the live Ticket model but not needed or problematic in backup's generic 'data'
    delete backupData.data._id;
    delete backupData.data.__v;

    const newBackupEntry = new UniversalBackup(backupData);
    await newBackupEntry.save({ session });
    logger.info(
      "delete",
      `[BACKUP_SUCCESS] Ticket successfully backed up. Backup ID: ${newBackupEntry._id}.`,
      user,
      {
        ...logDetails,
        originalId: ticketToBackup._id,
        backupId: newBackupEntry._id,
        backupModel: "UniversalBackup",
      }
    );

    await Ticket.findByIdAndDelete(ticketId, { session });
    logger.info(
      "delete",
      `[ORIGINAL_DELETE_SUCCESS] Original Ticket successfully deleted.`,
      user,
      { ...logDetails, originalId: ticketToBackup._id }
    );

    const ticketDocumentsPath = path.join(
      process.cwd(),
      "uploads",
      ticketId.toString()
    ); // Ensure ticketId is string
    if (fs.existsSync(ticketDocumentsPath)) {
      try {
        await fs.remove(ticketDocumentsPath);
        logger.info(
          "delete",
          `[DOC_FOLDER_DELETE_SUCCESS] Successfully deleted documents folder: ${ticketDocumentsPath}`,
          user,
          logDetails
        );
      } catch (folderError) {
        logger.error(
          "delete",
          `[DOC_FOLDER_DELETE_ERROR] Error deleting documents folder ${ticketDocumentsPath}:`,
          folderError,
          user,
          logDetails
        );
      }
    }

    const usersToUpdate = new Set();
    if (ticketToBackup.createdBy)
      usersToUpdate.add(ticketToBackup.createdBy.toString());
    if (ticketToBackup.currentAssignee)
      usersToUpdate.add(ticketToBackup.currentAssignee.toString());

    for (const uid of usersToUpdate) {
      try {
        await User.findByIdAndUpdate(
          uid,
          { $pull: { tickets: ticketToBackup._id } },
          { session }
        );
        logger.info(
          "delete",
          `[USER_TICKET_REF_REMOVE_SUCCESS] Removed ticket reference ${ticketToBackup._id} from User ID: ${uid}.`,
          user,
          { ...logDetails, targetUserId: uid }
        );
      } catch (userUpdateError) {
        logger.error(
          `[USER_TICKET_REF_REMOVE_ERROR] Failed to remove ticket reference ${ticketToBackup._id} from User ID: ${uid}.`,
          userUpdateError,
          { ...logDetails, targetUserId: uid }
        );
      }
    }

    await session.commitTransaction();
    res.status(200).json({
      message: "Ticket deleted and backed up successfully.",
      originalId: ticketToBackup._id,
      backupId: newBackupEntry._id,
    });
  } catch (error) {
    await session.abortTransaction();
    logger.error(
      "delete",
      `[DELETE_ERROR] Error during Ticket deletion process for ID: ${ticketId} by ${userEmail}.`,
      error,
      user,
      logDetails
    );
    res
      .status(500)
      .json({ error: "Failed to delete ticket. Check server logs." });
  } finally {
    session.endSession();
  }
};

exports.adminDeleteTicket = async (req, res) => {
  const user = req.user || null;
  logger.debug(
    "delete",
    `[ADMIN_DELETE_TICKET_INVOKED] Admin delete initiated for Ticket ID: ${req.params.id}.`,
    user,
    { ticketId: req.params.id, model: "Ticket" }
  );
  if (req.user.role !== "super-admin") {
    logger.warn(
      "delete",
      `[AUTH_FAILURE] Non-admin attempt to use adminDeleteTicket for Ticket ID: ${req.params.id}.`,
      user,
      { ticketId: req.params.id }
    );
    return res.status(403).json({ error: "Forbidden" });
  }
  return exports.deleteTicket(req, res);
};



exports.checkExistingTicket = async (req, res) => {
  try {
    const { quotationNumber } = req.params;
    const ticket = await Ticket.findOne({ quotationNumber });
    res.status(200).json({ exists: !!ticket });
  } catch (error) {
    logger.error(
      "ticket",
      `Failed to check existing ticket for quotation number: ${quotationNumber}`,
      error,
      req.user
    );
    res.status(500).json({ message: "Failed to check existing ticket" });
  }
};

exports.transferTicket = async (req, res) => {
  const ticketId = req.params.id;
  const { userId: newAssigneeId, note } = req.body;
  const initiator = req.user;
  const session = await mongoose.startSession();

  const logContext = {
    ticketId,
    initiatorId: initiator.id,
    initiatorEmail: initiator.email,
    newAssigneeId,
    action: "TICKET_TRANSFER",
  };

  try {
    session.startTransaction();
    logger.info(
      "transfer",
      `[TRANSFER_INITIATED] Ticket ID: ${ticketId} to User ID: ${newAssigneeId} by User: ${initiator.email}.`,
      initiator,
      logContext
    );

    const ticket = await Ticket.findById(ticketId).session(session);
    if (!ticket) {
      logger.warn(
        "transfer",
        `[NOT_FOUND] Ticket not found for transfer: ${ticketId}.`,
        initiator,
        logContext
      );
      await session.abortTransaction();
      return res.status(404).json({ message: "Ticket not found" });
    }

    const isSuperAdmin = initiator.role === "super-admin";
    const isCurrentAssignee =
      ticket.currentAssignee &&
      ticket.currentAssignee.toString() === initiator.id.toString();

    if (!isSuperAdmin && !isCurrentAssignee) {
      logger.warn(
        "transfer",
        `[AUTH_FAILURE] Unauthorized transfer attempt for Ticket ID: ${ticketId} by User: ${initiator.email}.`,
        initiator,
        { ...logContext, currentAssignee: ticket.currentAssignee?.toString() }
      );
      await session.abortTransaction();
      return res.status(403).json({
        message:
          "Forbidden: Only the current assignee or a super-admin can transfer this ticket.",
      });
    }

    const newAssigneeUser = await User.findById(newAssigneeId).session(session);
    if (!newAssigneeUser) {
      logger.warn(
        "transfer",
        `[ASSIGNEE_NOT_FOUND] User to transfer to (ID: ${newAssigneeId}) not found.`,
        initiator,
        logContext
      );
      await session.abortTransaction();
      return res.status(404).json({ message: "User to transfer to not found" });
    }

    const oldAssigneeId = ticket.currentAssignee
      ? ticket.currentAssignee.toString()
      : null;

    ticket.transferHistory.push({
      from: ticket.currentAssignee,
      to: newAssigneeId,
      transferredBy: initiator.id,
      note: note || "",
      transferredAt: new Date(),
      statusAtTransfer: ticket.status,
    });

    ticket.assignmentLog.push({
      assignedTo: newAssigneeId,
      assignedBy: initiator.id,
      action: "transferred",
      assignedAt: new Date(),
    });

    ticket.currentAssignee = newAssigneeId;
    await ticket.save({ session });

    if (oldAssigneeId && oldAssigneeId !== newAssigneeId.toString()) {
      await User.findByIdAndUpdate(
        oldAssigneeId,
        { $pull: { tickets: ticket._id } },
        { session }
      );
    }
    await User.findByIdAndUpdate(
      newAssigneeId,
      { $addToSet: { tickets: ticket._id } },
      { session }
    );

    await session.commitTransaction();

    const populatedTicket = await Ticket.findById(ticket._id)
      .populate("currentAssignee", "firstname lastname email")
      .populate(
        "transferHistory.from transferHistory.to transferHistory.transferredBy",
        "firstname lastname email"
      )
      .populate("createdBy", "firstname lastname email");

    logger.info(
      "transfer",
      `[TRANSFER_SUCCESS] Ticket ID: ${ticketId} successfully transferred to ${newAssigneeUser.email}.`,
      initiator,
      logContext
    );
    res.status(200).json({
      message: "Ticket transferred successfully.",
      ticket: populatedTicket,
    });
  } catch (error) {
    await session.abortTransaction();
    logger.error(
      "transfer",
      `[TRANSFER_ERROR] Error transferring Ticket ID: ${ticketId}.`,
      error,
      initiator,
      logContext
    );
    res.status(500).json({
      message: "Server error during ticket transfer.",
      details: error.message,
    });
  } finally {
    session.endSession();
  }
};

exports.getTransferCandidates = asyncHandler(async (req, res) => {
  const requestingUser = req.user;

  if (!requestingUser || !requestingUser.id) {
    logger.error(
      "ticket-transfer-candidates",
      "Authentication error: User or User ID not found in request for transfer candidates.",
      null,
      {
        path: req.path,
        ip: req.ip,
        receivedUserId: requestingUser ? requestingUser.id : "N/A",
        receivedUserEmail: requestingUser ? requestingUser.email : "N/A",
      }
    );
    return res
      .status(401)
      .json({ message: "Authentication required or user session invalid." });
  }

  const logContext = {
    initiatorId: requestingUser.id,
    initiatorEmail: requestingUser.email,
    action: "FETCH_TICKET_TRANSFER_CANDIDATES",
  };

  try {
    const users = await User.find({
      _id: { $ne: requestingUser.id },
      role: { $nin: ["client"] }, // Exclude 'client' role
      isActive: true,
    })
      .select("firstname lastname email role _id")
      .lean();

    logger.info(
      "ticket-transfer-candidates",
      `Successfully fetched ${users.length} user candidates for ticket transfer by ${requestingUser.email}.`,
      requestingUser,
      logContext
    );
    res.status(200).json(users);
  } catch (error) {
    logger.error(
      "ticket-transfer-candidates",
      `Failed to fetch user candidates for ticket transfer by ${requestingUser.email}.`,
      error,
      requestingUser,
      { ...logContext, errorMessage: error.message, stack: error.stack }
    );
    res.status(500).json({
      message: "Failed to load users for transfer.",
      details: error.message,
    });
  }
});

// --- Logic moved from index.js (Legacy - consider refactoring or removing if fully replaced) ---

exports.getAllTickets_IndexLogic = async (req, res) => {
  const user = req.user || null;
  try {
    const tickets = await OpenticketModel.find().sort({ createdAt: -1 });
    res.json(tickets);
  } catch (err) {
    logger.error(
      "ticket-controller",
      "Error fetching all tickets (index.js logic)",
      err,
      user
    );
    res.status(500).json({ error: "Error fetching tickets" });
  }
};

exports.createTicket_IndexLogic = async (req, res) => {
  const user = req.user || null;
  try {
    const {
      companyName,
      quotationNumber,
      billingAddress,
      shippingAddress,
      goods,
    } = req.body;

    const totalQuantity = goods.reduce((sum, item) => sum + item.quantity, 0);
    const totalAmount = goods.reduce((sum, item) => sum + item.amount, 0);
    const gstAmount = totalAmount * 0.18;
    const grandTotal = totalAmount + gstAmount;

    const newTicket = await OpenticketModel.create({
      companyName,
      quotationNumber,
      billingAddress,
      shippingAddress,
      goods,
      totalQuantity,
      totalAmount,
      gstAmount,
      grandTotal,
      status: "Quotation Sent",
      statusHistory: [{ status: "Quotation Sent", changedAt: new Date() }],
      documents: {
        quotation: null,
        po: null,
        pi: null,
        challan: null,
        packingList: null,
        feedback: null,
        other: [],
      },
    });
    logger.info("ticket-controller", `Ticket created (index.js logic)`, user, {
      ticketId: newTicket._id,
      companyName: newTicket.companyName,
    });
    res.status(201).json(newTicket);
  } catch (err) {
    logger.error(
      "ticket-controller",
      "Error creating ticket (index.js logic)",
      err,
      user,
      { requestBody: req.body }
    );
    res
      .status(500)
      .json({ error: "Error creating ticket", details: err.message });
  }
};


exports.getQuotationByReference = asyncHandler(async (req, res) =>{
  const user = req.user;
  const { quotationNumber } = req.params;

  if (!user || !user.id) {
    logger.error(
      "quotation-fetch-by-ref",
      "Authentication error: User or User ID not found in request.",
      null,
      { quotationNumber }
    );
    return res
      .status(401)
      .json({ message: "Authentication required or user session invalid." });
  }

  const logContext = {
    initiatorId: user.id,
    initiatorEmail: user.email,
    quotationNumber,
    action: "FETCH_QUOTATION_BY_REF",
  };

  try {
    // Find the quotation by reference number
    const quotation = await Quotation.findOne({ referenceNumber: quotationNumber })
      .populate("user", "firstname lastname email") // Populate the user who created the quotation
      .populate("client", "companyName phone gstNumber") // Populate client details
      .lean(); // Use lean() for faster reads if you don't need Mongoose document methods

    if (!quotation) {
      logger.warn(
        "quotation-fetch-by-ref",
        `Quotation not found for reference number: ${quotationNumber}.`,
        user,
        logContext
      );
      return res.status(404).json({ message: "Quotation not found." });
    }

    // Optional Authorization Check:
    // You might want to add a check here to ensure the requesting user is authorized
    // to view this specific quotation. For example, check if they are the creator,
    // an admin, or perhaps linked to a ticket created from this quotation.
    // For simplicity, this example assumes any authenticated user can fetch a quotation by ref,
    // but you should implement stricter checks based on your application's logic.
    // Example check:
    // if (user.role !== 'super-admin' && user.role !== 'admin' && quotation.user.toString() !== user.id.toString()) {
    //     logger.warn("quotation-fetch-by-ref", `Unauthorized access attempt for quotation ${quotationNumber}.`, user, logContext);
    //     return res.status(403).json({ message: "Forbidden: You do not have permission to view this quotation." });
    // }

    logger.info(
      "quotation-fetch-by-ref",
      `Successfully fetched quotation ${quotationNumber}.`,
      user,
      logContext
    );
    res.status(200).json(quotation);
  } catch (error) {
    logger.error(
      "quotation-fetch-by-ref",
      `Failed to fetch quotation by reference number: ${quotationNumber}.`,
      error,
      user,
      { ...logContext, errorMessage: error.message, stack: error.stack }
    );
    res.status(500).json({
      message: "Failed to load quotation.",
      details: error.message,
    });
  }
});
// --- End New Controller Function ---

exports.uploadTicketDocument = async (req, res) => {
  const user = req.user || null;
    const ticketId = req.params.id; // Assuming ticketId is in params
  const session = await mongoose.startSession();
  try {
        session.startTransaction();
    const { documentType } = req.body;
    const isOther = req.body.isOther === 'true' || req.body.isOther === true;

    if (!req.file) {
      logger.warn(
        "ticket-controller",
        "No file uploaded (index.js logic)",
        user,
        { ticketId: req.params.id, documentType }
      );
      return res.status(400).json({ error: "No file uploaded" });
    }
    const ticket = await OpenticketModel.findById(ticketId);

    if (!ticket) {
      // It's good practice to remove the uploaded file if the parent record doesn't exist
      if (req.file && req.file.path) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (unlinkErr) {
          logger.error("document-upload-cleanup", `Failed to delete orphaned file: ${req.file.path} for non-existent ticket ${ticketId}`, unlinkErr);
        }
      }
      logger.warn(
        "ticket-controller",
        "Ticket not found for document upload (index.js logic)",
        user,
        { ticketId: ticketId }
      );
      return res.status(404).json({ error: "Ticket not found" });
    }

    const newDocumentData = {
      path: req.file.filename, // filename as saved by multer
      originalName: req.file.originalname,
      uploadedAt: new Date(),
       uploadedBy: user._id,
    };
      if (documentType === 'other') {
      ticket.documents.other.push(newDocumentData);
    } else {
      ticket.documents[documentType] = newDocumentData;
    }
    const updatedTicket = await ticket.save();

    logger.info(
      "ticket-controller",
      `Document uploaded (index.js logic)`,
      user,
      { ticketId: updatedTicket._id, documentType }
    );
    res.json(updatedTicket);
  } catch (err) {
    logger.error(
      "ticket-controller",
      `Error uploading document for ticket ${req.params.id} (index.js logic)`,
      err,
      user,
      { documentType: req.body.documentType }
    );
    res.status(500).json({ error: "Error uploading document" });
  } finally {
    session.endSession();
  }
};

exports.deleteTicketDocument = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
const ticketId = req.params.id;     const { documentType, documentId, isOther } = req.body; // Get these from request body
    const user = req.user;

    if (!documentType) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Document type is required.' });
    }

    const ticket = await Ticket.findById(ticketId).session(session);
    if (!ticket) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Ticket not found.' });
    }

    // Authorization: Ensure user can modify this ticket (e.g., creator, assignee, admin)
    const canModify = user.role === 'super-admin' ||
                      user.role === 'admin' ||
                      (ticket.createdBy && ticket.createdBy.toString() === user._id.toString()) ||
                      (ticket.currentAssignee && ticket.currentAssignee.toString() === user._id.toString());

    if (!canModify) {
      await session.abortTransaction();
      return res.status(403).json({ message: 'You are not authorized to delete documents for this ticket.' });
    }

    let filePathToDelete;
    let documentDeleted = false;

    if (isOther === true || isOther === 'true') {
      if (ticket.documents && ticket.documents.other && documentId) {
        const docIndex = ticket.documents.other.findIndex(doc => doc._id && doc._id.toString() === documentId);
        if (docIndex > -1) {
          filePathToDelete = ticket.documents.other[docIndex].path;
          ticket.documents.other.splice(docIndex, 1);
          documentDeleted = true;
        }
      }
    } else {
      if (ticket.documents && ticket.documents[documentType] && ticket.documents[documentType].path) {
        filePathToDelete = ticket.documents[documentType].path;
        ticket.documents[documentType] = null; // Or an empty object if schema requires
        documentDeleted = true;
      }
    }

    if (!documentDeleted) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Document not found on the ticket.' });
    }

    await ticket.save({ session });

    // Delete the physical file
    if (filePathToDelete) {
      const fullPath = path.join(process.cwd(), 'uploads', ticket._id.toString(), filePathToDelete);
      try {
        if (await fs.pathExists(fullPath)) {
          await fs.unlink(fullPath);
          logger.info('document-delete', `Successfully deleted physical file: ${fullPath}`, user, { ticketId });
        } else {
          logger.warn('document-delete', `Physical file not found for deletion: ${fullPath}`, user, { ticketId });
        }
      } catch (fileError) {
        logger.error('document-delete', `Error deleting physical file ${fullPath}:`, fileError, user, { ticketId });
        // Decide if this should cause the transaction to abort.
        // For now, we'll let the DB change persist even if file deletion fails, but log it.
      }
    }

    await session.commitTransaction();
    logger.info('document-delete', `Document ${documentType} (ID: ${documentId || 'N/A'}) deleted for ticket ${ticketId}`, user);
    res.status(200).json({ message: 'Document deleted successfully.', ticket });

  } catch (error) {
    await session.abortTransaction();
    logger.error('document-delete', `Error deleting document for ticket ${req.params.ticketId || req.params.id}`, error, req.user);
    res.status(500).json({ message: 'Server error while deleting document.', error: error.message });
  } finally {
    session.endSession();
  }
};


exports.updateTicket_IndexLogic = async (req, res) => {
  const user = req.user || null;
  try {
    const { _id, __v, createdAt, updatedAt, ...updateData } = req.body;
    const updatedTicket = await OpenticketModel.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );
    if (!updatedTicket) {
      logger.warn(
        "ticket-controller",
        "Ticket not found for update (index.js logic)",
        user,
        { ticketId: req.params.id }
      );
      return res.status(404).json({ error: "Ticket not found" });
    }
    logger.info("ticket-controller", `Ticket updated (index.js logic)`, user, {
      ticketId: updatedTicket._id,
    });
    res.json(updatedTicket);
  } catch (err) {
    logger.error(
      "ticket-controller",
      `Error updating ticket ${req.params.id} (index.js logic)`,
      err,
      user,
      { requestBody: req.body }
    );
    res
      .status(500)
      .json({ error: "Error updating ticket", message: err.message });
  }
};

exports.serveFile_IndexLogic = (req, res) => {
  const user = req.user || null;
  const filename = req.params.filename;
  const ticketId = req.params.ticketId; // Assuming ticketId is part of the path for ticket-specific files

  // Construct path to ticket-specific upload folder
  const filePath = ticketId
    ? path.join(process.cwd(), "uploads", ticketId, filename)
    : path.join(process.cwd(), "uploads", filename); // Fallback for general uploads if any

  if (!fs.existsSync(filePath)) {
    logger.warn(
      "ticket-controller",
      "File not found for serving (index.js logic)",
      user,
      { filename, ticketId, attemptedPath: filePath }
    );
    return res.status(404).send("File not found");
  }

  const ext = path.extname(filename).toLowerCase();
  let contentType = "application/octet-stream";

  if (ext === ".pdf") contentType = "application/pdf";
  else if (ext === ".doc" || ext === ".docx")
    contentType = "application/msword";
  else if (ext === ".xls" || ext === ".xlsx")
    contentType = "application/vnd.ms-excel";
  else if (ext === ".png") contentType = "image/png";
  else if (ext === ".jpg" || ext === ".jpeg") contentType = "image/jpeg";

  if (contentType === "application/pdf") {
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${path.basename(filename)}"`
    );
  } else {
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${path.basename(filename)}"`
    );
  }
  res.setHeader("Content-Type", contentType);
  logger.debug("ticket-controller", `Serving file (index.js logic)`, user, {
    filename,
    contentType,
  });
  fs.createReadStream(filePath).pipe(res);
};

// exports.generateTicketsReport = async (req, res) => {
//   // Delegate to the dedicated report controller
//   ReportController.generateTicketsReport(req, res);
// };
