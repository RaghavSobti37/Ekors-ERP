const Ticket = require("../models/opentickets");
const TicketBackup = require("../models/ticketBackup"); // Import backup model
const Quotation = require("../models/quotation"); // Import Quotation model
const OpenticketModel = require("../models/opentickets.js"); // Used by index.js logic
const User = require("../models/users");
const logger = require("../utils/logger"); // Import logger
const { Item } = require("../models/itemlist"); // Import Item model for inventory
const fs = require("fs-extra"); // fs-extra for recursive directory removal
const path = require("path");
const asyncHandler = require("express-async-handler");

exports.createTicket = asyncHandler(async (req, res) => {
  const user = req.user || null;
  // Ensure ticketData is a fresh object to avoid modifying req.body directly
  const ticketInputData = { ...req.body }; // Use a new variable for input

  if (!user) {
    logger.error(
      "ticket-create",
      "User not found in request. Auth middleware might not be working correctly."
    );
    return res
      .status(401)
      .json({ error: "Unauthorized: User not authenticated." });
  }

  // --- Billing Address from Quotation ---
  let quotationBillingAddressArray = ["", "", "", "", ""]; // Default empty address
  if (ticketInputData.quotationNumber) {
    const quotation = await Quotation.findOne({
      referenceNumber: ticketInputData.quotationNumber,
      // user: user.id // Assuming quotation is user-specific or accessible
    }).select("billingAddress"); // Only select billingAddress

    if (quotation && quotation.billingAddress) {
      const ba = quotation.billingAddress;
      // Frontend Tickets.jsx handleUpdateTicket converts object to [add1, add2, state, city, pincode]
      // So, the mapping from quotation object to ticket array should be:
      quotationBillingAddressArray = [
        ba.address1 || "",
        ba.address2 || "",
        ba.state || "", // state is 3rd element
        ba.city || "", // city is 4th element
        ba.pincode || "",
      ];
    } else {
      logger.warn(
        "ticket-create",
        `Quotation ${ticketInputData.quotationNumber} not found or has no billing address. Using default empty for ticket.`,
        user
      );
    }
  }

  const finalTicketData = { ...ticketInputData }; // Start with input data
  finalTicketData.createdBy = user.id;
  finalTicketData.currentAssignee = user.id; // Set currentAssignee to creator by default
  finalTicketData.billingAddress = quotationBillingAddressArray; // Set billing address from quotation

  // --- Shipping Address Logic ---
  if (ticketInputData.shippingSameAsBilling === true) {
    finalTicketData.shippingAddress = quotationBillingAddressArray; // Copy from billing
  } else {
    // Ensure shippingAddress from req.body is an array of 5 strings
    // The frontend should send it in the correct array format if not shippingSameAsBilling
    if (
      Array.isArray(ticketInputData.shippingAddress) &&
      ticketInputData.shippingAddress.length === 5
    ) {
      finalTicketData.shippingAddress = ticketInputData.shippingAddress;
    } else if (
      typeof ticketInputData.shippingAddress === "object" &&
      ticketInputData.shippingAddress !== null
    ) {
      // If frontend sends an object, convert it
      const sa = ticketInputData.shippingAddress;
      finalTicketData.shippingAddress = [
        sa.address1 || "",
        sa.address2 || "",
        sa.state || "",
        sa.city || "",
        sa.pincode || "",
      ];
    } else {
      finalTicketData.shippingAddress = ["", "", "", "", ""]; // Default empty if not provided correctly
      logger.warn(
        "ticket-create",
        `Shipping address not provided correctly and not same as billing. Using default empty.`,
        user
      );
    }
  }
  finalTicketData.shippingSameAsBilling =
    ticketInputData.shippingSameAsBilling || false;

  // Ensure subtexts are copied from input goods to final goods
  if (finalTicketData.goods && Array.isArray(finalTicketData.goods)) {
    finalTicketData.goods = finalTicketData.goods.map((item) => ({
      ...item,
      subtexts: item.subtexts || [],
    }));
  }

  // --- Ticket Number Generation ---
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");

  if (!finalTicketData.ticketNumber) {
    // Use finalTicketData
    finalTicketData.ticketNumber = `T-${year}${month}${day}-${hours}${minutes}${seconds}`;
    logger.warn(
      "ticket",
      `Generated fallback ticket number: ${finalTicketData.ticketNumber}`,
      user
    );
  }
  // --- Inventory Deduction Logic ---
  if (finalTicketData.goods && finalTicketData.goods.length > 0) {
    // Use finalTicketData
    for (const good of finalTicketData.goods) {
      if (!good.description || !(Number(good.quantity) > 0)) {
        logger.warn(
          "inventory",
          `Skipping item with missing description or invalid quantity: ${JSON.stringify(
            good
          )}`,
          user
        );
        continue;
      }

      try {
        const itemToUpdate = await Item.findOne({
          name: good.description,
          ...(good.hsnSacCode && { hsnCode: good.hsnSacCode }),
        });

        if (itemToUpdate) {
          const quantityToDecrement = Number(good.quantity);
          itemToUpdate.quantity -= quantityToDecrement;

          if (itemToUpdate.quantity < 0) {
            logger.warn(
              "inventory",
              `Stock for item ${itemToUpdate.name} went negative: ${itemToUpdate.quantity}`,
              user
            );
          }

          if (itemToUpdate.quantity < itemToUpdate.lowStockThreshold) {
            itemToUpdate.needsRestock = true;
            itemToUpdate.restockAmount = Math.max(
              0,
              itemToUpdate.lowStockThreshold - itemToUpdate.quantity
            );
          } else if (
            itemToUpdate.needsRestock &&
            itemToUpdate.quantity >= itemToUpdate.lowStockThreshold
          ) {
            itemToUpdate.needsRestock = false;
            itemToUpdate.restockAmount = 0;
          }

          await itemToUpdate.save();
          logger.info(
            "inventory",
            `Updated inventory for ${itemToUpdate.name}: -${quantityToDecrement}, new qty: ${itemToUpdate.quantity}`,
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
      } catch (invError) {
        logger.error(
          "inventory",
          `Error updating inventory for ${good.description}: ${invError.message}`,
          user,
          { error: invError }
        );
      }
    }
  }

  // --- Ticket Creation ---
  try {
    // Use finalTicketData for creating the ticket
    const ticket = new Ticket(finalTicketData);
    await ticket.save();

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

    // --- Add ticket to user's document --- (Removed as User schema doesn't have 'tickets' field)
    // await User.findByIdAndUpdate(user.id, {
    //   $push: { tickets: ticket._id },
    // });

    // --- Update Quotation Status if applicable ---
    if (finalTicketData.quotationNumber) {
      // Use finalTicketData
      try {
        const updatedQuotation = await Quotation.findOneAndUpdate(
          {
            referenceNumber: ticket.quotationNumber,
            user: user.id,
          },
          { status: "running" },
          { new: true }
        );

        if (updatedQuotation) {
          logger.info(
            "quotation",
            `Quotation ${finalTicketData.quotationNumber} set to 'running'.`,
            user,
            { quotationId: updatedQuotation._id }
          );
        }
      } catch (quotationError) {
        logger.error(
          "quotation",
          `Failed to update quotation status to 'running' for ${finalTicketData.quotationNumber}`,
          quotationError,
          user
        );
      }
    }

    return res.status(201).json(ticket);
  } catch (error) {
    logger.error("ticket", `Failed to create ticket`, error, user, {
      requestBody: req.body,
    }); // Log original req.body for debugging
    return res
      .status(500)
      .json({ error: "Failed to create ticket", details: error.message });
  }
});

// Get all tickets for the logged-in user
exports.getUserTickets = async (req, res) => {
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

// Get single ticket (only if created by the user)
exports.getTicket = async (req, res) => {
  try {
    const user = req.user || null;
    const ticket = await Ticket.findOne({
      _id: req.params.id,
      createdBy: req.user.id,
    });

    // logger.debug('ticket', `Fetched single ticket by ID: ${req.params.id}`, user); // Debug level
    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
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

// Update ticket
exports.updateTicket = async (req, res) => {
  const user = req.user || null;
  const ticketId = req.params.id;
  // Destructure shippingSameAsBilling, statusChangeComment, and the rest of ticket data
  const {
    shippingSameAsBilling,
    statusChangeComment,
    ...updatedTicketPayload
  } = req.body;
  let ticketDataForUpdate = { ...updatedTicketPayload }; // Use a new variable
  try {
    const originalTicket = await Ticket.findOne({ _id: ticketId });

    if (!originalTicket) {
      logger.warn("ticket", `Ticket not found for update: ${ticketId}`, user);
      return res.status(404).json({ error: "Ticket not found" });
    }

    // Handle status change and history
    if (
      ticketDataForUpdate.status &&
      ticketDataForUpdate.status !== originalTicket.status
    ) {
      // Use ticketDataForUpdate
      if (!statusChangeComment) {
        logger.warn(
          "ticket",
          `Status changed for ticket ${ticketId} but no statusChangeComment was provided.`,
          user
        );
        // return res.status(400).json({ error: "A comment is required when changing the ticket status." }); // Optional: make it strictly mandatory
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
      ]; // Use ticketDataForUpdate
    }

    // Authorization check (similar to your route but within controller)
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
      return res
        .status(403)
        .json({ error: "Not authorized to update this ticket" });
    }

    // Ensure subtexts are copied from input goods to update data
    if (ticketDataForUpdate.goods && Array.isArray(ticketDataForUpdate.goods)) {
      ticketDataForUpdate.goods = ticketDataForUpdate.goods.map((item) => ({
        ...item,
        subtexts: item.subtexts || [],
      }));
    }

    // --- Inventory Adjustment Logic ---
    const originalGoods = originalTicket.goods || [];
    const newGoods = ticketDataForUpdate.goods || []; // Use ticketDataForUpdate

    // Step A: Add back old quantities
    for (const good of originalGoods) {
      if (!good.description || !(Number(good.quantity) > 0)) continue;
      try {
        const itemToUpdate = await Item.findOne({
          name: good.description,
          ...(good.hsnSacCode && { hsnCode: good.hsnSacCode }),
        });
        if (itemToUpdate) {
          itemToUpdate.quantity += Number(good.quantity);
          if (
            itemToUpdate.needsRestock &&
            itemToUpdate.quantity >= itemToUpdate.lowStockThreshold
          ) {
            itemToUpdate.needsRestock = false;
            itemToUpdate.restockAmount = 0;
          } else if (itemToUpdate.needsRestock) {
            // Still needs restock, update amount
            itemToUpdate.restockAmount = Math.max(
              0,
              itemToUpdate.lowStockThreshold - itemToUpdate.quantity
            );
          }
          await itemToUpdate.save();
          logger.info(
            "inventory",
            `Restored stock for item ${itemToUpdate.name} (Ticket ${ticketId} update). Added: ${good.quantity}, New Qty: ${itemToUpdate.quantity}`,
            user
          );
        }
      } catch (invError) {
        logger.error(
          "inventory",
          `Error restoring stock for item "${good.description}" (Ticket ${ticketId} update): ${invError.message}`,
          user,
          { error: invError }
        );
      }
    }

    // Step B: Subtract new quantities
    for (const good of newGoods) {
      if (!good.description || !(Number(good.quantity) > 0)) continue;
      try {
        const itemToUpdate = await Item.findOne({
          name: good.description,
          ...(good.hsnSacCode && { hsnCode: good.hsnSacCode }),
        });
        if (itemToUpdate) {
          itemToUpdate.quantity -= Number(good.quantity);
          if (itemToUpdate.quantity < itemToUpdate.lowStockThreshold) {
            itemToUpdate.needsRestock = true;
            itemToUpdate.restockAmount = Math.max(
              0,
              itemToUpdate.lowStockThreshold - itemToUpdate.quantity
            );
          } else if (
            itemToUpdate.needsRestock &&
            itemToUpdate.quantity >= itemToUpdate.lowStockThreshold
          ) {
            itemToUpdate.needsRestock = false;
            itemToUpdate.restockAmount = 0;
          }
          await itemToUpdate.save();
          logger.info(
            "inventory",
            `Deducted stock for item ${itemToUpdate.name} (Ticket ${ticketId} update). Subtracted: ${good.quantity}, New Qty: ${itemToUpdate.quantity}`,
            user
          );
        } else {
          logger.warn(
            "inventory",
            `Item "${good.description}" (HSN: ${
              good.hsnSacCode || "N/A"
            }) not found in inventory for ticket ${ticketId} update. Stock not updated.`,
            user
          );
        }
      } catch (invError) {
        logger.error(
          "inventory",
          `Error deducting stock for item "${good.description}" (Ticket ${ticketId} update): ${invError.message}`,
          user,
          { error: invError }
        );
      }
    }
    // --- End Inventory Adjustment Logic ---

    // --- Shipping Address Update Logic ---
    if (typeof shippingSameAsBilling === "boolean") {
      ticketDataForUpdate.shippingSameAsBilling = shippingSameAsBilling;
      if (shippingSameAsBilling === true) {
        // If shipping is same as billing, copy billingAddress to shippingAddress
        // originalTicket.billingAddress should be the source of truth for billing address on an existing ticket
        ticketDataForUpdate.shippingAddress = originalTicket.billingAddress;
      } else {
        // If not same as billing, the frontend should provide the shippingAddress object/array
        // Ensure shippingAddress from req.body is an array of 5 strings
        if (
          Array.isArray(ticketDataForUpdate.shippingAddress) &&
          ticketDataForUpdate.shippingAddress.length === 5
        ) {
          // It's already in the correct format
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
            // Check if it was part of payload
            ticketDataForUpdate.shippingAddress =
              originalTicket.shippingAddress; // Keep original if not provided
          }
        }
      }
    }
    const ticket = await Ticket.findOneAndUpdate(
      { _id: ticketId }, // Filter already handled by originalTicket check and auth
      ticketDataForUpdate, // Use the modified data
      { new: true, runValidators: true }
    );

    if (!ticket) {
      logger.warn(
        "ticket",
        `Ticket not found for update: ${req.params.id}`,
        user,
        { requestBody: req.body }
      ); // Log original req.body
      return res.status(404).json({ error: "Ticket not found" });
    }

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

    // If ticket status changed to "Closed", update corresponding Quotation status to "closed"
    // Ensure user context for quotation update is correct, e.g., originalTicket.createdBy
    if (
      originalTicket.status !== ticket.status &&
      ticket.status === "Closed" &&
      ticket.quotationNumber
    ) {
      try {
        const updatedQuotation = await Quotation.findOneAndUpdate(
          {
            referenceNumber: ticket.quotationNumber,
            user: originalTicket.createdBy,
          },
          { status: "closed" },
          { new: true }
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
      }
    }
  } catch (error) {
    logger.error(
      "ticket",
      `Failed to update ticket ID: ${ticketId}`,
      error,
      user,
      { requestBody: ticketDataForUpdate }
    ); // Log modified data
    res.status(500).json({ error: "Failed to update ticket" });
  }
};

// Delete ticket
exports.deleteTicket = async (req, res) => {
  const ticketId = req.params.id;
  const userId = req.user ? req.user.id : null;
  const userEmail = req.user ? req.user.email : "N/A";
  const user = req.user || null;
  const logDetails = { userId, ticketId, model: "Ticket", userEmail };

  logger.info(
    "delete",
    `[DELETE_INITIATED] Ticket ID: ${ticketId} by User: ${userEmail}.`,
    user,
    logDetails
  );

  try {
    logger.debug(
      "delete",
      `[FETCH_ATTEMPT] Finding Ticket ID: ${ticketId} for backup and deletion.`,
      user,
      logDetails
    );
    const ticketToBackup = await Ticket.findOne({ _id: ticketId });

    if (!ticketToBackup) {
      logger.warn(
        "delete",
        `[NOT_FOUND] Ticket not found for deletion: ${ticketId}.`,
        user,
        logDetails
      );
      return res.status(404).json({ error: "Ticket not found" });
    }

    // Update corresponding Quotation status to "hold" before deleting the ticket
    if (ticketToBackup.quotationNumber) {
      try {
        const updatedQuotation = await Quotation.findOneAndUpdate(
          {
            referenceNumber: ticketToBackup.quotationNumber,
            user: ticketToBackup.createdBy,
          },
          { status: "hold" },
          { new: true }
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
      }
    }

    logger.debug(
      "delete",
      `[FETCH_SUCCESS] Found Ticket ID: ${ticketId} (Number: ${ticketToBackup.ticketNumber}). Performing authorization checks.`,
      user,
      { ...logDetails, ticketNumber: ticketToBackup.ticketNumber }
    );

    // Authorization: User can delete if they created it OR if they are a super-admin (for admin delete route)
    const isCreator = ticketToBackup.createdBy.toString() === userId;
    const isSuperAdmin = req.user.role === "super-admin";

    if (!isCreator && !isSuperAdmin) {
      logger.warn(
        `[AUTH_FAILURE] Unauthorized delete attempt for Ticket ID: ${ticketId} by User: ${userEmail}.`,
        { ...logDetails, createdBy: ticketToBackup.createdBy.toString() }
      );
      return res.status(403).json({
        error: "Forbidden: You do not have permission to delete this ticket.",
      });
    }
    logger.debug(
      "delete",
      `[AUTH_SUCCESS] Authorization successful for Ticket ID: ${ticketId}. Preparing for backup.`,
      user,
      logDetails
    );

    const backupData = ticketToBackup.toObject();
    const newBackupEntry = new TicketBackup({
      ...backupData,
      originalId: ticketToBackup._id,
      deletedBy: userId, // User performing the delete
      deletedAt: new Date(),
      originalCreatedAt: ticketToBackup.createdAt,
      originalUpdatedAt: ticketToBackup.updatedAt,
      backupReason: `${
        isSuperAdmin ? "Admin" : "User"
      }-initiated deletion via API`,
    });

    logger.debug(
      "delete",
      `[PRE_BACKUP_SAVE] Attempting to save backup for Ticket ID: ${ticketToBackup._id}.`,
      user,
      { ...logDetails, originalId: ticketToBackup._id }
    );
    await newBackupEntry.save();
    logger.info(
      "delete",
      `[BACKUP_SUCCESS] Ticket successfully backed up. Backup ID: ${newBackupEntry._id}.`,
      user,
      {
        ...logDetails,
        originalId: ticketToBackup._id,
        backupId: newBackupEntry._id,
        backupModel: "TicketBackup",
      }
    );

    logger.debug(
      "delete",
      `[PRE_ORIGINAL_DELETE] Attempting to delete original Ticket ID: ${ticketToBackup._id}.`,
      user,
      { ...logDetails, originalId: ticketToBackup._id }
    );
    await Ticket.findByIdAndDelete(ticketId);
    logger.info(
      "delete",
      `[ORIGINAL_DELETE_SUCCESS] Original Ticket successfully deleted.`,
      user,
      { ...logDetails, originalId: ticketToBackup._id }
    );

    // Delete associated documents folder
    const ticketDocumentsPath = path.join("uploads", ticketId); // Adjusted path if uploads are directly in ticketId folder
    if (fs.existsSync(ticketDocumentsPath)) {
      try {
        await fs.remove(ticketDocumentsPath); // fs-extra's remove is like rm -rf
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
        // Decide if this error should prevent ticket deletion or just be logged.
        // For now, we'll log it and proceed with ticket deletion.
      }
    }

    // Remove ticket from user's (creator and current assignee) tickets array
    const usersToUpdate = new Set();
    if (ticketToBackup.createdBy)
      usersToUpdate.add(ticketToBackup.createdBy.toString());
    if (ticketToBackup.currentAssignee)
      usersToUpdate.add(ticketToBackup.currentAssignee.toString());

    for (const uid of usersToUpdate) {
      try {
        logger.debug(
          "delete",
          `[USER_TICKET_REF_REMOVE_ATTEMPT] Removing ticket reference ${ticketToBackup._id} from User ID: ${uid}.`,
          user,
          { ...logDetails, targetUserId: uid }
        );
        await User.findByIdAndUpdate(uid, {
          $pull: { tickets: ticketToBackup._id },
        });
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

    res.status(200).json({
      message: "Ticket deleted and backed up successfully.",
      originalId: ticketToBackup._id,
      backupId: newBackupEntry._id,
    });
  } catch (error) {
    logger.error(
      "delete",
      `[DELETE_ERROR] Error during Ticket deletion process for ID: ${ticketId} by ${userEmail}.`,
      error,
      user,
      logDetails
    );
    if (
      error.name === "ValidationError" ||
      typeof ticketToBackup === "undefined" ||
      (ticketToBackup && (!newBackupEntry || newBackupEntry.isNew))
    ) {
      // Check if ticketToBackup was successfully fetched before attempting backup save
      logger.warn(
        "delete",
        `[ROLLBACK_DELETE] Backup failed or error before backup for Ticket ID: ${ticketId}. Original document will not be deleted.`,
        user,
        logDetails
      );
    }
    res
      .status(500)
      .json({ error: "Failed to delete ticket. Check server logs." });
  }
};

// Admin delete ticket - specific for super-admin role, uses the same core logic as deleteTicket
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
  // Call the generic deleteTicket function which now handles permissions correctly
  // The deleteTicket function will use req.user.role to determine if it's an admin deletion for logging/backupReason
  return exports.deleteTicket(req, res);
};

exports.generateTicketNumber = async (req, res) => {
  try {
    const user = req.user || null;
    // This function currently generates a timestamp-based ticket number for example/fallback.
    // A persistent counter (e.g., using a MongoDB 'Counter' collection) would be needed for sequential numbering.

    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");
    // Generates a timestamp-based ticket number.
    const ticketNumber = `T-${year}${month}${day}-${hours}${minutes}${seconds}`;

    res.status(200).json({
      nextTicketNumber: ticketNumber,
    });
    logger.debug(
      "ticket",
      `Generated example ticket number: ${ticketNumber}`,
      user
    );
  } catch (error) {
    logger.error(
      "ticket",
      `Failed to generate ticket number example`,
      error,
      req.user
    );
    res
      .status(500)
      .json({ message: "Failed to generate ticket number example" });
  }
};

exports.checkExistingTicket = async (req, res) => {
  try {
    const { quotationNumber } = req.params;
    const ticket = await Ticket.findOne({ quotationNumber });
    // logger.debug('ticket', `Checked for existing ticket with quotation number: ${quotationNumber}`, req.user, { quotationNumber, exists: !!ticket }); // Debug level

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
  const { userId: newAssigneeId, note } = req.body; // userId is the ID of the user to transfer TO
  const initiator = req.user; // User initiating the transfer

  const logContext = {
    ticketId,
    initiatorId: initiator.id,
    initiatorEmail: initiator.email,
    newAssigneeId,
    action: "TICKET_TRANSFER",
  };

  try {
    logger.info(
      "transfer",
      `[TRANSFER_INITIATED] Ticket ID: ${ticketId} to User ID: ${newAssigneeId} by User: ${initiator.email}.`,
      initiator,
      logContext
    );

    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      logger.warn(
        "transfer",
        `[NOT_FOUND] Ticket not found for transfer: ${ticketId}.`,
        initiator,
        logContext
      );
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
      return res.status(403).json({
        message:
          "Forbidden: Only the current assignee or a super-admin can transfer this ticket.",
      });
    }
    logger.debug(
      "transfer",
      `[AUTH_SUCCESS] Authorization successful for Ticket ID: ${ticketId}.`,
      initiator,
      logContext
    );

    const newAssigneeUser = await User.findById(newAssigneeId);
    if (!newAssigneeUser) {
      logger.warn(
        "transfer",
        `[ASSIGNEE_NOT_FOUND] User to transfer to (ID: ${newAssigneeId}) not found.`,
        initiator,
        logContext
      );
      return res.status(404).json({ message: "User to transfer to not found" });
    }

    const oldAssigneeId = ticket.currentAssignee
      ? ticket.currentAssignee.toString()
      : null;

    // Add to transferHistory
    ticket.transferHistory.push({
      from: ticket.currentAssignee, // The one who was assigned before this transfer
      to: newAssigneeId, // The new assignee
      transferredBy: initiator.id, // The user initiating the transfer
      note: note || "",
      transferredAt: new Date(),
      statusAtTransfer: ticket.status,
    });

    // Add to assignmentLog
    ticket.assignmentLog.push({
      assignedTo: newAssigneeId,
      assignedBy: initiator.id,
      action: "transferred",
      assignedAt: new Date(),
    });

    // Update currentAssignee
    ticket.currentAssignee = newAssigneeId;
    await ticket.save();
    logger.info(
      "transfer",
      `[TICKET_UPDATED] Ticket ID: ${ticketId} currentAssignee updated to ${newAssigneeId}.`,
      initiator,
      logContext
    );

    // Update user documents: remove from old assignee's list, add to new assignee's list
    if (oldAssigneeId && oldAssigneeId !== newAssigneeId.toString()) {
      await User.findByIdAndUpdate(oldAssigneeId, {
        $pull: { tickets: ticket._id },
      });
      logger.debug(
        "transfer",
        `[USER_TICKET_REF_REMOVED] Ticket ${ticket._id} pulled from old assignee ${oldAssigneeId}.`,
        initiator,
        logContext
      );
    }
    await User.findByIdAndUpdate(newAssigneeId, {
      $addToSet: { tickets: ticket._id },
    });
    logger.debug(
      "transfer",
      `[USER_TICKET_REF_ADDED] Ticket ${ticket._id} added to new assignee ${newAssigneeId}.`,
      initiator,
      logContext
    );

    const populatedTicket = await Ticket.findById(ticket._id)
      .populate("currentAssignee", "firstname lastname email")
      .populate(
        "transferHistory.from transferHistory.to transferHistory.transferredBy",
        "firstname lastname email"
      )
      .populate("createdBy", "firstname lastname email"); // Added createdBy for completeness

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
    logger.error(
      "transfer",
      `[TRANSFER_ERROR] Error transferring Ticket ID: ${ticketId}.`,
      error,
      initiator,
      logContext
    );
    res
      .status(500)
      .json({
        message: "Server error during ticket transfer.",
        details: error.message,
      });
  }
};

// @desc    Get a list of users suitable for ticket transfer
// @route   GET /api/tickets/transfer-candidates (New route)
// @access  Private (Authenticated users)
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

  // Now it's safe to define logContext
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
      .lean(); // Removed 'department'

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
    res
      .status(500)
      .json({
        message: "Failed to load users for transfer.",
        details: error.message,
      });
  }
});

// --- Logic moved from index.js ---

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
  const user = req.user || null; // This route in index.js was not authenticated, so user might be null
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
    const gstAmount = totalAmount * 0.18; // Assuming fixed GST
    const grandTotal = totalAmount + gstAmount;

    const newTicket = await OpenticketModel.create({
      // ticketNumber will be auto-generated by model or another mechanism if set up
      companyName,
      quotationNumber,
      billingAddress,
      shippingAddress,
      goods,
      totalQuantity,
      totalAmount,
      gstAmount,
      grandTotal,
      status: "Quotation Sent", // Default status
      statusHistory: [
        {
          status: "Quotation Sent",
          changedAt: new Date(),
          // changedBy would ideally be set if user context was available
        },
      ],
      documents: {
        // Initialize documents
        quotation: "",
        po: "",
        pi: "",
        challan: "",
        packingList: "",
        feedback: "",
      },
      // createdBy and currentAssignee would ideally be set if user context was available
      // For now, mirroring index.js which didn't explicitly set them from req.user
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

exports.uploadDocument_IndexLogic = async (req, res) => {
  const user = req.user || null; // This route in index.js was not authenticated
  try {
    const { documentType } = req.body;
    if (!req.file) {
      logger.warn(
        "ticket-controller",
        "No file uploaded (index.js logic)",
        user,
        { ticketId: req.params.id, documentType }
      );
      return res.status(400).json({ error: "No file uploaded" });
    }

    // req.file.path from multer in routes/tickets.js will be relative to 'uploads/<ticketId>/'
    // The original index.js saved to 'uploads/filename'. We adapt to the new structure.
    const filePath = req.file.filename; // filename is now relative to 'uploads/<ticketId>/'

    const update = {};
    update[`documents.${documentType}`] = {
      // Store as an object consistent with main model
      path: filePath,
      originalName: req.file.originalname,
      // uploadedBy: user ? user.id : null, // If user context was available
      uploadedAt: new Date(),
    };

    const updatedTicket = await OpenticketModel.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true }
    );

    if (!updatedTicket) {
      logger.warn(
        "ticket-controller",
        "Ticket not found for document upload (index.js logic)",
        user,
        { ticketId: req.params.id }
      );
      return res.status(404).json({ error: "Ticket not found" });
    }
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
  }
};

exports.updateTicket_IndexLogic = async (req, res) => {
  const user = req.user || null; // This route in index.js was not authenticated
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

// Note: The GET /uploads/:filename route from index.js is a general file serving route.
// If it's intended *only* for ticket documents, it can be adapted here.
// Otherwise, it should remain a general route in index.js or a separate file utility controller.
// For this exercise, assuming it's related, but it's a broader concern.
// A more robust solution would be to have specific, authenticated endpoints for ticket documents.
exports.serveFile_IndexLogic = (req, res) => {
  const user = req.user || null;
  const filename = req.params.filename;
  // The original path was path.join(__dirname, 'uploads', filename);
  // This needs to be relative to the project root's 'uploads' or the specific ticket's upload folder.
  // For simplicity, assuming 'uploads' is at the root of the server.
  // If files are in ticket-specific folders (e.g., uploads/ticketId/filename), this needs more context.
  const filePath = path.join(process.cwd(), "uploads", filename); // More robust path finding

  if (!fs.existsSync(filePath)) {
    logger.warn(
      "ticket-controller",
      "File not found for serving (index.js logic)",
      user,
      { filename }
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
