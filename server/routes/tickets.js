const express = require('express');
const router = express.Router();
const Ticket = require('../models/opentickets');
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const User = require('../models/users'); 
const ticketController = require('../controllers/ticketController');
const authMiddleware = require('../middleware/auth');

// Configure file upload storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}${ext}`);
  }
});

router.get('/next-number', auth, async (req, res) => {
  try {a
    // Get next globally unique sequence number for tickets
    const nextNumber = await getNextSequence('ticketNumber');
    
    // Format with leading zeros (6 digits) and a T prefix
    const nextTicketNumber = `T-${String(nextNumber).padStart(6, '0')}`;
    res.json({ nextTicketNumber });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

const upload = multer({ storage });

// Create new ticket (protected route)
router.post('/', auth, async (req, res) => {
  try {
    const ticketData = req.body;
    ticketData.createdBy = req.user.id;

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
});

// Get all tickets for user (protected route)
router.get('/', auth, async (req, res) => {
  try {
    const tickets = await Ticket.find({ createdBy: req.user.id })
      .sort({ createdAt: -1 });
    res.json(tickets);
  } catch (error) {
    console.error("Error fetching tickets:", error);
    res.status(500).json({ error: "Failed to fetch tickets" });
  }
});

// Get single ticket (protected route)
router.get('/:id', auth, async (req, res) => {
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
});

// Update ticket (protected route)
router.put('/:id', auth, async (req, res) => {
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
    res.status(500).json({ error: "Failed to update ticket", details: error.message });
  }
});

// Delete ticket (protected route)
router.delete('/:id', auth, async (req, res) => {
  try {
    const ticket = await Ticket.findOneAndDelete({
      _id: req.params.id,
      createdBy: req.user.id
    });
    
    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }
    
    // Remove ticket from user's tickets array
    await User.findByIdAndUpdate(req.user.id, {
      $pull: { tickets: ticket._id }
    });
    
    res.json({ message: "Ticket deleted successfully" });
  } catch (error) {
    console.error("Error deleting ticket:", error);
    res.status(500).json({ error: "Failed to delete ticket" });
  }
});

// Upload document (protected route)
router.post('/:id/documents', auth, upload.single('document'), async (req, res) => {
  try {
    const { documentType } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (!['quotation', 'po', 'pi', 'challan', 'packingList', 'feedback'].includes(documentType)) {
      return res.status(400).json({ error: 'Invalid document type' });
    }

    const update = {};
    update[`documents.${documentType}`] = `/uploads/${req.file.filename}`;

    const updatedTicket = await Ticket.findOneAndUpdate(
      {
        _id: req.params.id,
        createdBy: req.user.id
      },
      { $set: update },
      { new: true }
    );

    if (!updatedTicket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    res.json(updatedTicket);
  } catch (error) {
    console.error("Error uploading document:", error);
    res.status(500).json({ error: 'Error uploading document', details: error.message });
  }
});

router.post('/:id/transfer', auth, async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }
    
    const user = await User.findById(req.body.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Update the ticket with the new assigned user
    ticket.assignedTo = req.body.userId;
    
    // Optional: Add a transfer history if you want to track transfers
    if (!ticket.transferHistory) {
      ticket.transferHistory = [];
    }
    
    ticket.transferHistory.push({
      from: ticket.assignedTo || 'unassigned',
      to: req.body.userId,
      transferredBy: req.user.id,
      transferredAt: new Date()
    });
    
    // Update the ticket status and add a note about the transfer
    ticket.transferNotes = ticket.transferNotes || [];
    ticket.transferNotes.push({
      note: `Transferred to ${user.firstname} ${user.lastname}`,
      date: new Date(),
      userId: req.user.id
    });
    
    // Save the updated ticket
    const updatedTicket = await ticket.save();
    
    // Return the updated ticket to the client
    res.status(200).json(updatedTicket);
  } catch (error) {
    console.error('Error transferring ticket:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/next-number', authMiddleware, ticketController.generateTicketNumber);
router.get('/check/:quotationNumber', authMiddleware, ticketController.checkExistingTicket);

module.exports = router;