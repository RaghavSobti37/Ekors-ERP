const Ticket = require("../models/opentickets");
const TicketBackup = require("../models/ticketBackup"); // Import backup model
const User = require("../models/users");
const logger = require("../utils/logger"); // Import logger

// Then modify the ticket creation endpoint to use the actual counter
exports.createTicket = async (req, res) => {
  try {
    const ticketData = req.body;
    ticketData.createdBy = req.user.id;
    
    // Only increment the counter when actually creating the ticket
    const counter = await getNextSequence('ticketNumber');
    
    // Format with proper pattern to ensure consistency
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = String(now.getMonth() + 1).padStart(2, '0');
    ticketData.ticketNumber = `T-${year}${month}-${String(counter).padStart(4, '0')}`;
    
    const ticket = new Ticket(ticketData);
    await ticket.save();
    
    // Add ticket to user's tickets array
    await User.findByIdAndUpdate(req.user.id, {
      $push: { tickets: ticket._id }
    });

    res.status(201).json(ticket);
  } catch (error) {
    console.error("Error creating ticket:", error);
    res.status(500).json({ error: "Failed to create ticket", details: error.message });
  }
};

// Get all tickets for the logged-in user
exports.getUserTickets = async (req, res) => {
  try {
    const tickets = await Ticket.find({ createdBy: req.user.id })
      .sort({ createdAt: -1 });
    res.json(tickets);
  } catch (error) {
    console.error("Error fetching tickets:", error);
    res.status(500).json({ error: "Failed to fetch tickets" });
  }
};

// Get single ticket (only if created by the user)
exports.getTicket = async (req, res) => {
  try {
    const ticket = await Ticket.findOne({
      _id: req.params.id,
      createdBy: req.user.id
    });
    
    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }
    
    res.json(ticket);
  } catch (error) {
    console.error("Error fetching ticket:", error);
    res.status(500).json({ error: "Failed to fetch ticket" });
  }
};

// Update ticket
exports.updateTicket = async (req, res) => {
  try {
    const ticket = await Ticket.findOneAndUpdate(
      {
        _id: req.params.id,
        createdBy: req.user.id
      },
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }
    
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
  const userEmail = req.user ? req.user.email : 'N/A';
  const logDetails = { userId, ticketId, model: 'Ticket', operation: 'delete', userEmail };

  logger.info(`[DELETE_INITIATED] Ticket ID: ${ticketId} by User: ${userEmail}.`, logDetails);

  try {
    logger.debug(`[FETCH_ATTEMPT] Finding Ticket ID: ${ticketId} for backup and deletion.`, logDetails);
    const ticketToBackup = await Ticket.findOne({ _id: ticketId });

    if (!ticketToBackup) {
      logger.warn(`[NOT_FOUND] Ticket not found for deletion: ${ticketId}.`, logDetails);
      return res.status(404).json({ error: "Ticket not found" });
    }
    logger.debug(`[FETCH_SUCCESS] Found Ticket ID: ${ticketId} (Number: ${ticketToBackup.ticketNumber}). Performing authorization checks.`, { ...logDetails, ticketNumber: ticketToBackup.ticketNumber });

    // Authorization: User can delete if they created it OR if they are a super-admin (for admin delete route)
    const isCreator = ticketToBackup.createdBy.toString() === userId;
    const isSuperAdmin = req.user.role === 'super-admin';

    if (!isCreator && !isSuperAdmin) {
      logger.warn(`[AUTH_FAILURE] Unauthorized delete attempt for Ticket ID: ${ticketId} by User: ${userEmail}.`, { ...logDetails, createdBy: ticketToBackup.createdBy.toString() });
      return res.status(403).json({ error: "Forbidden: You do not have permission to delete this ticket." });
    }
    logger.debug(`[AUTH_SUCCESS] Authorization successful for Ticket ID: ${ticketId}. Preparing for backup.`, logDetails);

    const backupData = ticketToBackup.toObject();
    const newBackupEntry = new TicketBackup({
      ...backupData,
      originalId: ticketToBackup._id,
      deletedBy: userId, // User performing the delete
      deletedAt: new Date(),
      originalCreatedAt: ticketToBackup.createdAt,
      originalUpdatedAt: ticketToBackup.updatedAt,
      backupReason: `${isSuperAdmin ? 'Admin' : 'User'}-initiated deletion via API`
    });

    logger.debug(`[PRE_BACKUP_SAVE] Attempting to save backup for Ticket ID: ${ticketToBackup._id}.`, { ...logDetails, originalId: ticketToBackup._id });
    await newBackupEntry.save();
    logger.info(`[BACKUP_SUCCESS] Ticket successfully backed up. Backup ID: ${newBackupEntry._id}.`, { ...logDetails, originalId: ticketToBackup._id, backupId: newBackupEntry._id, backupModel: 'TicketBackup' });

    logger.debug(`[PRE_ORIGINAL_DELETE] Attempting to delete original Ticket ID: ${ticketToBackup._id}.`, { ...logDetails, originalId: ticketToBackup._id });
    await Ticket.findByIdAndDelete(ticketId);
    logger.info(`[ORIGINAL_DELETE_SUCCESS] Original Ticket successfully deleted.`, { ...logDetails, originalId: ticketToBackup._id });

    // Remove ticket from user's (creator and current assignee) tickets array
    const usersToUpdate = new Set();
    if (ticketToBackup.createdBy) usersToUpdate.add(ticketToBackup.createdBy.toString());
    if (ticketToBackup.currentAssignee) usersToUpdate.add(ticketToBackup.currentAssignee.toString());

    for (const uid of usersToUpdate) {
      try {
        logger.debug(`[USER_TICKET_REF_REMOVE_ATTEMPT] Removing ticket reference ${ticketToBackup._id} from User ID: ${uid}.`, { ...logDetails, targetUserId: uid });
        await User.findByIdAndUpdate(uid, { $pull: { tickets: ticketToBackup._id } });
        logger.info(`[USER_TICKET_REF_REMOVE_SUCCESS] Removed ticket reference ${ticketToBackup._id} from User ID: ${uid}.`, { ...logDetails, targetUserId: uid });
      } catch (userUpdateError) {
        logger.error(`[USER_TICKET_REF_REMOVE_ERROR] Failed to remove ticket reference ${ticketToBackup._id} from User ID: ${uid}.`, userUpdateError, { ...logDetails, targetUserId: uid });
      }
    }

    res.status(200).json({
      message: "Ticket deleted and backed up successfully.",
      originalId: ticketToBackup._id,
      backupId: newBackupEntry._id
    });

  } catch (error) {
    logger.error(`[DELETE_ERROR] Error during Ticket deletion process for ID: ${ticketId} by ${userEmail}.`, error, logDetails);
    if (error.name === 'ValidationError' || (typeof ticketToBackup === 'undefined' || (ticketToBackup && (!newBackupEntry || newBackupEntry.isNew)))) {
        logger.warn(`[ROLLBACK_DELETE] Backup failed or error before backup for Ticket ID: ${ticketId}. Original document will not be deleted.`, logDetails);
    }
    res.status(500).json({ error: "Failed to delete ticket. Check server logs." });
  }
};

// Admin delete ticket - specific for super-admin role, uses the same core logic as deleteTicket
exports.adminDeleteTicket = async (req, res) => {
  logger.debug(`[ADMIN_DELETE_TICKET_INVOKED] Admin delete initiated for Ticket ID: ${req.params.id} by User: ${req.user.email}.`, { userId: req.user.id, ticketId: req.params.id, model: 'Ticket', operation: 'adminDelete' });
  if (req.user.role !== 'super-admin') {
    logger.warn(`Non-admin attempt to use adminDeleteTicket for Ticket ID: ${req.params.id} by User: ${req.user.email}`, { userId: req.user.id, ticketId: req.params.id });
    return res.status(403).json({ error: "Forbidden" });
  }
  // Call the generic deleteTicket function which now handles permissions correctly
  // The deleteTicket function will use req.user.role to determine if it's an admin deletion for logging/backupReason
  return exports.deleteTicket(req, res);
};


exports.generateTicketNumber = async (req, res) => {
  try {
    // Just get the counter's current value without incrementing
    const counter = await Counter.findById('ticketNumber') || { sequence_value: 0 };
    const nextNumber = counter.sequence_value + 1; // Calculate next value without saving
    
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const ticketNumber = `T-${year}${month}-${String(nextNumber).padStart(4, '0')}`;
    
    res.status(200).json({ 
      nextTicketNumber: ticketNumber,
      tempCounter: nextNumber // Store this temporarily
    });
  } catch (error) {
    console.error('Error generating ticket number:', error);
    res.status(500).json({ message: 'Failed to generate ticket number' });
  }
};

exports.checkExistingTicket = async (req, res) => {
  try {
    const { quotationNumber } = req.params;
    const ticket = await Ticket.findOne({ quotationNumber });
    
    res.status(200).json({ exists: !!ticket });
  } catch (error) {
    console.error('Error checking existing ticket:', error);
    res.status(500).json({ message: 'Failed to check existing ticket' });
  }
};