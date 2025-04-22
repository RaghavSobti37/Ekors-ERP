const express = require('express');
const router = express.Router();
const Quotation = require('../models/quotation');
const Client = require('../models/client');
const auth = require('../middleware/auth');

// Create or update quotation
const handleQuotationUpsert = async (req, res) => {
  try {
    const { client, ...quotationData } = req.body;
    const { id } = req.params;

    // Validate required fields
    if (!quotationData.referenceNumber || !client?.email) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Check reference number uniqueness for this user
    const refCheck = await Quotation.findOne({
      user: req.user._id,
      referenceNumber: quotationData.referenceNumber,
      ...(id && { _id: { $ne: id } })
    });

    if (refCheck) {
      return res.status(400).json({ message: 'Reference number already exists' });
    }

    // Upsert client
    const savedClient = await Client.findOneAndUpdate(
      { email: client.email, user: req.user._id },
      { ...client, user: req.user._id },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Prepare quotation data
    const data = {
      ...quotationData,
      user: req.user._id,
      date: new Date(quotationData.date),
      validityDate: new Date(quotationData.validityDate),
      client: savedClient._id
    };

    let quotation;
    if (id) {
      quotation = await Quotation.findOneAndUpdate(
        { _id: id, user: req.user._id },
        data,
        { new: true }
      );
    } else {
      quotation = new Quotation(data);
      await quotation.save();
    }

    const populated = await Quotation.findById(quotation._id)
      .populate('client')
      .populate('user', 'name email');
      
    res.status(id ? 200 : 201).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const { getNextSequence } = require('../utils/counterUtils');

router.get('/next-number', auth, async (req, res) => {
  try {
    // Get next globally unique sequence number
    const nextNumber = await getNextSequence('quotationNumber');
    
    // Format with leading zeros (6 digits)
    const nextQuotationNumber = `Q-${String(nextNumber).padStart(6, '0')}`;
    res.json({ nextQuotationNumber });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all quotations for current user
router.get('/', auth, async (req, res) => {
  try {
    const quotations = await Quotation.find({ user: req.user._id })
      .populate('client')
      .sort({ date: -1 });

    res.json(quotations);
  } catch (error) {
    res.status(500).json({ 
      message: 'Error fetching quotations',
      error: error.message 
    });
  }
});

// Create new quotation
router.post('/', auth, handleQuotationUpsert);

// Update quotation
router.put('/:id', auth, handleQuotationUpsert);

// Check reference number availability
router.get('/check-reference', auth, async (req, res) => {
  try {
    const { referenceNumber, excludeId } = req.query;
    const query = { 
      user: req.user._id,
      referenceNumber 
    };
    
    if (excludeId) {
      query._id = { $ne: excludeId };
    }

    const existing = await Quotation.findOne(query);
    res.json({ exists: !!existing });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get single quotation
router.get('/:id', auth, async (req, res) => {
  try {
    const quotation = await Quotation.findOne({
      _id: req.params.id,
      user: req.user._id
    }).populate('client');

    if (!quotation) {
      return res.status(404).json({ message: 'Quotation not found' });
    }

    res.json(quotation);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete quotation
router.delete('/:id', auth, async (req, res) => {
  try {
    const quotation = await Quotation.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id
    });

    if (!quotation) {
      return res.status(404).json({ message: 'Quotation not found' });
    }

    res.json({ message: 'Quotation deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/next-number', auth, async (req, res) => {
  try {
    // Find the latest quotation across ALL users (globally unique)
    const latestQuotation = await Quotation.findOne({})
      .sort({ referenceNumber: -1 })
      .select('referenceNumber');
    
    let nextNumber = 1;
    
    if (latestQuotation) {
      // Extract number from format like "Q-000001"
      const match = latestQuotation.referenceNumber.match(/Q-(\d+)/);
      if (match && match[1]) {
        nextNumber = parseInt(match[1]) + 1;
      }
    }
    
    const nextQuotationNumber = `Q-${String(nextNumber).padStart(6, '0')}`;
    res.json({ nextQuotationNumber });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;