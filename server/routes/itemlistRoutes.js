const express = require('express');
const router = express.Router();
const Item = require('../models/itemlist');

// GET all items
router.get('/', async (req, res) => {
  try {
    const items = await Item.find().sort({ name: 1 });
    res.json(items);
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({ message: 'Server error while fetching items' });
  }
});

// GET item categories
router.get('/categories', async (req, res) => {
  try {
    const categories = await Item.aggregate([
      {
        $group: {
          _id: '$category',
          subcategories: { $addToSet: '$subcategory' }
        }
      },
      {
        $project: {
          _id: 0,
          category: '$_id',
          subcategories: 1
        }
      }
    ]);
    
    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ message: 'Server error while fetching categories' });
  }
});

// GET single item with purchase history
router.get('/:id', async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }
    res.json(item);
  } catch (error) {
    console.error('Error fetching item details:', error);
    res.status(500).json({ message: 'Server error while fetching item details' });
  }
});

// POST create new item
router.post('/', async (req, res) => {
  try {
    const newItem = new Item({
      name: req.body.name,
      quantity: req.body.quantity || 0,
      price: req.body.price || 0,
      gstRate: req.body.gstRate || 0,
      hsnCode: req.body.hsnCode || '',
      unit: req.body.unit || 'Nos',
      category: req.body.category || '',
      subcategory: req.body.subcategory || 'General',
      discountAvailable: req.body.discountAvailable || false,
      dynamicPricing: req.body.dynamicPricing || false,
      purchaseHistory: []
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
});

// PUT update item
router.put('/:id', async (req, res) => {
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
          category: req.body.category || '',
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
});

// DELETE item
router.delete('/:id', async (req, res) => {
  try {
    const deletedItem = await Item.findByIdAndDelete(req.params.id);
    
    if (!deletedItem) {
      return res.status(404).json({ message: 'Item not found' });
    }
    
    res.json({ message: 'Item deleted successfully' });
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({ message: 'Server error while deleting item' });
  }
});

// POST add purchase entry to an item
router.post('/:id/purchase', async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }
    
    const newPurchase = {
      companyName: req.body.companyName,
      gstNumber: req.body.gstNumber || '',
      address: req.body.address || '',
      stateName: req.body.stateName || '',
      invoiceNumber: req.body.invoiceNumber,
      date: req.body.date ? new Date(req.body.date) : new Date(),
      quantity: parseFloat(req.body.quantity) || 0,
      price: parseFloat(req.body.price) || 0,
      gstRate: parseFloat(req.body.gstRate) || 0,
      description: req.body.description || ''
    };

    if (!newPurchase.companyName || !newPurchase.invoiceNumber || 
        isNaN(newPurchase.quantity) || isNaN(newPurchase.price)) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    item.purchaseHistory.push(newPurchase);
    item.quantity += newPurchase.quantity;

    const updatedItem = await item.save();
    res.status(201).json(updatedItem);
  } catch (error) {
    console.error('Error adding purchase:', error);
    res.status(400).json({ 
      message: error.message.includes('validation') ? 
        'Validation failed: ' + error.message : 
        'Error adding purchase'
    });
  }
});

module.exports = router;