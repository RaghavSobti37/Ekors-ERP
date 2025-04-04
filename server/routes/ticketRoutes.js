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

module.exports = router;