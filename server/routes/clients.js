const express = require('express');
const router = express.Router();
const Client = require('../models/client');
const auth = require('../middleware/auth');

// Search clients
router.get('/search', auth, async (req, res) => {
  try {
    const searchTerm = req.query.q || '';
    if (!searchTerm.trim() || searchTerm.trim().length < 2) { // Require at least 2 chars to search
      return res.json([]);
    }

    const clients = await Client.find({
      user: req.user._id, // Ensure clients are scoped to the logged-in user
      $or: [
        { companyName: { $regex: searchTerm, $options: 'i' } },
        { email: { $regex: searchTerm, $options: 'i' } },
        { gstNumber: { $regex: searchTerm, $options: 'i' } }
      ]
    })
    .select('companyName email gstNumber phone _id') // Select only necessary fields
    .limit(10); // Limit results for performance

    res.json(clients);
  } catch (error) {
    console.error("Error searching clients:", error);
    res.status(500).json({ message: 'Error searching clients', error: error.message });
  }
});

module.exports = router;