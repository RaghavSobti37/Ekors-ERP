const Ticket = require("../models/opentickets");
const User = require("../models/users");


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