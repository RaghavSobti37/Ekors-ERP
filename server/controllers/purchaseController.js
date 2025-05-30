const { Item, Purchase } = require('../models/itemlist');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const user = require("../models/users");

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
    for (const purchasedItem of savedPurchase.items) { // Iterate over items from the saved purchase document
      logger.debug('purchase_item_processing', `Processing purchase line item: ${JSON.stringify(purchasedItem)}`, user);
      let itemToUpdate = null;
      if (purchasedItem.itemId) { // Only if it's an existing item with a valid ID
    logger.debug('purchase_stock_update', `Processing item with ID: ${purchasedItem.itemId}, Description: ${purchasedItem.description}`, user);
        itemToUpdate = await Item.findById(purchasedItem.itemId);
      } else if (purchasedItem.description) {
        // Fallback: If itemId is not present, try to find by description (name)
        // For a more robust match, HSN code should ideally be part of purchasedItem if available from input
        logger.debug('purchase_stock_update', `Attempting to find item by description (name) only: "${purchasedItem.description}" as itemId was not provided.`, user);
        itemToUpdate = await Item.findOne({ name: purchasedItem.description });
        if (itemToUpdate) {
          logger.info('purchase_stock_update', `Found item by name match: ${itemToUpdate.name} (ID: ${itemToUpdate._id}). Proceeding with stock update.`, user);
        }
      }

        if (itemToUpdate) {
        logger.debug('purchase_stock_update', `Found item in DB: ${itemToUpdate.name}, Current Qty: ${itemToUpdate.quantity}`, user);
            const quantityAdded = purchasedItem.quantity;
            itemToUpdate.quantity += purchasedItem.quantity;
            itemToUpdate.lastPurchaseDate = savedPurchase.date; // Update last purchase date
            itemToUpdate.lastPurchasePrice = purchasedItem.price; // Update last purchase price

            // Update restock status
            if (itemToUpdate.needsRestock) {
              itemToUpdate.restockAmount -= quantityAdded;
              if (itemToUpdate.restockAmount <= 0 || itemToUpdate.quantity >= itemToUpdate.lowStockThreshold) {
                itemToUpdate.needsRestock = false;
                itemToUpdate.restockAmount = 0;
                logger.info('inventory', `Item ${itemToUpdate.name} restocked. No longer needs restock. New Qty: ${itemToUpdate.quantity}`, user);
              } else {
                logger.info('inventory', `Item ${itemToUpdate.name} partially restocked. Still needs: ${itemToUpdate.restockAmount}. New Qty: ${itemToUpdate.quantity}`, user);
              }
            }

            // TODO: Review this. The Item model (models/itemlist.js) does not seem to have 'purchaseHistory' array anymore.
            // Add to item's specific purchase history
            // If you have a direct purchaseHistory array on Item model:
            // itemToUpdate.purchaseHistory.push({ /* ... purchase details ... */ });

            await itemToUpdate.save(); // Save the updated item
            logger.info('inventory', `Inventory updated for item: ${itemToUpdate.name} via purchase ${savedPurchase.invoiceNumber}. Added: ${quantityAdded}, New Qty: ${itemToUpdate.quantity}`, user);
        } else {
            // Optionally, handle cases where an itemId is provided but the item doesn't exist
            // or if fallback search by name also fails.
        const identifier = purchasedItem.itemId ? `ID ${purchasedItem.itemId}` : `description "${purchasedItem.description}"`;
        logger.warn('purchase_stock_update', `Item with ${identifier} not found in DB during bulk purchase stock update. Stock not updated for this item.`, user, { searchedItemId: purchasedItem.itemId, searchedDescription: purchasedItem.description });
        }
      // Removed the 'else' block that was here, as the condition is now handled by the itemToUpdate check
    }
    
    // Enhanced logging for purchased items
    const purchasedItemsDetails = savedPurchase.items.map(pi => ({
      name: pi.description,
      hsnCode: items.find(reqItem => reqItem.description === pi.description)?.hsnCode || 'N/A', // Attempt to find HSN from original request
      quantityPurchased: pi.quantity
    }));

    logger.info('purchase', `Bulk purchase added successfully. Invoice: ${invoiceNumber}`, user, { purchaseId: savedPurchase._id, itemsProcessed: purchasedItemsDetails });
    res.status(201).json({ success: true, data: savedPurchase });
  } catch (error) {
    console.error('Error adding bulk purchase:', error);
    // Check for Mongoose validation error
    if (error.name === 'ValidationError') {
        // Send back specific validation errors
        return res.status(400).json({ success: false, message: 'Validation failed creating purchase', errors: error.errors });
    }
    res.status(500).json({ success: false, message: 'Failed to add purchase', error: error.message });
  }
};

exports.getItemPurchaseHistory = async (req, res) => {
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
  } catch (err) {
    console.error('Error fetching purchase history:', err);
    res.status(500).json({ message: 'Server error fetching purchase history' });
  }
};

// Get all purchases
exports.getAllPurchases = async (req, res) => {
  try {
    // Fetch all purchases and sort by date descending (newest first)
    const purchases = await Purchase.find().sort({ date: -1 }).lean();;
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