const express = require('express');
const router = express.Router();
const Item = require('../models/itemlist');
const { body, validationResult } = require('express-validator');

// Get all items
router.get('/', async (req, res) => {
  try {
    const items = await Item.find().sort({ name: 1 });
    res.json(items);
  } catch (err) {
    console.error('Error fetching items:', err);
    res.status(500).json({ message: 'Server error while fetching items' });
  }
});

// Get a specific item by ID
router.get('/:id', async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }
    res.json(item);
  } catch (err) {
    console.error('Error fetching item:', err);
    res.status(500).json({ message: 'Server error while fetching item' });
  }
});

// Update an item
router.put('/:id', [
  body('name').optional().trim().escape(),
  body('quantity').optional().isInt({ min: 0 }).toInt(),
  body('price').optional().isFloat({ min: 0 }).toFloat(),
  body('gstRate').optional().isFloat({ min: 0, max: 100 }).toFloat(),
  body('hsnCode').optional().trim().escape(),
  body('description').optional().trim().escape()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    const updates = req.body;
    const editHistory = [];

    // Track changes
    Object.keys(updates).forEach(key => {
      if (item[key] !== updates[key] && 
          key !== 'editHistory' && 
          key !== 'purchaseHistory' && 
          key !== '_id' && 
          key !== '__v') {
        editHistory.push({
          field: key,
          oldValue: item[key],
          newValue: updates[key],
          changedBy: req.user?.username || 'system'
        });
      }
    });

    // Update item
    Object.assign(item, updates);
    item.updatedAt = new Date();
    
    // Add to edit history if there are changes
    if (editHistory.length > 0) {
      item.editHistory = [...(item.editHistory || []), ...editHistory];
    }

    const updatedItem = await item.save();
    res.json(updatedItem);
  } catch (err) {
    console.error("Error updating item:", err);
    res.status(400).json({ message: 'Error updating item', error: err.message });
  }
});

// Add new item
router.post('/', [
  body('name').trim().escape().notEmpty(),
  body('quantity').optional().isInt({ min: 0 }).toInt(),
  body('price').isFloat({ min: 0 }).toFloat(),
  body('gstRate').optional().isFloat({ min: 0, max: 100 }).toFloat(),
  body('hsnCode').optional().trim().escape(),
  body('description').optional().trim().escape()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const itemData = {
      name: req.body.name,
      quantity: req.body.quantity || 0,
      price: req.body.price,
      gstRate: req.body.gstRate || 0,
      hsnCode: req.body.hsnCode || '',
      description: req.body.description || '',
    };
    
    // Add purchase history if provided
    if (req.body.purchaseHistory && Array.isArray(req.body.purchaseHistory)) {
      itemData.purchaseHistory = req.body.purchaseHistory.map(purchase => ({
        date: purchase.date || new Date(),
        supplier: purchase.supplier || '',
        companyName: purchase.companyName || purchase.supplier || '',
        gstNumber: purchase.gstNumber || '',
        address: purchase.address || '',
        stateName: purchase.stateName || '',
        stateCode: purchase.stateCode || '',
        invoiceNumber: purchase.invoiceNumber || '',
        quantity: parseInt(purchase.quantity) || 0,
        price: parseFloat(purchase.price) || 0,
        description: purchase.description || ''
      }));
    }
    
    const newItem = new Item(itemData);
    const savedItem = await newItem.save();
    res.status(201).json(savedItem);
  } catch (err) {
    console.error('Error adding item:', err);
    res.status(500).json({ message: 'Error adding item', error: err.message });
  }
});

// Get purchase history for an item
router.get('/:id/purchases', async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }
    
    res.json(item.purchaseHistory || []);
  } catch (err) {
    console.error('Error getting purchase history:', err);
    res.status(500).json({ message: 'Error getting purchase history', error: err.message });
  }
});

// Add purchase history to an item
router.post('/:id/purchases', [
  body('date').optional().isISO8601().toDate(),
  body('supplier').trim().escape(),
  body('companyName').trim().escape(),
  body('gstNumber').optional().trim().escape(),
  body('address').optional().trim().escape(),
  body('stateName').optional().trim().escape(),
  body('stateCode').optional().trim().escape(),
  body('invoiceNumber').trim().escape(),
  body('quantity').isInt({ min: 1 }).toInt(),
  body('price').isFloat({ min: 0 }).toFloat(),
  body('description').optional().trim().escape()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }
    
    const newPurchase = {
      date: req.body.date || new Date(),
      supplier: req.body.supplier,
      companyName: req.body.companyName || req.body.supplier,
      gstNumber: req.body.gstNumber || '',
      address: req.body.address || '',
      stateName: req.body.stateName || '',
      stateCode: req.body.stateCode || '',
      invoiceNumber: req.body.invoiceNumber,
      quantity: req.body.quantity,
      price: req.body.price,
      description: req.body.description || ''
    };
    
    // Add to purchase history
    item.purchaseHistory = [...(item.purchaseHistory || []), newPurchase];
    
    // Update item quantity
    item.quantity = (parseInt(item.quantity) || 0) + parseInt(req.body.quantity);
    
    await item.save();
    res.status(201).json(item.purchaseHistory);
  } catch (err) {
    console.error('Error adding purchase history:', err);
    res.status(500).json({ message: 'Error adding purchase history', error: err.message });
  }
});

// Initialize items database with dummy data
router.post('/initialize', async (req, res) => {
  try {
    await Item.deleteMany({});
    const dummyItems = Array.from({ length: 20 }, (_, i) => ({
      name: `Item ${i + 1}`,
      quantity: Math.floor(Math.random() * 100),
      price: parseFloat((Math.random() * 1000).toFixed(2)),
      gstRate: [5, 12, 18, 28][i % 4],
      hsnCode: `HSN${1000 + i}`,
      purchaseHistory: [
        {
          date: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000),
          supplier: `Supplier ${Math.floor(Math.random() * 5) + 1}`,
          companyName: `Company ${Math.floor(Math.random() * 5) + 1}`,
          invoiceNumber: `INV-${1000 + i}-1`,
          quantity: Math.floor(Math.random() * 50) + 10,
          price: parseFloat((Math.random() * 500).toFixed(2))
        }
      ]
    }));
    await Item.insertMany(dummyItems);
    res.json({ message: 'Database initialized with 20 items' });
  } catch (error) {
    console.error('Initialization failed:', error);
    res.status(500).json({ message: 'Initialization failed', error });
  }
});

module.exports = router;