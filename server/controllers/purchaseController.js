const { Item, Purchase } = require('../models/itemlist');
const mongoose = require('mongoose');

const debug = (message, data = null) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEBUG] ${message}`, data);
  }
};

// Add purchase to specific item
exports.addSinglePurchase = async (req, res) => {
  try {
    const itemId = req.params.id;
    const { companyName, gstNumber, address, stateName, invoiceNumber, date, quantity, price, gstRate } = req.body;
    
    // Find the item
    const item = await Item.findById(itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }
    
    // Create purchase entry for the item
    const purchaseEntry = {
      date: new Date(date),
      companyName,
      gstNumber,
      address,
      stateName,
      invoiceNumber,
      quantity,
      price,
      gstRate: gstRate || 0
    };
    
    // Add to item's purchase history
    item.purchaseHistory.push(purchaseEntry);
    
    // Increase item quantity
    item.quantity += quantity;
    
    // Save the item
    await item.save();
    
    // Also create a purchase document with this item
    const purchase = new Purchase({
      companyName,
      gstNumber,
      address,
      stateName,
      invoiceNumber,
      date: new Date(date),
      items: [{
        itemId: itemId,
        description: item.name,
        quantity,
        price,
        gstRate: gstRate || 0
      }]
    });
    
    // Save the purchase
    const savedPurchase = await purchase.save();
    
    res.status(201).json({ success: true, data: { itemUpdated: item, purchase: savedPurchase } });
  } catch (error) {
    console.error('Error adding purchase to item:', error);
    res.status(500).json({ success: false, message: 'Failed to add purchase', error: error.message });
  }
};

// Add bulk purchase
exports.addBulkPurchase = async (req, res) => {
  try {
    const { companyName, gstNumber, address, stateName, invoiceNumber, date, items } = req.body;
    
    // Validate items array exists and has content
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Items array is required and must not be empty' });
    }
    
    // Create the purchase document
    const purchase = new Purchase({
      companyName,
      gstNumber,
      address,
      stateName,
      invoiceNumber,
      date: new Date(date),
      items: items.map(item => ({
        itemId: item.itemId,
        description: item.description,
        quantity: item.quantity,
        price: item.price,
        gstRate: item.gstRate || 0
      }))
    });
    
    // Save the purchase
    const savedPurchase = await purchase.save();
    
    // Update each item's purchase history and quantity
    for (const item of items) {
      if (item.itemId) {
        // Add to purchase history of the item
        await Item.findByIdAndUpdate(
          item.itemId,
          {
            $push: {
              purchaseHistory: {
                date: new Date(date),
                companyName,
                gstNumber,
                address,
                stateName, 
                invoiceNumber,
                quantity: item.quantity,
                price: item.price,
                gstRate: item.gstRate || 0
              }
            },
            // Increase item quantity
            $inc: { quantity: item.quantity }
          }
        );
      }
    }
    
    res.status(201).json({ success: true, data: savedPurchase });
  } catch (error) {
    console.error('Error adding bulk purchase:', error);
    res.status(500).json({ success: false, message: 'Failed to add purchase', error: error.message });
  }
};

// Get purchase history for an item
exports.getPurchaseHistoryForItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    
    // Check if id is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      return res.status(400).json({ message: 'Invalid item ID format' });
    }
    
    const item = await Item.findById(itemId);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }
    
    // Get purchases where this item is referenced
    const purchases = await Purchase.find({
      'items.itemId': itemId
    }).sort({ date: -1 });

    // Format the purchases for the frontend
    const formattedPurchases = purchases.map(purchase => {
      const itemInfo = purchase.items.find(item => 
        item.itemId && item.itemId.toString() === itemId
      );
      
      return {
        purchaseId: purchase._id,
        date: purchase.date,
        companyName: purchase.companyName,
        gstNumber: purchase.gstNumber,
        invoiceNumber: purchase.invoiceNumber,
        quantity: itemInfo ? itemInfo.quantity : 0,
        price: itemInfo ? itemInfo.price : 0,
        gstRate: itemInfo ? itemInfo.gstRate : 0,
        total: itemInfo ? (itemInfo.price * itemInfo.quantity * (1 + itemInfo.gstRate / 100)) : 0
      };
    });

    res.json(formattedPurchases);
  } catch (error) {
    console.error('Error fetching purchase history:', error);
    res.status(500).json({ message: 'Server error while fetching purchase history' });
  }
};

// Get all purchases
exports.getAllPurchases = async (req, res) => {
  try {
    // Fetch all purchases and sort by date descending (newest first)
    const purchases = await Purchase.find().sort({ date: -1 });
    res.status(200).json(purchases);
  } catch (error) {
    console.error('Error fetching purchases:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch purchases', error: error.message });
  }
};

// Get purchase by ID
exports.getPurchaseById = async (req, res) => {
  try {
    const purchase = await Purchase.findById(req.params.id).populate('items.itemId');
    if (!purchase) {
      return res.status(404).json({ message: 'Purchase not found' });
    }
    res.json(purchase);
  } catch (error) {
    console.error('Error fetching purchase:', error);
    res.status(500).json({ message: 'Server error while fetching purchase' });
  }
};