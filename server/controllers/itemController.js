const { Item, Purchase } = require('../models/itemlist');
const ItemBackup = require('../models/itemBackup'); // Import backup model
const mongoose = require('mongoose');
const logger = require('../utils/logger'); // Import logger

const debug = (message, data = null) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEBUG] ${message}`, data);
  }
};

// Get all items
exports.getAllItems = async (req, res) => {
  const user = req.user || null;
  try {
    logger.debug('item', "Fetching all items", user);
    const items = await Item.find().sort({ name: 1 });
    logger.debug('item', "Items fetched successfully", user, { count: items.length });
    // logger.info('item', `Fetched all items`, user, { count: items.length }); // Can be noisy
    res.json(items);
  } catch (error) {
    debug("Error fetching items", error);
    console.error('Error fetching items:', error);
    res.status(500).json({ 
      message: 'Server error while fetching items',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get item categories
exports.getCategories = async (req, res) => {
  const user = req.user || null;
    try {
    debug("Attempting to fetch categories");
    
    // Simplified approach to get unique categories and subcategories
    const items = await Item.find({}, 'category subcategory');
    
    // Create a map to track categories and their subcategories
    const categoriesMap = new Map();
    
    items.forEach(item => {
      const category = item.category || 'Other'; // Handle null/undefined categories
      
      if (!categoriesMap.has(category)) {
        categoriesMap.set(category, new Set());
      }
      
      if (item.subcategory) {
        categoriesMap.get(category).add(item.subcategory);
      } else {
        categoriesMap.get(category).add('General');
      }
    });
    
    // Convert map to array format suitable for frontend
    const categories = Array.from(categoriesMap).map(([category, subcategories]) => ({
      category,
      subcategories: Array.from(subcategories)
    }));
    
    logger.debug('item', "Categories fetched successfully", user, categories);
    res.json(categories);
    
  } catch (error) {
    debug("Categories fetch failed", error);
    console.error("Error in getCategories:", error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching categories',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

  
exports.getItemById = async (req, res) => {
  const { id } = req.params;
  const user = req.user || null;

  // Check if id is a valid ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid item ID format' });
  }

  try {
    const item = await Item.findById(id);
    // logger.debug('item', `Fetched item by ID: ${id}`, user); // Debug level
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }
    logger.info('item', `Fetched item by ID: ${id}`, user, { itemId: id, itemName: item.name });
    res.json(item);
  } catch (error) {
    console.error('Error fetching item details:', error);
    res.status(500).json({ message: 'Server error while fetching item' });
  }
};

// Create new item
exports.createItem = async (req, res) => {
  try {
    const user = req.user || null;
    const newItem = new Item({
      name: req.body.name,
      quantity: req.body.quantity || 0,
      price: req.body.price || 0,
      gstRate: req.body.gstRate || 0,
      hsnCode: req.body.hsnCode || '',
      unit: req.body.unit || 'Nos',
      category: req.body.category || 'Other',
      subcategory: req.body.subcategory || 'General',
      discountAvailable: req.body.discountAvailable || false,
      dynamicPricing: req.body.dynamicPricing || false
    });

    const savedItem = await newItem.save();
    logger.info('item', `Item created successfully`, user, { itemId: savedItem._id, itemName: savedItem.name });
    res.status(201).json(savedItem);
  } catch (error) {
    console.error('Error creating item:', error);
    logger.error('item', `Failed to create item`, error, req.user, { requestBody: req.body });
    res.status(400).json({ 
      message: error.message.includes('validation') ? 
        'Validation failed: ' + error.message : 
        'Error creating item'
    });
  }
};

// Update item
exports.updateItem = async (req, res) => {
  try {
    const user = req.user || null;
    const updatedItem = await Item.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          name: req.body.name,
          quantity: req.body.quantity || 0,
          price: req.body.price || 0,
          gstRate: req.body.gstRate || 0,
          hsnCode: req.body.hsnCode || '',
          unit: req.body.unit || 'Nos',
          category: req.body.category || 'Other',
          subcategory: req.body.subcategory || 'General',
          discountAvailable: req.body.discountAvailable || false,
          dynamicPricing: req.body.dynamicPricing || false
        }
      },
      { new: true, runValidators: true }
    );
    
    if (!updatedItem) {
      logger.warn('item', `Item not found for update: ${req.params.id}`, user, { itemId: req.params.id, requestBody: req.body });
      return res.status(404).json({ message: 'Item not found' });
    }
    
    logger.info('item', `Item updated successfully`, user, { itemId: updatedItem._id, itemName: updatedItem.name });
    res.json(updatedItem);
  } catch (error) {
    console.error('Error updating item:', error);
    res.status(400).json({ 
      message: error.message.includes('validation') ? 
        'Validation failed: ' + error.message : 
        'Error updating item'
    });
  }
};

// Delete item
exports.deleteItem = async (req, res) => {
  const itemId = req.params.id;
  const userId = req.user ? req.user._id : null;
  const user = req.user || null;
  const session = await mongoose.startSession();
  const logDetails = { userId, itemId, model: 'Item', operation: 'delete', sessionId: session.id };

  logger.info('delete', `[DELETE_INITIATED] Item ID: ${itemId}. Transaction started.`, user, logDetails);

  try {
    session.startTransaction();
    logger.debug('delete', `[FETCH_ATTEMPT] Finding Item ID: ${itemId} for backup and deletion within transaction.`, user, logDetails);
    const itemToBackup = await Item.findById(itemId).session(session);
    
    if (!itemToBackup) {
      await session.abortTransaction(); // Ensure transaction is aborted on not found
      session.endSession();
      logger.warn(`[NOT_FOUND] Item not found for deletion. Transaction aborted.`, logDetails);
      return res.status(404).json({ message: 'Item not found' });
    }
    logger.debug(`[FETCH_SUCCESS] Found Item ID: ${itemId}. Preparing for backup within transaction.`, logDetails);

    const backupData = itemToBackup.toObject();
    const newBackupEntry = new ItemBackup({
      ...backupData,
      originalId: itemToBackup._id,
      deletedBy: userId,
      deletedAt: new Date(),
      originalCreatedAt: itemToBackup.createdAt,
      originalUpdatedAt: itemToBackup.updatedAt,
      backupReason: "User-initiated deletion via API"
    });

    logger.debug('delete', `[PRE_BACKUP_SAVE] Attempting to save backup for Item ID: ${itemToBackup._id} within transaction.`, user, { ...logDetails, originalId: itemToBackup._id });
    await newBackupEntry.save({ session }); // Save backup within the transaction
    logger.info('delete', `[BACKUP_SUCCESS] Item successfully backed up. Backup ID: ${newBackupEntry._id}.`, user, { ...logDetails, originalId: itemToBackup._id, backupId: newBackupEntry._id, backupModel: 'ItemBackup' });

    logger.debug('delete', `[PRE_ORIGINAL_DELETE] Attempting to delete original Item ID: ${itemToBackup._id} within transaction.`, user, { ...logDetails, originalId: itemToBackup._id });
    await Item.findByIdAndDelete(itemId, { session });
    logger.info('delete', `[ORIGINAL_DELETE_SUCCESS] Original Item successfully deleted.`, user, { ...logDetails, originalId: itemToBackup._id });

    // Update any purchase records that reference this item
    // This part remains, ensuring data integrity for purchases
    logger.debug(`[UPDATE_PURCHASES_ATTEMPT] Updating Purchase records referencing deleted Item ID: ${itemId} within transaction.`, { ...logDetails, targetModel: 'Purchase' });
    await Purchase.updateMany(
      { 'items.itemId': itemId },
      { $set: { 'items.$.itemId': null } }
    ).session(session); // Ensure this is also in the transaction
    logger.info(`[UPDATE_PURCHASES_SUCCESS] Purchase records updated for Item ID: ${itemId}.`, { ...logDetails, targetModel: 'Purchase' });

    await session.commitTransaction();
    res.status(200).json({
      message: 'Item deleted, backed up, and purchase references updated successfully.',
      originalId: itemToBackup._id,
      backupId: newBackupEntry._id
    });

  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
      logger.warn('delete', `[ROLLBACK_TRANSACTION] Transaction rolled back due to error during Item deletion process for ID: ${itemId}.`, user, { ...logDetails, errorMessage: error.message });
    }
    logger.error(`[DELETE_ERROR] Error during Item deletion process for ID: ${itemId}.`, error, logDetails);
    res.status(500).json({ message: 'Server error during the deletion process. Please check server logs.' });
  } finally {
    session.endSession();
  }
};

// Get purchase history for specific item
exports.getItemPurchaseHistory = async (req, res) => {
  try {
    const user = req.user || null;
    const { id } = req.params;
    
    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid item ID format' });
    }

    // First check if item exists
    const itemExists = await Item.exists({ _id: id });
    if (!itemExists) {
      logger.warn('item', `Item not found when fetching purchase history: ${id}`, user);
      return res.status(404).json({ message: 'Item not found' });
    }

    // Get purchases where this item is referenced - with projection for better performance
    const purchases = await Purchase.find({ 
      'items.itemId': new mongoose.Types.ObjectId(id) 
    }, {
      date: 1,
      companyName: 1,
      gstNumber: 1,
      invoiceNumber: 1,
      'items.$': 1 // MongoDB positional operator to get only matching items
    }).sort({ date: -1 }).limit(50); // Add limit for performance

    // logger.debug('item', `Fetched purchase history for item ID: ${id}`, user, { purchaseCount: purchases.length }); // Debug level
    // Format response
    const formattedPurchases = purchases.map(purchase => {
      const itemData = purchase.items[0]; // Using the positional projection above
      
      return {
        _id: purchase._id,
        date: purchase.date,
        companyName: purchase.companyName,
        gstNumber: purchase.gstNumber,
        invoiceNumber: purchase.invoiceNumber,
        quantity: itemData?.quantity || 0,
        price: itemData?.price || 0,
        gstRate: itemData?.gstRate || 0,
        amount: (itemData?.price || 0) * (itemData?.quantity || 0),
        totalWithGst: (itemData?.price || 0) * (itemData?.quantity || 0) * 
                      (1 + (itemData?.gstRate || 0) / 100)
      };
    });

    res.json(formattedPurchases);
  } catch (error) {
    logger.error('item', `Failed to fetch purchase history for item ID: ${id}`, error, user);
    console.error('Error fetching purchase history:', error);
    res.status(500).json({ 
      message: 'Server error while fetching purchase history',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};