const express = require('express');
const router = express.Router();
const Ticket = require('../models/Ticket');

// Get all tickets
router.get('/', async (req, res) => {
  try {
    const tickets = await Ticket.find().sort({ createdAt: -1 });
    res.json(tickets);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching tickets' });
  }
});

// Create new ticket
router.post('/', async (req, res) => {
  try {
    const ticket = new Ticket(req.body);
    await ticket.save();
    res.status(201).json(ticket);
  } catch (err) {
    res.status(500).json({ error: 'Error creating ticket' });
  }
});

// Update ticket
router.put('/:id', async (req, res) => {
  try {
    const ticket = await Ticket.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(ticket);
  } catch (err) {
    res.status(500).json({ error: 'Error updating ticket' });
  }
});

console.log('Sending update:', {
  id: editTicket._id,
  data: ticketData
});

// In your backend (index.js or ticket routes)
router.put('/tickets/:id', async (req, res) => {
  try {
    const { _id, __v, createdAt, updatedAt, ...updateData } = req.body;
    
    const updatedTicket = await OpenticketModel.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true } // Return updated doc and run validators
    );

    if (!updatedTicket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    res.json(updatedTicket);
  } catch (err) {
    console.error(err);
    res.status(500).json({ 
      error: 'Error updating ticket',
      message: err.message 
    });
  }
});

module.exports = router;