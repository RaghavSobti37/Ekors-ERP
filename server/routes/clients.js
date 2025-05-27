const express = require('express');
const router = express.Router();
const Client = require('../models/client');
const auth = require('../middleware/auth');

// Search clients
router.get('/search', auth, async (req, res) => {
  try {
    const searchTerm = (req.query.q || '').trim();
    if (!searchTerm || searchTerm.length < 2) { // Require at least 2 chars to search
      return res.json([]);
    }

    const clients = await Client.find({
      user: req.user._id, // Ensure search is scoped to the current user
      $or: [
        { companyName: { $regex: searchTerm, $options: 'i' } },
        { email: { $regex: searchTerm, $options: 'i' } },
        { gstNumber: { $regex: searchTerm, $options: 'i' } }
      ]
    })
    .select('companyName email gstNumber phone _id user') // Select only necessary fields
    .limit(10); // Limit results for performance

    res.json(clients);
  } catch (error) {
    console.error("Error searching clients:", error);
    res.status(500).json({ message: 'Error searching clients', error: error.message || error.toString() });
  }
});

// routes/clientRoutes.js
router.post('/', auth, async (req, res) => {
  try {
    let { companyName, gstNumber, email, phone } = req.body;

    if (!companyName || !gstNumber || !email || !phone) {
      return res.status(400).json({ message: 'Company Name, GST Number, Email, and Phone are required.' });
    }

    // Normalize inputs
    const normalizedEmail = email.toLowerCase();
    const normalizedGstNumber = gstNumber.toUpperCase();

    // Check for existing GST number (case-insensitive)
    const existingGST = await Client.findOne({
      gstNumber: normalizedGstNumber,
      user: req.user._id
    });

    if (existingGST) {
      return res.status(400).json({ 
        message: 'GST Number already exists for this user.',
        field: 'gstNumber' 
      });
    }

    // Check for existing email (case-insensitive)
    const existingEmail = await Client.findOne({
      email: normalizedEmail,
      user: req.user._id
    });

    if (existingEmail) {
      return res.status(400).json({ 
        message: 'Email already exists for this user.',
        field: 'email' 
      });
    }

    // Create new client
    const newClient = new Client({
      companyName,
      gstNumber: normalizedGstNumber,
      email: normalizedEmail,
      phone,
      user: req.user._id
    });

    await newClient.save();
    res.status(201).json(newClient);
    
  } catch (error) {
    if (error.code === 11000) { // MongoDB duplicate key error
      if (error.message.includes('email_1_user_1') || error.message.includes('email')) {
        return res.status(400).json({ message: 'Email already registered for this user (database constraint).', field: 'email' });
      } else if (error.message.includes('gstNumber_1_user_1') || error.message.includes('gstNumber')) {
        return res.status(400).json({ message: 'GST Number already registered for this user (database constraint).', field: 'gstNumber' });
      }
    }
    console.error("Error creating client:", error);
    res.status(500).json({ message: error.message || "Failed to create client" });
  }
});
module.exports = router;
