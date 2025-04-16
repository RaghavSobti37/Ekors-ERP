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
    const { id } = req.params;
    
    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid item ID format' });
    }

    // First check if item exists
    const itemExists = await Item.exists({ _id: id });
    if (!itemExists) {
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
    console.error('Error fetching purchase history:', error);
    res.status(500).json({ 
      message: 'Server error while fetching purchase history',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};