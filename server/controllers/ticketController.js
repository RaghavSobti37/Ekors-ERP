const Ticket = require("../models/opentickets");
const TicketBackup = require("../models/ticketBackup"); // Import backup model
const OpenticketModel = require("../models/opentickets.js"); // Used by index.js logic
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
    // TODO: 'counter' is used here but not defined or imported. This will likely cause issues or inconsistent ticket numbers.
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
    logger.error("ticket", `Failed to update ticket ID: ${req.params.id}`, error, user, { requestBody: req.body });
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
    // TODO: The 'Counter' model is referenced here but not imported at the top of the file.
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

    // Note: This generates a timestamp-based ticket number, not using the 'counter.sequence_value'.
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
    logger.info("transfer", `[TRANSFER_INITIATED] Ticket ID: ${ticketId} to User ID: ${newAssigneeId} by User: ${initiator.email}.`, initiator, logContext);

    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      logger.warn("transfer", `[NOT_FOUND] Ticket not found for transfer: ${ticketId}.`, initiator, logContext);
      return res.status(404).json({ message: "Ticket not found" });
    }

    const isSuperAdmin = initiator.role === 'super-admin';
    const isCurrentAssignee = ticket.currentAssignee && ticket.currentAssignee.toString() === initiator.id.toString();

    if (!isSuperAdmin && !isCurrentAssignee) {
      logger.warn("transfer", `[AUTH_FAILURE] Unauthorized transfer attempt for Ticket ID: ${ticketId} by User: ${initiator.email}.`, initiator, { ...logContext, currentAssignee: ticket.currentAssignee?.toString() });
      return res.status(403).json({
        message: "Forbidden: Only the current assignee or a super-admin can transfer this ticket.",
      });
    }
    logger.debug("transfer", `[AUTH_SUCCESS] Authorization successful for Ticket ID: ${ticketId}.`, initiator, logContext);

    const newAssigneeUser = await User.findById(newAssigneeId);
    if (!newAssigneeUser) {
      logger.warn("transfer", `[ASSIGNEE_NOT_FOUND] User to transfer to (ID: ${newAssigneeId}) not found.`, initiator, logContext);
      return res.status(404).json({ message: "User to transfer to not found" });
    }

    const oldAssigneeId = ticket.currentAssignee ? ticket.currentAssignee.toString() : null;

    // Add to transferHistory
    ticket.transferHistory.push({
      from: ticket.currentAssignee, // The one who was assigned before this transfer
      to: newAssigneeId,            // The new assignee
      transferredBy: initiator.id,  // The user initiating the transfer
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
    logger.info("transfer", `[TICKET_UPDATED] Ticket ID: ${ticketId} currentAssignee updated to ${newAssigneeId}.`, initiator, logContext);

    // Update user documents: remove from old assignee's list, add to new assignee's list
    if (oldAssigneeId && oldAssigneeId !== newAssigneeId.toString()) {
      await User.findByIdAndUpdate(oldAssigneeId, { $pull: { tickets: ticket._id } });
      logger.debug("transfer", `[USER_TICKET_REF_REMOVED] Ticket ${ticket._id} pulled from old assignee ${oldAssigneeId}.`, initiator, logContext);
    }
    await User.findByIdAndUpdate(newAssigneeId, { $addToSet: { tickets: ticket._id } });
    logger.debug("transfer", `[USER_TICKET_REF_ADDED] Ticket ${ticket._id} added to new assignee ${newAssigneeId}.`, initiator, logContext);

    const populatedTicket = await Ticket.findById(ticket._id)
      .populate("currentAssignee", "firstname lastname email")
      .populate("transferHistory.from transferHistory.to transferHistory.transferredBy", "firstname lastname email")
      .populate("createdBy", "firstname lastname email"); // Added createdBy for completeness

    logger.info("transfer", `[TRANSFER_SUCCESS] Ticket ID: ${ticketId} successfully transferred to ${newAssigneeUser.email}.`, initiator, logContext);
    res.status(200).json({
      message: "Ticket transferred successfully.",
      ticket: populatedTicket,
    });
  } catch (error) {
    logger.error("transfer", `[TRANSFER_ERROR] Error transferring Ticket ID: ${ticketId}.`, error, initiator, logContext);
    res.status(500).json({ message: "Server error during ticket transfer.", details: error.message });
  }
};

// --- Logic moved from index.js ---

exports.getAllTickets_IndexLogic = async (req, res) => {
  const user = req.user || null;
  try {
    const tickets = await OpenticketModel.find().sort({ createdAt: -1 });
    res.json(tickets);
  } catch (err) {
    logger.error('ticket-controller', 'Error fetching all tickets (index.js logic)', err, user);
    res.status(500).json({ error: 'Error fetching tickets' });
  }
};

exports.createTicket_IndexLogic = async (req, res) => {
  const user = req.user || null; // This route in index.js was not authenticated, so user might be null
  try {
    const { companyName, quotationNumber, billingAddress, shippingAddress, goods } = req.body;

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
      statusHistory: [{
        status: "Quotation Sent",
        changedAt: new Date(),
        // changedBy would ideally be set if user context was available
      }],
      documents: { // Initialize documents
        quotation: "", po: "", pi: "", challan: "", packingList: "", feedback: ""
      },
      // createdBy and currentAssignee would ideally be set if user context was available
      // For now, mirroring index.js which didn't explicitly set them from req.user
    });
    logger.info('ticket-controller', `Ticket created (index.js logic)`, user, { ticketId: newTicket._id, companyName: newTicket.companyName });
    res.status(201).json(newTicket);
  } catch (err) {
    logger.error('ticket-controller', 'Error creating ticket (index.js logic)', err, user, { requestBody: req.body });
    res.status(500).json({ error: 'Error creating ticket', details: err.message });
  }
};

exports.uploadDocument_IndexLogic = async (req, res) => {
  const user = req.user || null; // This route in index.js was not authenticated
  try {
    const { documentType } = req.body;
    if (!req.file) {
      logger.warn('ticket-controller', 'No file uploaded (index.js logic)', user, { ticketId: req.params.id, documentType });
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // req.file.path from multer in routes/tickets.js will be relative to 'uploads/<ticketId>/'
    // The original index.js saved to 'uploads/filename'. We adapt to the new structure.
    const filePath = req.file.filename; // filename is now relative to 'uploads/<ticketId>/'
    
    const update = {};
    update[`documents.${documentType}`] = { // Store as an object consistent with main model
        path: filePath,
        originalName: req.file.originalname,
        // uploadedBy: user ? user.id : null, // If user context was available
        uploadedAt: new Date()
    };

    const updatedTicket = await OpenticketModel.findByIdAndUpdate(req.params.id, { $set: update }, { new: true });

    if (!updatedTicket) {
      logger.warn('ticket-controller', 'Ticket not found for document upload (index.js logic)', user, { ticketId: req.params.id });
      return res.status(404).json({ error: 'Ticket not found' });
    }
    logger.info('ticket-controller', `Document uploaded (index.js logic)`, user, { ticketId: updatedTicket._id, documentType });
    res.json(updatedTicket);
  } catch (err) {
    logger.error('ticket-controller', `Error uploading document for ticket ${req.params.id} (index.js logic)`, err, user, { documentType: req.body.documentType });
    res.status(500).json({ error: 'Error uploading document' });
  }
};

exports.updateTicket_IndexLogic = async (req, res) => {
  const user = req.user || null; // This route in index.js was not authenticated
  try {
    const { _id, __v, createdAt, updatedAt, ...updateData } = req.body;
    const updatedTicket = await OpenticketModel.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true });
    if (!updatedTicket) {
      logger.warn('ticket-controller', 'Ticket not found for update (index.js logic)', user, { ticketId: req.params.id });
      return res.status(404).json({ error: 'Ticket not found' });
    }
    logger.info('ticket-controller', `Ticket updated (index.js logic)`, user, { ticketId: updatedTicket._id });
    res.json(updatedTicket);
  } catch (err) {
    logger.error('ticket-controller', `Error updating ticket ${req.params.id} (index.js logic)`, err, user, { requestBody: req.body });
    res.status(500).json({ error: 'Error updating ticket', message: err.message });
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
  const filePath = path.join(process.cwd(), 'uploads', filename); // More robust path finding
  
  if (!fs.existsSync(filePath)) {
    logger.warn('ticket-controller', 'File not found for serving (index.js logic)', user, { filename });
    return res.status(404).send('File not found');
  }
  
  const ext = path.extname(filename).toLowerCase();
  let contentType = 'application/octet-stream';
  
  if (ext === '.pdf') contentType = 'application/pdf';
  else if (ext === '.doc' || ext === '.docx') contentType = 'application/msword';
  else if (ext === '.xls' || ext === '.xlsx') contentType = 'application/vnd.ms-excel';
  else if (ext === '.png') contentType = 'image/png';
  else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';

  if (contentType === 'application/pdf') {
    res.setHeader('Content-Disposition', `inline; filename="${path.basename(filename)}"`);
  } else {
    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(filename)}"`);
  }
  
  res.setHeader('Content-Type', contentType);
  logger.debug('ticket-controller', `Serving file (index.js logic)`, user, { filename, contentType });
  fs.createReadStream(filePath).pipe(res);
};
