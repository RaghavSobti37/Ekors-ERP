const { Item, Purchase } = require('../models/itemlist');
const mongoose = require('mongoose');

const debug = (message, data = null) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEBUG] ${message}`, data);
  }
};

// Get all items
exports.getAllItems = async (req, res) => {
  try {
    debug("Fetching all items");
    const items = await Item.find().sort({ name: 1 });
    debug("Items fetched successfully", { count: items.length });
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
    
    debug("Categories fetched successfully", categories);
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

  // Check if id is a valid ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid item ID format' });
  }

  try {
    const item = await Item.findById(id);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }
    res.json(item);
  } catch (error) {
    console.error('Error fetching item details:', error);
    res.status(500).json({ message: 'Server error while fetching item' });
  }
};

// Create new item
exports.createItem = async (req, res) => {
  try {
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
    res.status(201).json(savedItem);
  } catch (error) {
    console.error('Error creating item:', error);
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
      return res.status(404).json({ message: 'Item not found' });
    }
    
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
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    // Find the item first to make sure it exists
    const item = await Item.findById(req.params.id).session(session);
    
    if (!item) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Item not found' });
    }
    
    // Delete the item
    await Item.findByIdAndDelete(req.params.id).session(session);
    
    // Update any purchase records that reference this item
    await Purchase.updateMany(
      { 'items.itemId': req.params.id },
      { $set: { 'items.$.itemId': null } }
    ).session(session);
    
    await session.commitTransaction();
    res.json({ message: 'Item deleted successfully' });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error deleting item:', error);
    res.status(500).json({ message: 'Server error while deleting item' });
  } finally {
    session.endSession();
  }
};

// Get purchase history for specific item
exports.getItemPurchaseHistory = async (req, res) => {
  try {
    // Find the item first to get embedded purchase history
    const item = await Item.findById(req.params.id);
    
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }
    
    // Find any purchases that reference this item
    const purchases = await Purchase.find({
      'items.itemId': req.params.id
    }).sort({ date: -1 });

    // Format the purchase history for the frontend
    const formattedPurchases = purchases.map(purchase => {
      const itemInfo = purchase.items.find(item => 
        item.itemId && item.itemId.toString() === req.params.id
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
    
    // Also include the item's embedded purchase history
    const allPurchaseHistory = [
      ...formattedPurchases,
      ...(item.purchaseHistory || []).map(ph => ({
        date: ph.date,
        companyName: ph.companyName,
        gstNumber: ph.gstNumber,
        invoiceNumber: ph.invoiceNumber,
        quantity: ph.quantity,
        price: ph.price,
        gstRate: ph.gstRate,
        total: ph.price * ph.quantity * (1 + ph.gstRate / 100)
      }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json(allPurchaseHistory);
  } catch (error) {
    console.error('Error fetching purchase history:', error);
    res.status(500).json({ message: 'Server error while fetching purchase history' });
  }
};