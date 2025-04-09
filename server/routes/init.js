const express = require('express');
const router = express.Router();
const Item = require('../models/itemlist');

// Initialize items database with dummy data and proper schema
router.post('/initialize', async (req, res) => {
  try {
    // Clear existing items
    await Item.deleteMany({});
    
    // Create dummy items with purchase history
    const dummyItems = [];
    
    for (let i = 0; i < 20; i++) {
      // Random GST rate
      const gstRateOptions = [5, 12, 18, 28];
      const gstRate = gstRateOptions[i % 4];
      
      // Random price
      const price = parseFloat((Math.random() * 1000 + 100).toFixed(2));
      
      // Create purchase history entries
      const purchaseHistory = [];
      const purchaseCount = Math.floor(Math.random() * 3) + 1; // 1-3 purchases
      
      for (let j = 0; j < purchaseCount; j++) {
        const purchaseDate = new Date();
        purchaseDate.setDate(purchaseDate.getDate() - Math.floor(Math.random() * 30)); // Random date in last 30 days
        
        purchaseHistory.push({
          date: purchaseDate,
          companyName: `Supplier ${(j % 5) + 1}`,
          gstNumber: `GST12345${i}${j}ABCDE`,
          address: `123 Business Park, Area ${j+1}`,
          stateName: ['Delhi', 'Maharashtra', 'Karnataka', 'Tamil Nadu', 'Gujarat'][j % 5],
          invoiceNumber: `INV-${2023 + j}-${1000 + i * 10 + j}`,
          quantity: Math.floor(Math.random() * 10) + 5, // 5-15 quantity
          price: price * (0.9 + (j * 0.05)), // Slightly different prices for history
          gstRate: gstRate,
          description: `Standard quality ${i % 2 === 0 ? 'premium' : 'regular'} item`
        });
      }
      
      dummyItems.push({
        name: `Item ${i + 1}`,
        price: price,
        gstRate: gstRate,
        hsnCode: `HSN${1000 + i}`,
        description: `Description for Item ${i + 1}`,
        purchaseHistory: purchaseHistory
      });
    }
    
    // Insert the items with purchase history
    await Item.insertMany(dummyItems);
    
    res.json({ 
      message: 'Database initialized with 20 items and purchase history',
      count: dummyItems.length
    });
  } catch (error) {
    console.error('Initialization failed:', error);
    res.status(500).json({ message: 'Initialization failed', error: error.message });
  }
});

module.exports = router;