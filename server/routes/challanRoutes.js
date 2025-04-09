// routes/challanRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Challan = require('../models/challan');

// Setup multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/challans';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `challan-${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and PDF are allowed.'));
    }
  }
});

// Get all challans
router.get('/', async (req, res) => {
  try {
    const challans = await Challan.find().sort({ createdAt: -1 });
    res.json(challans);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching challans', message: err.message });
  }
});

// Create a new challan
router.post('/', upload.single('media'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Document file is required' });
    }

    const { companyName, phone, email, totalBilling, billNumber } = req.body;

    const newChallan = await Challan.create({
      companyName,
      phone,
      email,
      totalBilling,
      billNumber,
      documentPath: req.file.path.replace(/\\/g, '/'),
    });

    res.status(201).json(newChallan);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error creating challan', message: err.message });
  }
});

// Get a single challan by ID
router.get('/:id', async (req, res) => {
  try {
    const challan = await Challan.findById(req.params.id);
    if (!challan) {
      return res.status(404).json({ error: 'Challan not found' });
    }
    res.json(challan);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching challan', message: err.message });
  }
});

// Update a challan
router.put('/:id', upload.single('media'), async (req, res) => {
  try {
    const { companyName, phone, email, totalBilling, billNumber } = req.body;
    
    const updateData = {
      companyName,
      phone,
      email,
      totalBilling,
      billNumber,
      updatedAt: new Date()
    };

    // If a new file is uploaded, update the document path
    if (req.file) {
      updateData.documentPath = req.file.path.replace(/\\/g, '/');
      
      // Get the old document path to delete it later
      const oldChallan = await Challan.findById(req.params.id);
      if (oldChallan && oldChallan.documentPath) {
        try {
          fs.unlinkSync(oldChallan.documentPath);
        } catch (unlinkErr) {
          console.error('Could not delete old file:', unlinkErr);
        }
      }
    }

    const updatedChallan = await Challan.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedChallan) {
      return res.status(404).json({ error: 'Challan not found' });
    }

    res.json(updatedChallan);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error updating challan', message: err.message });
  }
});

// Delete a challan
router.delete('/:id', async (req, res) => {
  try {
    const challan = await Challan.findById(req.params.id);
    
    if (!challan) {
      return res.status(404).json({ error: 'Challan not found' });
    }
    
    // Delete the associated file if it exists
    if (challan.documentPath) {
      try {
        fs.unlinkSync(challan.documentPath);
      } catch (unlinkErr) {
        console.error('Could not delete file:', unlinkErr);
      }
    }
    
    await Challan.findByIdAndDelete(req.params.id);
    res.json({ message: 'Challan deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error deleting challan', message: err.message });
  }
});

// Get document by challan ID
router.get('/:id/document', async (req, res) => {
  try {
    const challan = await Challan.findById(req.params.id);
    if (!challan || !challan.documentPath) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    res.sendFile(path.resolve(challan.documentPath));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching document', message: err.message });
  }
});

module.exports = router;