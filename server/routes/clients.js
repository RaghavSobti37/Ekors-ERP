const express = require('express');
const router = express.Router();
const Client = require('../models/client');
const auth = require('../middleware/auth');

// Search clients
router.get('/search', auth, async (req, res) => {
  try {
    const searchTerm = req.query.q || '';
    if (!searchTerm.trim() || searchTerm.trim().length < 1) { 
      return res.json([]);
    }

    const clients = await Client.find({
      $or: [
        { companyName: { $regex: searchTerm, $options: 'i' } },
        { clientName: { $regex: searchTerm, $options: 'i' } },
        { email: { $regex: searchTerm, $options: 'i' } },
        { gstNumber: { $regex: searchTerm, $options: 'i' } }
      ]
    })
        .select('companyName clientName email gstNumber phone _id')  // Select only necessary fields
    .limit(10); // Limit results for performance

    res.json(clients);
  } catch (error) {
    console.error("Error searching clients:", error);
    res.status(500).json({ message: 'Error searching clients', error: error.message });
  }
});

// Create or find and return client
router.post('/', auth, async (req, res) => {
  try {
    const { email, companyName,clientName, gstNumber, phone } = req.body;
    const userId = req.user._id;

    if (!email || !companyName || !gstNumber || !phone) {
      return res.status(400).json({ message: 'All client fields (Company Name, GST Number, Email, Phone) are required.' });
    }

    const normalizedEmail = email.toLowerCase();
    const normalizedGstNumber = gstNumber.toUpperCase();

    // Check for existing client by email for this user
    let client = await Client.findOne({ email: normalizedEmail, user: userId });
    if (client) {
      // Client with this email already exists. Update if necessary or just return.
      // For now, let's update it with the provided details if they differ,
      // but ensure GST doesn't conflict if it's being changed.
      if (client.gstNumber.toUpperCase() !== normalizedGstNumber) {
        const gstConflict = await Client.findOne({ gstNumber: normalizedGstNumber, user: userId, _id: { $ne: client._id } });
        if (gstConflict) {
          return res.status(400).json({ message: 'GST Number already exists for another client.', field: 'gstNumber' });
        }
      }
      client = await Client.findByIdAndUpdate(client._id, { companyName,clientName, gstNumber: normalizedGstNumber, phone, email: normalizedEmail }, { new: true });
      return res.status(200).json(client);
    }

    // Check for existing client by GST for this user (if email didn't match)
    const gstClient = await Client.findOne({ gstNumber: normalizedGstNumber, user: userId });
    if (gstClient) {
      return res.status(400).json({ message: 'GST Number already exists for another client.', field: 'gstNumber' });
    }
    
    const newClient = new Client({
      email: normalizedEmail,
      companyName,
      clientName,
      gstNumber: normalizedGstNumber,
      phone,
      user: userId
    });

    await newClient.save();
    res.status(201).json(newClient);
  } catch (error) {
    console.error("Error in POST /api/clients:", error);
    // Handle potential duplicate key errors from MongoDB unique indexes if not caught above
    if (error.code === 11000) {
        if (error.message.includes('email_1_user_1')) return res.status(400).json({ message: 'Email already registered to you.', field: 'email' });
        if (error.message.includes('gstNumber_1_user_1')) return res.status(400).json({ message: 'GST Number already registered to you.', field: 'gstNumber' });
    }
    res.status(500).json({ message: 'Error creating or updating client', error: error.message });
  }
});

module.exports = router;