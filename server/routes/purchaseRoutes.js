const express = require('express');
const router = express.Router();
const Purchase = require('../models/purchase');
const Item = require('../models/itemlist');

// Create a new purchase
router.post('/', async (req, res) => {
  try {
    const { companyName, gstNumber, address, stateName, invoiceNumber, date, items } = req.body;

    const purchase = new Purchase({ companyName, gstNumber, address, stateName, invoiceNumber, date, items });
    await purchase.save();

    // Update item list quantities
    for (const item of items) {
      await Item.findByIdAndUpdate(item.itemId, {
        $inc: { quantity: item.quantity }
      });
    }

    res.status(201).json(purchase);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get purchases for an item
router.get('/item/:itemId', async (req, res) => {
  try {
    const purchases = await Purchase.find({ 'items.itemId': req.params.itemId });
    res.json(purchases);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
