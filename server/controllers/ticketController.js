const Ticket = require("../models/opentickets");
const UniversalBackup = require("../models/universalBackup");
const Quotation = require("../models/quotation");
const OpenticketModel = require("../models/opentickets.js");
const User = require("../models/users");
const logger = require("../logger");
const { Item } = require("../models/itemlist");
const fs = require("fs-extra");
const path = require("path");
const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const ReportController = require("./reportController");

const COMPANY_REFERENCE_STATE = "UTTAR PRADESH";

exports.createTicket = asyncHandler(async (req, res) => {
  const user = req.user; // Auth middleware should ensure req.user exists
  const session = await mongoose.startSession(); // Start session for potential transaction

  if (!user || !user.id) {
  logger.log({
  user: req.user || user || initiator || null,
  page: "Ticket",
  action: "Error",
  api: req.originalUrl,
  req,
  message: "User Not Found",
  details: { error: error.message, stack: error.stack },
  level: "error"
});
    return res
      .status(401)
      .json({ error: "Unauthorized: User not authenticated." });
  }
  const { newTicketDetails, sourceQuotationData } = req.body;

  if (!newTicketDetails) {
    logger.log({
      user: req.user || user || null,
      page: "Ticket",
      action: "Error",
      api: req.originalUrl,
      req,
      message: "Missing newTicketDetails in request body",
      details: { error: "newTicketDetails is required" },
      level: "error"
    });
    return res
      .status(400)
      .json({ error: "Missing newTicketDetails in request body." });
  }

  let finalTicketData = {
    ...newTicketDetails,
    createdBy: user.id,
    currentAssignee: user.id,
    assignedTo: user.id, // Default assignedTo to creator
    dispatchDays:
      sourceQuotationData?.dispatchDays ||
      newTicketDetails.dispatchDays ||
      "7-10 working", // Ensure default
    roundOff: newTicketDetails.roundOff || 0, // Capture from frontend
    finalRoundedAmount: newTicketDetails.finalRoundedAmount,
  };

  // If creating from a quotation, prioritize sourceQuotationData
  if (sourceQuotationData && sourceQuotationData.referenceNumber) {
    const clientData = sourceQuotationData.client || {};
    let quotationBillingAddress = sourceQuotationData.billingAddress || {};
    let quotationShippingAddress = sourceQuotationData.shippingAddress || {};

    // Determine deadline: Use newTicketDetails.deadline if provided, else use quotation's validityDate
    let determinedDeadline = newTicketDetails.deadline
      ? new Date(newTicketDetails.deadline)
      : sourceQuotationData.validityDate
      ? new Date(sourceQuotationData.validityDate)
      : null;

    finalTicketData = {
      ...finalTicketData,
      companyName: clientData.companyName || newTicketDetails.companyName,
      quotationNumber: sourceQuotationData.referenceNumber,
      client: clientData._id || newTicketDetails.client?._id,
      clientPhone: clientData.phone || newTicketDetails.clientPhone,
      clientGstNumber: clientData.gstNumber || newTicketDetails.clientGstNumber,
      billingAddress: quotationBillingAddress,
      shippingAddress: quotationShippingAddress,
      goods: (sourceQuotationData.goods || newTicketDetails.goods || []).map(
        (qGood, index) => ({
          srNo: qGood.srNo || index + 1,
          description: qGood.description,
          hsnCode: qGood.hsnCode || "",
          quantity: Number(qGood.quantity || 0),
          unit: qGood.unit || "nos",
          price: Number(qGood.price || 0),
          amount: Number(qGood.amount || 0),
          originalPrice: Number(qGood.originalPrice || qGood.price || 0),
          maxDiscountPercentage: Number(qGood.maxDiscountPercentage || 0),
          gstRate: Number(qGood.gstRate || 0),
          subtexts: qGood.subtexts || [],
          originalItem: qGood.originalItem?._id || qGood.originalItem || undefined, // Always ObjectId
        })
      ),
      termsAndConditions:
        sourceQuotationData.termsAndConditions ||
        newTicketDetails.termsAndConditions, // If terms are on quotation
      dispatchDays:
        sourceQuotationData.dispatchDays ||
        newTicketDetails.dispatchDays ||
        "7-10 working", // Ensure default
      deadline: determinedDeadline, // Use the determined deadline
      roundOff: newTicketDetails.roundOff || 0, // Prioritize if specifically sent with newTicketDetails
      finalRoundedAmount: newTicketDetails.finalRoundedAmount,
    };
  }

  // Ensure deadline is null if an empty string is passed, otherwise Mongoose handles valid date strings/null.
  if (
    finalTicketData.hasOwnProperty("deadline") &&
    finalTicketData.deadline === ""
  ) {
    finalTicketData.deadline = null;
  }

  if (!finalTicketData.deadline) {
    logger.log({
      user: req.user || user || null,
      page: "Ticket",
      action: "Error",
      api: req.originalUrl,
      req,
      message: "Ticket deadline is required but not provided or derived.",
      details: { finalTicketData },
      level: "error"
    });
    return res.status(400).json({ error: "Ticket deadline is required." });
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

  // Ensure statusHistory is correctly formatted
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
      {
        status: finalTicketData.status || "Quotation Sent", // Default from schema
        changedAt: new Date(),
        changedBy: user.id,
        note:
          sourceQuotationData && sourceQuotationData.referenceNumber
            ? "Ticket created from quotation."
            : "Ticket created.",
      },
    ];
  }
  if (!finalTicketData.status) {
    finalTicketData.status = "Quotation Sent"; // Ensure status is set
  }

  // Construct shippingAddress array
  if (finalTicketData.shippingSameAsBilling === true) {
    finalTicketData.shippingAddress = { ...finalTicketData.billingAddress };
  } else if (finalTicketData.shippingAddressObj) {
    finalTicketData.shippingAddress = { ...finalTicketData.shippingAddressObj };
  } else if (
    typeof finalTicketData.shippingAddress !== "object" ||
    finalTicketData.shippingAddress === null
  ) {
    finalTicketData.shippingAddress = {
      address1: "",
      address2: "",
      state: "",
      city: "",
      pincode: "",
    };
  }
  delete finalTicketData.shippingAddressObj; // Remove if not part of schema

  // --- Calculate Totals and GST (Crucial for required fields) ---
  if (finalTicketData.goods && Array.isArray(finalTicketData.goods)) {
    finalTicketData.totalQuantity = finalTicketData.goods.reduce(
      (sum, item) => sum + Number(item.quantity || 0),
      0
    );
    finalTicketData.totalAmount = finalTicketData.goods.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    ); // Pre-GST

    const billingState = (finalTicketData.billingAddress[2] || "")
      .toUpperCase()
      .trim(); // Assuming state is at index 2
    const isBillingStateSameAsCompany =
      billingState === COMPANY_REFERENCE_STATE.toUpperCase().trim();
    finalTicketData.isBillingStateSameAsCompany = isBillingStateSameAsCompany;

    const gstGroups = {};
    finalTicketData.goods.forEach((item) => {
      const itemGstRate = parseFloat(item.gstRate);
      if (!isNaN(itemGstRate) && itemGstRate >= 0 && item.amount > 0) {
        if (!gstGroups[itemGstRate])
          gstGroups[itemGstRate] = { taxableAmount: 0 };
        gstGroups[itemGstRate].taxableAmount += item.amount || 0;
      }
    });

    const newGstBreakdown = [];
    let runningTotalCgst = 0,
      runningTotalSgst = 0,
      runningTotalIgst = 0;

    for (const rateKey in gstGroups) {
      const group = gstGroups[rateKey];
      const itemGstRate = parseFloat(rateKey);
      if (isNaN(itemGstRate) || itemGstRate < 0) continue;

      const taxableAmount = group.taxableAmount;
      let cgstAmount = 0,
        sgstAmount = 0,
        igstAmount = 0;
      let cgstRate = 0,
        sgstRate = 0,
        igstRate = 0;

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
      newGstBreakdown.push({
        itemGstRate,
        taxableAmount,
        cgstRate,
        cgstAmount,
        sgstRate,
        sgstAmount,
        igstRate,
        igstAmount,
      });
    }
    finalTicketData.gstBreakdown = newGstBreakdown;
    finalTicketData.totalCgstAmount = runningTotalCgst;
    finalTicketData.totalSgstAmount = runningTotalSgst;
    finalTicketData.totalIgstAmount = runningTotalIgst;
    finalTicketData.finalGstAmount =
      runningTotalCgst + runningTotalSgst + runningTotalIgst;
    finalTicketData.grandTotal =
      (finalTicketData.totalAmount || 0) +
      (finalTicketData.finalGstAmount || 0);
    if (
      finalTicketData.finalRoundedAmount === undefined ||
      finalTicketData.finalRoundedAmount === null
    ) {
      finalTicketData.finalRoundedAmount =
        finalTicketData.grandTotal + (finalTicketData.roundOff || 0);
    }
  } else {
    finalTicketData.totalQuantity = 0;
    finalTicketData.totalAmount = 0;
    finalTicketData.gstBreakdown = [];
    finalTicketData.totalCgstAmount = 0;
    finalTicketData.totalSgstAmount = 0;
    finalTicketData.totalIgstAmount = 0;
    finalTicketData.finalGstAmount = 0;
    finalTicketData.grandTotal = 0;
    finalTicketData.isBillingStateSameAsCompany = false;
    finalTicketData.roundOff = 0;
    finalTicketData.finalRoundedAmount = 0;
  }

  if (finalTicketData.goods && Array.isArray(finalTicketData.goods)) {
    finalTicketData.goods = finalTicketData.goods.map((item) => ({
      srNo: item.srNo,
      description: item.description,
      hsnCode: item.hsnCode || "", // Defensive: always set hsnCode
      quantity: Number(item.quantity || 0),
      unit: item.unit || "Nos",
      price: Number(item.price || 0),
      amount: Number(
        item.amount || Number(item.quantity || 0) * Number(item.price || 0)
      ),
      originalPrice: Number(item.originalPrice || item.price || 0),
      maxDiscountPercentage: Number(item.maxDiscountPercentage || 0),
      gstRate: Number(item.gstRate || 0),
      subtexts: item.subtexts || [],
    }));
  }

  

    // Instantiate the ticket object here to get its _id for logging purposes before saving.
  const ticket = new Ticket(finalTicketData);

  try {
    session.startTransaction(); // Start transaction before DB operations

    // --- Inventory Deduction Logic ---
    if (finalTicketData.goods && finalTicketData.goods.length > 0) {
      for (const good of finalTicketData.goods) {
        if (!good.description || !(Number(good.quantity) > 0)) {
        
          continue;
        }
        const itemToUpdate = await Item.findOne({
          name: good.description,
          ...(good.hsnCode && { hsnCode: good.hsnCode }),
        }).session(session);

        if (itemToUpdate) {
          let quantityToDecrementInBaseUnit = 0;
          const transactionalUnitName = good.unit || itemToUpdate.baseUnit;
          const baseUnitName = itemToUpdate.baseUnit;

          if (transactionalUnitName.toLowerCase() === baseUnitName.toLowerCase()) {
            quantityToDecrementInBaseUnit = Number(good.quantity);
          } else {
            const transactionalUnitInfo = itemToUpdate.units.find(
              (u) => u.name.toLowerCase() === transactionalUnitName.toLowerCase()
            );
            if (transactionalUnitInfo) {
              const conversionFactor = Number(transactionalUnitInfo.conversionFactor);
              quantityToDecrementInBaseUnit = Number(good.quantity) * conversionFactor;
            } else {
              quantityToDecrementInBaseUnit = Number(good.quantity);
            }
          }

          itemToUpdate.quantity -= quantityToDecrementInBaseUnit;

          // Add to inventoryLog for ticket creation deduction
          const historyEntry = {
            type: "Ticket Deduction (Creation)",
            date: new Date(),
            quantityChange: -quantityToDecrementInBaseUnit,
            details: `Items deducted for new Ticket ${finalTicketData.ticketNumber}. Transaction: ${good.quantity} ${transactionalUnitName}. Action by: ${user.firstname || user.email}.`,
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
          await itemToUpdate.save({ session });
        } else {
        }
      }
    }

    // --- Ticket Creation ---
    await ticket.save({ session });

    logger.log({
      user,
      page: "Ticket",
      action: "Create Ticket",
      api: req.originalUrl,
      req,
      message: `Ticket ${ticket.ticketNumber} created successfully.`,
      details: {
        ticketId: ticket._id,
        ticketNumber: ticket.ticketNumber,
        companyName: ticket.companyName,
      },
      level: "info"
    });

    // --- Update Quotation Status if applicable ---
    if (finalTicketData.quotationNumber && sourceQuotationData) {
      try {
        const quotationOwnerId =
          sourceQuotationData.user?._id || sourceQuotationData.user;
        if (!quotationOwnerId) {
         logger.log({
            user: req.user || user || null,
            page: "Ticket",
            action: "Create Ticket",
            api: req.originalUrl,
            req,
            message: `Quotation ${finalTicketData.quotationNumber} not found. Ticket ${ticket.ticketNumber} created successfully.`,
            details: {
              ticketId: ticket._id,
              ticketNumber: ticket.ticketNumber,
              companyName: ticket.companyName,
            },
            level: "warn"
          });
          return res.status(200).json({ success: true, ticket });
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
          } else {
          }
        }
      } catch (quotationError) {
       logger.log({
          user: req.user || user || null,
          page: "Ticket",
          action: "Create Ticket",
          api: req.originalUrl,
          req,
          message: `Failed to update quotation status for ticket ${ticket.ticketNumber}.`,
          details: {
            error: quotationError.message,
            stack: quotationError.stack,
            quotationNumber: ticket.quotationNumber,
            ticketId: ticket._id,
            ticketNumber: ticket.ticketNumber,
            companyName: ticket.companyName,
          },
          level: "error"
        });
        if (quotationError.name === "ValidationError") {
          return res.status(400).json({
            error: "Validation failed",
            details: quotationError.message,
            errors: quotationError.errors,
          });
        } else {
          return res
            .status(500)
            .json({ error: "Failed to update quotation status" });
          }
        // Decide if this error should abort the transaction. For now, it won't.
      }
    }

    await session.commitTransaction();
    return res.status(201).json(ticket);
  } catch (error) {
    await session.abortTransaction();
    logger.log({
      user: req.user,
      page: "Ticket",
      action: "Error",
      api: req.originalUrl,
      req,
      message: "Failed to create ticket",
      details: { error: error.message, stack: error.stack },
      level: "error"
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

  logger.log({
    user,
    page: "Ticket",
    action: "Get All Tickets",
    api: req.originalUrl,
    req,
    message: `Fetched ${tickets.length} of ${totalItems} tickets.`,
    details: { page: pageNum, limit: limitNum, query: finalQuery },
    level: "info"
  });

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
logger.log({
      user: req.user || user || null,
      page: "Ticket",
      action: "Get User Tickets",
      api: req.originalUrl,
      req,
      message: "Failed to fetch tickets",
      details: { error: error.message, stack: error.stack },
      level: "error"
    });
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
      logger.log({
        user: req.user,
        page: "Ticket",
        action: "Get Ticket By ID",
        api: req.originalUrl,
        req,
        message: `Ticket not found or access denied for ID: ${req.params.id}`,
        details: {},
        level: "warn"
      });
      return res
        .status(404)
        .json({ error: "Ticket not found or access denied" });
    }
    logger.log({
      user: req.user,
      page: "Ticket",
      action: "Get Ticket By ID",
      api: req.originalUrl,
      req,
      message: `Fetched ticket: ${req.params.id}`,
      details: { ticketId: req.params.id },
      level: "info"
    });
    res.json(ticket);
  } catch (error) {
    logger.log({
      user: req.user,
      page: "Ticket",
      action: "Get Ticket By ID Error",
      api: req.originalUrl,
      req,
      message: `Failed to fetch single ticket by ID: ${req.params.id}`,
      details: { error: error.message, stack: error.stack },
      level: "error"
    });
    res.status(500).json({ error: "Failed to fetch ticket" });
  }
};

exports.updateTicket = async (req, res) => {
  const user = req.user || null;
  const ticketId = req.params.id;
  const session = await mongoose.startSession();
  const {
    shippingSameAsBilling,
    statusChangeComment,
    roundOff,
    finalRoundedAmount,
    totalQuantity, totalAmount, gstBreakdown, totalCgstAmount, totalSgstAmount, totalIgstAmount, finalGstAmount, grandTotal, isBillingStateSameAsCompany,
    ...updatedTicketPayload
  } = req.body;
  let ticketDataForUpdate = { ...updatedTicketPayload };

  if (
    ticketDataForUpdate.hasOwnProperty("deadline") &&
    ticketDataForUpdate.deadline === ""
  ) {
    ticketDataForUpdate.deadline = null;
  }
  try {
    session.startTransaction();
    const originalTicket = await Ticket.findOne({ _id: ticketId }).session(
      session
    );

    if (!originalTicket) {
      await session.abortTransaction();
      return res.status(404).json({ error: "Ticket not found" });
    }

    if (
      ticketDataForUpdate.status &&
      ticketDataForUpdate.status !== originalTicket.status
    ) {
      if (
        !statusChangeComment &&
        ticketDataForUpdate.status !== originalTicket.status
      ) {
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
      await session.abortTransaction();
      return res
        .status(403)
        .json({ error: "Not authorized to update this ticket" });
    }

    if (ticketDataForUpdate.goods && Array.isArray(ticketDataForUpdate.goods)) {
      ticketDataForUpdate.goods = ticketDataForUpdate.goods.map((item) => ({
        ...item,
        subtexts: item.subtexts || [],
      }));
    }

    const oldStatus = originalTicket.status;
    const newStatus = ticketDataForUpdate.status;

    if (newStatus === "Hold" && oldStatus !== "Hold") {
      for (const good of originalTicket.goods) {
        try {
          const itemToUpdate = await Item.findOne({ name: good.description, ...(good.hsnCode && { hsnCode: good.hsnCode }) }).session(session);
          if (itemToUpdate) {
            let quantityToRollbackInBaseUnit = 0;
            const transactionalUnitName = good.unit || itemToUpdate.baseUnit;
            const baseUnitName = itemToUpdate.baseUnit;

            if (transactionalUnitName.toLowerCase() === baseUnitName.toLowerCase()) {
              quantityToRollbackInBaseUnit = Number(good.quantity);
            } else {
              const transactionalUnitInfo = itemToUpdate.units.find(u => u.name.toLowerCase() === transactionalUnitName.toLowerCase());
              if (transactionalUnitInfo) {
                const conversionFactor = Number(transactionalUnitInfo.conversionFactor);
                quantityToRollbackInBaseUnit = Number(good.quantity) * conversionFactor;
              } else {
                quantityToRollbackInBaseUnit = Number(good.quantity);
              }
            }

            itemToUpdate.quantity += quantityToRollbackInBaseUnit;

            const historyEntry = {
              type: "Temporary Rollback (Ticket Hold)",
              date: new Date(),
              quantityChange: quantityToRollbackInBaseUnit,
              details: `Ticket ${originalTicket.ticketNumber} put on hold. Rolled back ${good.quantity} ${transactionalUnitName}. Action by: ${user.firstname || user.email}.`,
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
          }
        } catch (invError) {
        }
      }
    }
    else if (newStatus !== "Hold" && oldStatus === "Hold") {
      const goodsToDeduct = ticketDataForUpdate.goods || originalTicket.goods;
      for (const good of goodsToDeduct) {
        try {
          const itemToUpdate = await Item.findOne({ name: good.description, ...(good.hsnCode && { hsnCode: good.hsnCode }) }).session(session);
          if (itemToUpdate) {
            let quantityToDeductInBaseUnit = 0;
            const transactionalUnitName = good.unit || itemToUpdate.baseUnit;
            const baseUnitName = itemToUpdate.baseUnit;

            if (transactionalUnitName.toLowerCase() === baseUnitName.toLowerCase()) {
              quantityToDeductInBaseUnit = Number(good.quantity);
            } else {
              const transactionalUnitInfo = itemToUpdate.units.find(u => u.name.toLowerCase() === transactionalUnitName.toLowerCase());
              if (transactionalUnitInfo) {
                const conversionFactor = Number(transactionalUnitInfo.conversionFactor);
                quantityToDeductInBaseUnit = Number(good.quantity) * conversionFactor;
              } else {
                quantityToDeductInBaseUnit = Number(good.quantity);
              }
            }

            itemToUpdate.quantity -= quantityToDeductInBaseUnit;

            const historyEntry = {
              type: "Re-deducted (Ticket Off Hold)",
              date: new Date(),
              quantityChange: -quantityToDeductInBaseUnit,
              details: `Ticket ${originalTicket.ticketNumber} taken off hold. Deducted ${good.quantity} ${transactionalUnitName}. Action by: ${user.firstname || user.email}.`,
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
          }
        } catch (invError) {
        }
      }
    }
    else if (newStatus !== "Hold" && oldStatus !== "Hold") {
      const itemBaseQtyChanges = new Map();

      const getBaseQuantity = async (good, itemCache) => {
        const itemKey = `${good.description}-${good.hsnCode || ""}`;
        let itemDetails = itemCache.get(itemKey);
        if (!itemDetails) {
          itemDetails = await Item.findOne({ name: good.description, ...(good.hsnCode && { hsnCode: good.hsnCode }) }).lean();
          if (itemDetails) itemCache.set(itemKey, itemDetails);
        }

        if (!itemDetails) {
          return 0;
        }

        const transactionalUnitName = good.unit || itemDetails.baseUnit;
        const baseUnitName = itemDetails.baseUnit;
        if (transactionalUnitName.toLowerCase() === baseUnitName.toLowerCase()) {
          return Number(good.quantity);
        }

        const unitInfo = itemDetails.units.find(u => u.name.toLowerCase() === transactionalUnitName.toLowerCase());
        if (unitInfo) {
          return Number(good.quantity) * Number(unitInfo.conversionFactor);
        }

        return Number(good.quantity);
      };

      const itemCache = new Map();

      for (const good of originalTicket.goods || []) {
        const key = `${good.description}-${good.hsnCode || ""}`;
        const oldBaseQty = await getBaseQuantity(good, itemCache);
        if (!itemBaseQtyChanges.has(key)) itemBaseQtyChanges.set(key, { oldBaseQty: 0, newBaseQty: 0 });
        itemBaseQtyChanges.get(key).oldBaseQty += oldBaseQty;
      }

      for (const good of ticketDataForUpdate.goods || []) {
        const key = `${good.description}-${good.hsnCode || ""}`;
        const newBaseQty = await getBaseQuantity(good, itemCache);
        if (!itemBaseQtyChanges.has(key)) itemBaseQtyChanges.set(key, { oldBaseQty: 0, newBaseQty: 0 });
        itemBaseQtyChanges.get(key).newBaseQty += newBaseQty;
      }

      for (const [key, { oldBaseQty, newBaseQty }] of itemBaseQtyChanges) {
        const netChangeInBaseUnit = newBaseQty - oldBaseQty;
        if (netChangeInBaseUnit === 0) continue;
        const [description, hsnCode] = key.split("-");
        try {
          const itemToUpdate = await Item.findOne({ name: description, ...(hsnCode && { hsnCode: hsnCode }) }).session(session);
          if (itemToUpdate) {
            // We subtract the net change from the current inventory.
            // If more items were added (netChange > 0), we deduct.
            // If items were removed (netChange < 0), we add back (subtracting a negative).

                        // Store the original quantity before applying the change
            const originalQuantity = itemToUpdate.quantity;

            if (itemToUpdate.quantity === undefined || itemToUpdate.quantity === null) {
              itemToUpdate.quantity = 0;
            }


            itemToUpdate.quantity -= netChangeInBaseUnit;

            const historyEntry = {
              type: "Inventory Adjustment (Ticket Update)",
              date: new Date(),
              quantityChange: -netChangeInBaseUnit, // A positive netChange (more items used) results in a negative quantityChange (deduction).
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
          } else if (netChangeInBaseUnit > 0) { // Item was added to ticket but not found in DB
          }
        } catch (invError) {
          logger.log({
            user: req.user || user || null,
            message: `Error adjusting stock for item "${description}" (Ticket ${ticketId} general update): ${invError.message}`,
            error: invError,
            level: "error",
          });
        }
      }
    }
    // --- End New Inventory Adjustment Logic ---


    if (typeof shippingSameAsBilling === "boolean") {
      ticketDataForUpdate.shippingSameAsBilling = shippingSameAsBilling;
      if (shippingSameAsBilling === true) {
        ticketDataForUpdate.shippingAddress =
          ticketDataForUpdate.billingAddress || originalTicket.billingAddress;
      } else {
        if (
          Array.isArray(ticketDataForUpdate.shippingAddress) &&
          ticketDataForUpdate.shippingAddress.length === 5
        ) {
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

    // --- Recalculate Totals and GST based on updated goods ---
    // This block is crucial to ensure backend data integrity
    if (ticketDataForUpdate.goods && Array.isArray(ticketDataForUpdate.goods)) {
        ticketDataForUpdate.totalQuantity = ticketDataForUpdate.goods.reduce(
            (sum, item) => sum + Number(item.quantity || 0),
            0
        );
        ticketDataForUpdate.totalAmount = ticketDataForUpdate.goods.reduce(
            (sum, item) => sum + Number(item.amount || 0),
            0
        );

        const currentBillingAddress = Array.isArray(ticketDataForUpdate.billingAddress) && ticketDataForUpdate.billingAddress.length === 5
            ? ticketDataForUpdate.billingAddress
            : Array.isArray(originalTicket.billingAddress) && originalTicket.billingAddress.length === 5
                ? originalTicket.billingAddress
                : ["", "", "", "", ""];

        const billingState = (currentBillingAddress[2] || "")
            .toUpperCase()
            .trim();
        const isBillingStateSameAsCompany =
            billingState === COMPANY_REFERENCE_STATE.toUpperCase().trim();
        ticketDataForUpdate.isBillingStateSameAsCompany = isBillingStateSameAsCompany;

        const gstGroups = {};
        ticketDataForUpdate.goods.forEach((item) => {
            const itemGstRate = parseFloat(item.gstRate);
            if (!isNaN(itemGstRate) && itemGstRate >= 0 && item.amount > 0) {
                if (!gstGroups[itemGstRate])
                    gstGroups[itemGstRate] = { taxableAmount: 0 };
                gstGroups[itemGstRate].taxableAmount += item.amount || 0;
            }
        });

        const newGstBreakdown = [];
        let runningTotalCgst = 0,
            runningTotalSgst = 0,
            runningTotalIgst = 0;

        for (const rateKey in gstGroups) {
            const group = gstGroups[rateKey];
            const itemGstRate = parseFloat(rateKey);
            if (isNaN(itemGstRate) || itemGstRate < 0) continue;

            const taxableAmount = group.taxableAmount;
            let cgstAmount = 0, sgstAmount = 0, igstAmount = 0;
            let cgstRate = 0, sgstRate = 0, igstRate = 0;

            if (itemGstRate > 0) {
                if (isBillingStateSameAsCompany) {
                    cgstRate = itemGstRate / 2; sgstRate = itemGstRate / 2;
                    cgstAmount = (taxableAmount * cgstRate) / 100; sgstAmount = (taxableAmount * sgstRate) / 100;
                    runningTotalCgst += cgstAmount; runningTotalSgst += sgstAmount;
                } else {
                    igstRate = itemGstRate;
                    igstAmount = (taxableAmount * igstRate) / 100;
                    runningTotalIgst += igstAmount;
                }
            }
            newGstBreakdown.push({ itemGstRate, taxableAmount, cgstRate, cgstAmount, sgstRate, sgstAmount, igstRate, igstAmount });
        }
        ticketDataForUpdate.gstBreakdown = newGstBreakdown;
        ticketDataForUpdate.totalCgstAmount = runningTotalCgst;
        ticketDataForUpdate.totalSgstAmount = runningTotalSgst;
        ticketDataForUpdate.totalIgstAmount = runningTotalIgst;
        ticketDataForUpdate.finalGstAmount = runningTotalCgst + runningTotalSgst + runningTotalIgst;
        ticketDataForUpdate.grandTotal = (ticketDataForUpdate.totalAmount || 0) + (ticketDataForUpdate.finalGstAmount || 0);

        ticketDataForUpdate.roundOff = roundOff || 0;
        ticketDataForUpdate.finalRoundedAmount = ticketDataForUpdate.grandTotal + ticketDataForUpdate.roundOff;

    } else {
        ticketDataForUpdate.totalQuantity = 0;
        ticketDataForUpdate.totalAmount = 0;
        ticketDataForUpdate.gstBreakdown = [];
        ticketDataForUpdate.totalCgstAmount = 0;
        ticketDataForUpdate.totalSgstAmount = 0;
        ticketDataForUpdate.totalIgstAmount = 0;
        ticketDataForUpdate.finalGstAmount = 0;
        ticketDataForUpdate.grandTotal = 0;
        ticketDataForUpdate.isBillingStateSameAsCompany = false;
        ticketDataForUpdate.roundOff = roundOff || 0;
        ticketDataForUpdate.finalRoundedAmount = ticketDataForUpdate.grandTotal + ticketDataForUpdate.roundOff;
    }

    const ticket = await Ticket.findOneAndUpdate(
      { _id: ticketId },
      ticketDataForUpdate,
      { new: true, runValidators: true, session: session }
    );

    if (!ticket) {
      await session.abortTransaction();
      return res.status(404).json({ error: "Ticket not found" });
    }

    if (
      originalTicket.status !== ticket.status &&
      ticket.status === "Closed" &&
      ticket.quotationNumber
    ) {
      try {
        await Quotation.findOneAndUpdate(
          {
            referenceNumber: ticket.quotationNumber,
            user: originalTicket.createdBy,
          },
          { $set: { status: "closed" } },
          { new: true, session: session }
        );
      } catch (quotationError) {
      }
    }

    await session.commitTransaction();
    res.json(ticket);
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ error: "Failed to update ticket" });
  } finally {
    session.endSession();
  }
};

exports.deleteTicket = async (req, res) => {
  const ticketId = req.params.id;
  const userId = req.user ? req.user.id : null;
  const userEmail = req.user ? req.user.email : "N/A";
  const user = req.user || null;
  const logDetails = { userId, ticketId, model: "Ticket", userEmail };
  const session = await mongoose.startSession();

  logger.log({
    user,
    page: "Ticket",
    action: "Delete Ticket",
    api: req.originalUrl,
    req,
    message: `[DELETE_INITIATED] Ticket ID: ${ticketId} by User: ${userEmail}. Transaction started.`,
    details: logDetails,
    level: "info"
  });

  try {
    session.startTransaction();
    const ticketToBackup = await Ticket.findOne({ _id: ticketId }).session(
      session
    );

    if (!ticketToBackup) {
      logger.log({
        user,
        page: "Ticket",
        action: "Delete Ticket",
        api: req.originalUrl,
        req,
        message: `[NOT_FOUND] Ticket not found for deletion: ${ticketId}.`,
        details: logDetails,
        level: "warn"
      });
      await session.abortTransaction();
      return res.status(404).json({ error: "Ticket not found" });
    }

    if (!["Hold", "Closed"].includes(ticketToBackup.status)) {
      logger.log({
        user,
        page: "Ticket",
        action: "Delete Ticket",
        api: req.originalUrl,
        req,
        message: `Ticket ${ticketId} being deleted (status: ${ticketToBackup.status}). Rolling back item quantities.`,
        details: logDetails,
        level: "info"
      });
      for (const good of ticketToBackup.goods) {
        try {
          const itemToUpdate = await Item.findOne({ name: good.description, ...(good.hsnCode && { hsnCode: good.hsnCode }) }).session(session);
          if (itemToUpdate) {
            let quantityToRollbackInBaseUnit = 0;
            const transactionalUnitName = good.unit || itemToUpdate.baseUnit;
            const baseUnitName = itemToUpdate.baseUnit;
            if (transactionalUnitName.toLowerCase() === baseUnitName.toLowerCase()) {
              quantityToRollbackInBaseUnit = Number(good.quantity);
            } else {
              const transactionalUnitInfo = itemToUpdate.units.find(u => u.name.toLowerCase() === transactionalUnitName.toLowerCase());
              if (transactionalUnitInfo) {
                const conversionFactor = Number(transactionalUnitInfo.conversionFactor);
                quantityToRollbackInBaseUnit = Number(good.quantity) * conversionFactor;
              } else {
                logger.log({
                  user,
                  page: "Ticket",
                  action: "Delete Ticket",
                  api: req.originalUrl,
                  req,
                  message: `Unit "${transactionalUnitName}" not found for item "${itemToUpdate.name}" during Ticket Deletion rollback. Assuming base unit.`,
                  details: { item: itemToUpdate.name },
                  level: "warn"
                });
                quantityToRollbackInBaseUnit = Number(good.quantity);
              }
            }

            itemToUpdate.quantity += quantityToRollbackInBaseUnit;

            const historyEntry = {
              type: "Rollback (Ticket Deletion)",
              date: new Date(),
              quantityChange: quantityToRollbackInBaseUnit,
              details: `Ticket ${ticketToBackup.ticketNumber} deleted. Rolled back ${good.quantity} ${transactionalUnitName}. Action by: ${user.firstname || user.email}.`,
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
            logger.log({
              user,
              page: "Ticket",
              action: "Delete Ticket",
              api: req.originalUrl,
              req,
              message: `Rolled back ${quantityToRollbackInBaseUnit.toFixed(2)} ${baseUnitName} for ${itemToUpdate.name} (Ticket ${ticketId} deletion). New Qty: ${itemToUpdate.quantity.toFixed(2)}`,
              details: { item: itemToUpdate.name },
              level: "info"
            });

          } else {
            logger.log({
              user,
              page: "Ticket",
              action: "Delete Ticket",
              api: req.originalUrl,
              req,
              message: `Item "${good.description}" (HSN: ${good.hsnCode || 'N/A'}) not found for rollback during Ticket ${ticketId} deletion.`,
              details: {},
              level: "warn"
            });
          }
        } catch (invError) {
          logger.log({
            user,
            page: "Ticket",
            action: "Inventory Rollback Error",
            api: req.originalUrl,
            req,
            message: "Inventory rollback error",
            details: { error: invError.message, stack: invError.stack },
            level: "error"
          });
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
          { $set: { status: "hold" } },
          { new: true, session: session }
        );
        if (updatedQuotation) {
          logger.log({
            user,
            page: "Ticket",
            action: "Delete Ticket",
            api: req.originalUrl,
            req,
            message: `Quotation ${ticketToBackup.quotationNumber} status updated to 'hold' due to linked ticket deletion.`,
            details: { quotationId: updatedQuotation._id, ticketId: ticketToBackup._id },
            level: "info"
          });
        } else {
          logger.log({
            user,
            page: "Ticket",
            action: "Delete Ticket",
            api: req.originalUrl,
            req,
            message: `Quotation ${ticketToBackup.quotationNumber} not found or not updated to 'hold' during linked ticket deletion.`,
            details: { ticketId: ticketToBackup._id },
            level: "warn"
          });
        }
      } catch (quotationError) {
        logger.log({
          user,
          page: "Ticket",
          action: "Quotation Rollback Error",
          api: req.originalUrl,
          req,
          message: "Quotation rollback error",
          details: { error: quotationError.message, stack: quotationError.stack },
          level: "error"
        });
      }
    }

    const isCreator = ticketToBackup.createdBy.toString() === userId;
    const isSuperAdmin = req.user.role === "super-admin";

    if (!isCreator && !isSuperAdmin) {
      logger.log({
        user,
        page: "Ticket",
        action: "Delete Ticket",
        api: req.originalUrl,
        req,
        message: `[AUTH_FAILURE] Unauthorized delete attempt for Ticket ID: ${ticketId} by User: ${userEmail}.`,
        details: { ...logDetails, createdBy: ticketToBackup.createdBy.toString() },
        level: "warn"
      });
      await session.abortTransaction();
      return res.status(403).json({
        error: "Forbidden: You do not have permission to delete this ticket.",
      });
    }

    const backupData = {
      originalModel: "Ticket",
      data: ticketToBackup.toObject(),
      originalId: ticketToBackup._id,
      deletedBy: userId,
      deletedAt: new Date(),
      originalCreatedAt: ticketToBackup.createdAt,
      originalUpdatedAt: ticketToBackup.updatedAt,
    };
    delete backupData.data._id;
    delete backupData.data.__v;

    const newBackupEntry = new UniversalBackup(backupData);
    await newBackupEntry.save({ session });
    logger.log({
      user,
      page: "Ticket",
      action: "Delete Ticket",
      api: req.originalUrl,
      req,
      message: `[BACKUP_SUCCESS] Ticket successfully backed up. Backup ID: ${newBackupEntry._id}.`,
      details: {
        ...logDetails,
        originalId: ticketToBackup._id,
        backupId: newBackupEntry._id,
        backupModel: "UniversalBackup",
      },
      level: "info"
    });

    await Ticket.findByIdAndDelete(ticketId, { session });
    logger.log({
      user,
      page: "Ticket",
      action: "Delete Ticket",
      api: req.originalUrl,
      req,
      message: `[ORIGINAL_DELETE_SUCCESS] Original Ticket successfully deleted.`,
      details: { ...logDetails, originalId: ticketToBackup._id },
      level: "info"
    });

    const ticketDocumentsPath = path.join(
      process.cwd(),
      "uploads",
      ticketId.toString()
    );
    if (fs.existsSync(ticketDocumentsPath)) {
      try {
        await fs.remove(ticketDocumentsPath);
        logger.log({
          user,
          page: "Ticket",
          action: "Delete Ticket",
          api: req.originalUrl,
          req,
          message: `[DOC_FOLDER_DELETE_SUCCESS] Successfully deleted documents folder: ${ticketDocumentsPath}`,
          details: logDetails,
          level: "info"
        });
      } catch (folderError) {
        logger.log({
          user,
          page: "Ticket",
          action: "Document Folder Deletion Error",
          api: req.originalUrl,
          req,
          message: "Document folder deletion error",
          details: { error: folderError.message, stack: folderError.stack },
          level: "error"
        });
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
        logger.log({
          user,
          page: "Ticket",
          action: "Delete Ticket",
          api: req.originalUrl,
          req,
          message: `[USER_TICKET_REF_REMOVE_SUCCESS] Removed ticket reference ${ticketToBackup._id} from User ID: ${uid}.`,
          details: { ...logDetails, targetUserId: uid },
          level: "info"
        });
      } catch (userUpdateError) {
        logger.log({
          user,
          page: "Ticket",
          action: "User Ticket Reference Removal Error",
          api: req.originalUrl,
          req,
          message: `Failed to remove ticket reference from User ID: ${uid}`,
          details: { error: userUpdateError.message, stack: userUpdateError.stack },
          level: "error"
        });
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
    logger.log({
      user,
      page: "Ticket",
      action: "Delete Ticket Error",
      api: req.originalUrl,
      req,
      message: `Failed to delete ticket ID: ${ticketId}`,
      details: { error: error.message, stack: error.stack },
      level: "error"
    });
    res
      .status(500)
      .json({ error: "Failed to delete ticket. Check server logs." });
  } finally {
    session.endSession();
  }
};

exports.adminDeleteTicket = async (req, res) => {
  const user = req.user || null;
  logger.log({
    user,
    page: "Ticket",
    action: "Admin Delete Ticket",
    api: req.originalUrl,
    req,
    message: `[ADMIN_DELETE_TICKET_INVOKED] Admin delete initiated for Ticket ID: ${req.params.id}.`,
    details: { ticketId: req.params.id, model: "Ticket" },
    level: "debug"
  });
  if (req.user.role !== "super-admin") {
    logger.log({
      user,
      page: "Ticket",
      action: "Admin Delete Ticket",
      api: req.originalUrl,
      req,
      message: `[AUTH_FAILURE] Non-admin attempt to use adminDeleteTicket for Ticket ID: ${req.params.id}.`,
      details: { ticketId: req.params.id },
      level: "warn"
    });
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
    logger.log({
      user: req.user,
      page: "Ticket",
      action: "Error",
      api: req.originalUrl,
      req,
      message: "Failed to check existing ticket",
      details: { error: error.message, stack: error.stack },
      level: "error"
    });
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

    const ticket = await Ticket.findById(ticketId).session(session);
    if (!ticket) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Ticket not found" });
    }

    const isSuperAdmin = initiator.role === "super-admin";
    const isCurrentAssignee =
      ticket.currentAssignee &&
      ticket.currentAssignee.toString() === initiator.id.toString();

    if (!isSuperAdmin && !isCurrentAssignee) {
      logger.log({
        user: initiator,
        page: "Ticket",
        action: "Transfer Ticket Error",
        api: req.originalUrl,
        req,
        message: `Unauthorized transfer attempt for Ticket ID: ${ticketId} by User: ${initiator.email}.`,
        details: { ...logContext, reason: "Not current assignee or super-admin" },
        level: "warn"
      });
      await session.abortTransaction();
      return res.status(403).json({
        message:
          "Forbidden: Only the current assignee or a super-admin can transfer this ticket.",
      });
    }

    const newAssigneeUser = await User.findById(newAssigneeId).session(session);
    if (!newAssigneeUser) {
     
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
  } catch (error) {
    await session.abortTransaction();
logger.log({
      user: req.user || initiator || null,
      page: "Ticket",
      action: "Error",
      api: req.originalUrl,
      req,
      message: "Server error during ticket transfer.",
      details: { error: error.message, stack: error.stack },
      level: "error"
    });
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
      role: { $nin: ["client"] },
      isActive: true,
    })
      .select("firstname lastname email role _id")
      .lean();

    logger.log({
      user: requestingUser,
      page: "Ticket",
      action: "Get Transfer Candidates",
      api: req.originalUrl,
      req,
      message: `Successfully fetched ${users.length} user candidates for ticket transfer by ${requestingUser.email}.`,
      details: logContext,
      level: "info"
    });
    res.status(200).json(users);
  } catch (error) {
    logger.log({
      user: requestingUser,
      page: "Ticket",
      action: "Get Transfer Candidates Error",
      api: req.originalUrl,
      req,
      message: `Failed to fetch user candidates for ticket transfer by ${requestingUser.email}.`,
      details: { ...logContext, errorMessage: error.message, stack: error.stack },
      level: "error"
    });
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
    logger.log({
      user,
      page: "Ticket",
      action: "Get All Tickets (Index Logic)",
      api: req.originalUrl,
      req,
      message: `Fetched all tickets (index.js logic)`,
      details: { count: tickets.length },
      level: "info"
    });
    res.json(tickets);
  } catch (err) {
    logger.log({
      user,
      page: "Ticket",
      action: "Get All Tickets (Index Logic)",
      api: req.originalUrl,
      req,
      message: `Error fetching all tickets (index.js logic)`,
      details: { error: err.message },
      level: "error"
    });
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
    logger.log({
      user,
      page: "Ticket",
      action: "Create Ticket (Index Logic)",
      api: req.originalUrl,
      req,
      message: `Ticket created (index.js logic)`,
      details: { ticketId: newTicket._id, companyName: newTicket.companyName },
      level: "info"
    });
    res.status(201).json(newTicket);
  } catch (err) {
    logger.log({
      user,
      page: "Ticket",
      action: "Create Ticket (Index Logic)",
      api: req.originalUrl,
      req,
      message: `Error creating ticket (index.js logic)`,
      details: { error: err.message, requestBody: req.body },
      level: "error"
    });
    res
      .status(500)
      .json({ error: "Error creating ticket", details: err.message });
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
      logger.log({
        user,
        page: "Ticket",
        action: "Update Ticket (Index Logic)",
        api: req.originalUrl,
        req,
        message: "Ticket not found for update (index.js logic)",
        details: { ticketId: req.params.id },
        level: "warn"
      });
      return res.status(404).json({ error: "Ticket not found" });
    }
    logger.log({
      user,
      page: "Ticket",
      action: "Update Ticket (Index Logic)",
      api: req.originalUrl,
      req,
      message: `Ticket updated (index.js logic)`,
      details: { ticketId: updatedTicket._id },
      level: "info"
    });
    res.json(updatedTicket);
  } catch (err) {
    logger.log({
      user,
      page: "Ticket",
      action: "Update Ticket (Index Logic)",
      api: req.originalUrl,
      req,
      message: `Error updating ticket ${req.params.id} (index.js logic)`,
      details: { error: err.message, requestBody: req.body },
      level: "error"
    });
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
  fs.createReadStream(filePath).pipe(res);
};

// exports.generateTicketsReport = async (req, res) => {
//   // Delegate to the dedicated report controller
//   ReportController.generateTicketsReport(req, res);
// };