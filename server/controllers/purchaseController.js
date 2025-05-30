const { Item, Purchase } = require('../models/itemlist');
const mongoose = require('mongoose');
const logger = require('../utils/logger'); // Import logger

// Add purchase to specific item
exports.addSinglePurchase = async (req, res) => {
  const itemId = req.params.id;
  const user = req.user; // Assuming auth middleware populates req.user
  try {
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
    // TODO: Review this. The Item model (models/itemlist.js) does not seem to have 'purchaseHistory' array anymore.
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
    
    logger.info('purchase', `Single purchase added successfully for item ID: ${itemId}`, user, { purchaseId: savedPurchase._id, itemId });
    res.status(201).json({ success: true, data: { itemUpdated: item, purchase: savedPurchase } });
  } catch (error) {
    logger.error('purchase', `Error adding single purchase for item ID: ${itemId}`, error, user, { requestBody: req.body });
    res.status(500).json({ success: false, message: 'Failed to add purchase', error: error.message });
  }
};

// Add bulk purchase
exports.addBulkPurchase = async (req, res) => {
  const user = req.user; // Assuming auth middleware populates req.user
  try {
    const { companyName, gstNumber, address, stateName, invoiceNumber, date, items } = req.body;
    
    // Validate items array exists and has content
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Items array is required and must not be empty' });
    }

     // Basic validation for required fields for the purchase itself
    if (!companyName || !invoiceNumber || !date) {
        return res.status(400).json({ success: false, message: 'Company name, invoice number, and date are required for the purchase.' });
    }
    
    // Validate each item in the items array
    for (const item of items) { // items from req.body
        if (!item.description || typeof item.quantity !== 'number' || item.quantity <= 0 || typeof item.price !== 'number' || item.price < 0) {
            return res.status(400).json({ 
                success: false, 
                message: `Invalid item data: Each item must have a description, a positive quantity, and a non-negative price. Problem with item: ${item.description || 'N/A'}` 
            });
        }
        // Ensure itemId is a valid ObjectId if provided, or null
        if (item.itemId && !mongoose.Types.ObjectId.isValid(item.itemId)) {
            return res.status(400).json({ success: false, message: `Invalid itemId format for item: ${item.description}` });
        }
    }

    
    // Create the purchase document
    const purchase = new Purchase({
      companyName,
      gstNumber,
      address,
      stateName,
      invoiceNumber,
      date: new Date(date),
      items: items.map(pItem => {
        // Ensure gstRate is a valid number, defaulting to 0 if not.
        // Client sends parsed floats, so item.gstRate could be a number or NaN.
        // JSON.stringify converts NaN to null. So pItem.gstRate could be number or null.
        let finalGstRate = parseFloat(pItem.gstRate); // Attempt to parse again, just in case
        if (isNaN(finalGstRate) || finalGstRate < 0) {
          finalGstRate = 0;
        }
        return {
          itemId: pItem.itemId || null,
          description: pItem.description,
          quantity: pItem.quantity, // Assumed to be valid number due to prior validation loop
          price: pItem.price,       // Assumed to be valid number due to prior validation loop
          gstRate: finalGstRate
        };
      })
    });
    
    // Save the purchase
    const savedPurchase = await purchase.save();
    
    // Update each item's purchase history and quantity
    for (const purchasedItem of items) { // Renamed to avoid conflict
      if (purchasedItem.itemId) { // Only if it's an existing item with a valid ID
        const itemToUpdate = await Item.findById(purchasedItem.itemId);
        if (itemToUpdate) {
            itemToUpdate.quantity += purchasedItem.quantity;
            // TODO: Review this. The Item model (models/itemlist.js) does not seem to have 'purchaseHistory' array anymore.
            // Add to item's specific purchase history
            itemToUpdate.purchaseHistory.push({
                purchaseId: savedPurchase._id,
                date: new Date(date),
                companyName,
                gstNumber,
                address,
                stateName, 
                invoiceNumber,
               quantity: purchasedItem.quantity,
                price: purchasedItem.price,
                gstRate: (() => { // IIFE to ensure gstRate is valid number
                    let finalGstRate = parseFloat(purchasedItem.gstRate);
                    if (isNaN(finalGstRate) || finalGstRate < 0) return 0;
                    return finalGstRate;
                })()
            });
            await itemToUpdate.save(); // Save the updated item
        } else {
            // Optionally, handle cases where an itemId is provided but the item doesn't exist
            // For now, we'll log a warning. Depending on requirements, this could be an error.
            logger.warn('purchase', `Item with ID ${purchasedItem.itemId} not found during bulk purchase stock update. Purchase record ${savedPurchase._id} created, but this item stock not updated.`, user, { purchasedItemId: purchasedItem.itemId });
        }
      }
    }
    
    logger.info('purchase', `Bulk purchase added successfully. Invoice: ${invoiceNumber}`, user, { purchaseId: savedPurchase._id, itemCount: items.length });
    res.status(201).json({ success: true, data: savedPurchase });
  } catch (error) {
    logger.error('purchase', `Error adding bulk purchase. Invoice: ${req.body.invoiceNumber}`, error, user, { requestBody: req.body });
    // Check for Mongoose validation error
    if (error.name === 'ValidationError') {
        // Send back specific validation errors
        return res.status(400).json({ success: false, message: 'Validation failed creating purchase', errors: error.errors });
    }
    res.status(500).json({ success: false, message: 'Failed to add bulk purchase', error: error.message });
  }
};

exports.getItemPurchaseHistory = async (req, res) => {
  const user = req.user;
  try {
    // Validate item ID
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid item ID' });
    }

    const purchases = await Purchase.find({ 'items.itemId': req.params.id })
      .sort({ date: -1 })
      .select('companyName gstNumber invoiceNumber date items')
      .lean();

    // Transform the data to match frontend expectations
    const transformed = purchases.map(purchase => {
      const item = purchase.items.find(i => 
        i.itemId && i.itemId.toString() === req.params.id
      );
      
      if (!item) return null;
      
      return {
        _id: purchase._id,
        companyName: purchase.companyName,
        gstNumber: purchase.gstNumber,
        invoiceNumber: purchase.invoiceNumber,
        date: purchase.date,
        ...item
      };
    }).filter(Boolean); // Remove any null entries

    res.json(transformed);
    logger.debug('purchase', `Fetched item purchase history for item ID: ${req.params.id}`, user, { count: transformed.length });
  } catch (err) {
    logger.error('purchase', `Error fetching item purchase history for item ID: ${req.params.id}`, err, user);
    res.status(500).json({ message: 'Server error fetching purchase history' });
  }
};

// Get all purchases
exports.getAllPurchases = async (req, res) => {
  const user = req.user;
  try {
    // Fetch all purchases and sort by date descending (newest first)
    const purchases = await Purchase.find().sort({ date: -1 }).lean();;
    res.status(200).json(purchases);
    logger.debug('purchase', `Fetched all purchases`, user, { count: purchases.length });
  } catch (error) {
    logger.error('purchase', `Error fetching all purchases`, error, user);
    res.status(500).json({ success: false, message: 'Failed to fetch purchases', error: error.message });
  }
};

// Get purchase by ID
exports.getPurchaseById = async (req, res) => {
  const user = req.user;
  try {
    const purchase = await Purchase.findById(req.params.id).populate('items.itemId');
    if (!purchase) {
      return res.status(404).json({ message: 'Purchase not found' });
    }
    res.json(purchase);
  } catch (error) {
    logger.error('purchase', `Error fetching purchase by ID: ${req.params.id}`, error, user);
    res.status(500).json({ message: 'Server error while fetching purchase' });
  }
};