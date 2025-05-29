const Ticket = require("../models/opentickets");
const TicketBackup = require("../models/ticketBackup"); // Import backup model
const User = require("../models/users");
const logger = require("../utils/logger"); // Import logger
const fs = require('fs-extra'); // fs-extra for recursive directory removal
const path = require('path');

// Then modify the ticket creation endpoint to use the actual counter
exports.createTicket = async (req, res) => {
  const user = req.user || null;
  try {
    const ticketData = req.body;
    ticketData.createdBy = req.user.id;

    // Format with proper pattern to ensure consistency
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = String(now.getMonth() + 1).padStart(2, "0");
    ticketData.ticketNumber = `T-${year}${month}-${String(counter).padStart(
      4,
      "0"
    )}`;

    const ticket = new Ticket(ticketData);
    await ticket.save();
    logger.info("ticket", `Ticket created successfully`, user, {
      ticketId: ticket._id,
      ticketNumber: ticket.ticketNumber,
      companyName: ticket.companyName,
    });

    // Add ticket to user's tickets array
    await User.findByIdAndUpdate(req.user.id, {
      $push: { tickets: ticket._id },
      // logger.debug('ticket', `Added ticket ${ticket._id} to creator's user document ${req.user.id}`, user); // Debug level
    });

    res.status(201).json(ticket);
  } catch (error) {
    console.error("Error creating ticket:", error);
    logger.error("ticket", `Failed to create ticket`, error, user, {
      requestBody: req.body,
    });
    res
      .status(500)
      .json({ error: "Failed to create ticket", details: error.message });
  }
};

// Get all tickets for the logged-in user
exports.getUserTickets = async (req, res) => {
  const user = req.user || null;
  try {
    const tickets = await Ticket.find({ createdBy: req.user.id }).sort({
      createdAt: -1,
    });
    res.json(tickets);
  } catch (error) {
    console.error("Error fetching tickets:", error);
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
    console.error("Error fetching ticket:", error);
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
  try {
    const user = req.user || null;
    const ticket = await Ticket.findOneAndUpdate(
      {
        _id: req.params.id,
        createdBy: req.user.id,
      },
      req.body,
      { new: true, runValidators: true }
    );

    if (!ticket) {
      logger.warn(
        "ticket",
        `Ticket not found for update: ${req.params.id}`,
        user,
        { requestBody: req.body }
      );
      return res.status(404).json({ error: "Ticket not found" });
    }

    logger.info("ticket", `Ticket updated successfully`, user, {
      ticketId: ticket._id,
      ticketNumber: ticket.ticketNumber,
    });
    res.json(ticket);
  } catch (error) {
    console.error("Error updating ticket:", error);
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
      return res
        .status(403)
        .json({
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
    const ticketDocumentsPath = path.join('uploads', ticketId); // Adjusted path if uploads are directly in ticketId folder
    if (fs.existsSync(ticketDocumentsPath)) {
      try {
        await fs.remove(ticketDocumentsPath); // fs-extra's remove is like rm -rf
        logger.info('delete', `[DOC_FOLDER_DELETE_SUCCESS] Successfully deleted documents folder: ${ticketDocumentsPath}`, user, logDetails);
      } catch (folderError) {
        logger.error('delete', `[DOC_FOLDER_DELETE_ERROR] Error deleting documents folder ${ticketDocumentsPath}:`, folderError, user, logDetails);
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
    // Just get the counter's current value without incrementing
    const counter = (await Counter.findById("ticketNumber")) || {
      sequence_value: 0,
    };
    const nextNumber = counter.sequence_value + 1; // Calculate next value without saving

    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");

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
    console.error("Error generating ticket number:", error);
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
    console.error("Error checking existing ticket:", error);
    res.status(500).json({ message: "Failed to check existing ticket" });
  }
};
