// routes/items.js
const express = require('express');
const router = express.Router();
const Item = require('../models/itemlist');

// Get all items
router.get('/', async (req, res) => {
  try {
    const items = await Item.find().sort({ name: 1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update an item
router.put('/:id', async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Item not found' });

    const updates = req.body;
    const editHistory = [];

    // Track changes
    Object.keys(updates).forEach(key => {
      if (item[key] !== updates[key] && key !== 'editHistory') {
        editHistory.push({
          field: key,
          oldValue: item[key],
          newValue: updates[key],
          changedBy: req.user?.username || 'anonymous'
        });
      }
    });

    // Update item
    Object.assign(item, updates);
    item.updatedAt = new Date();
    item.editHistory = [...item.editHistory, ...editHistory];

    const updatedItem = await item.save();
    res.json(updatedItem);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// itemsRoutes.js
router.post('/initialize', async (req, res) => {
    try {
      await Item.deleteMany({});
      const dummyItems = Array.from({ length: 20 }, (_, i) => ({
        name: `Item ${i + 1}`,
        quantity: Math.floor(Math.random() * 100),
        price: (Math.random() * 1000).toFixed(2),
        gstRate: [5, 12, 18, 28][i % 4],
        hsnCode: `HSN${1000 + i}`
      }));
      await Item.insertMany(dummyItems);
      res.json({ message: 'Database initialized with 20 items' });
    } catch (error) {
      res.status(500).json({ message: 'Initialization failed', error });
    }
  });

  router.post('/', async (req, res) => {
    try {
      const newItem = new Item(req.body);
      await newItem.save();
      res.status(201).json(newItem);
    } catch (err) {
      res.status(500).json({ message: 'Error adding item', error: err });
    }
  });
  

module.exports = router;