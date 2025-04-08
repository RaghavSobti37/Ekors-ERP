const express = require('express');
const router = express.Router();
const Purchase = require('../models/purchase');
const Item = require('../models/itemlist');

// Add new purchase and update item quantity
router.post('/add', async (req, res) => {
  try {
    const {
      companyName,
      gstNumber,
      address,
      stateName,
      invoiceNumber,
      invoiceDate,
      itemsPurchased
    } = req.body;

    const savedItems = [];

    for (let i = 0; i < itemsPurchased.length; i++) {
      const purchaseItem = itemsPurchased[i];
      let item = await Item.findOne({ name: purchaseItem.name });

      if (!item) {
        // If item doesn't exist, create it
        item = await Item.create({
          name: purchaseItem.name,
          quantity: purchaseItem.quantity,
          price: purchaseItem.price
        });
      } else {
        // If item exists, update quantity
        item.quantity += Number(purchaseItem.quantity);
        await item.save();
      }

      savedItems.push({
        srNo: i + 1,
        itemId: item._id,
        itemName: item.name,
        description: purchaseItem.description,
        price: purchaseItem.price,
        quantity: purchaseItem.quantity
      });
    }

    const newPurchase = new Purchase({
      companyName,
      gstNumber,
      address,
      stateName,
      invoiceNumber,
      date: invoiceDate,
      items: savedItems
    });

    await newPurchase.save();

    res.status(201).json({ message: 'Purchase recorded successfully', purchase: newPurchase });
  } catch (error) {
    console.error('Error adding purchase:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Get all purchases related to a specific item
router.get('/item/:itemId', async (req, res) => {
  try {
    const purchases = await Purchase.find({ 'items.itemId': req.params.itemId });

    // Flatten relevant info
    const details = purchases.flatMap(purchase => {
      return purchase.items
        .filter(i => i.itemId.toString() === req.params.itemId)
        .map(i => ({
          companyName: purchase.companyName,
          date: purchase.date,
          price: i.price,
          quantity: i.quantity
        }));
    });

    res.status(200).json(details);
  } catch (error) {
    console.error('Error fetching purchase details:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
