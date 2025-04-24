const express = require('express');
const router = express.Router();
const mongoose = require('mongoose'); // Add missing mongoose import
const itemController = require('../controllers/itemController');
const purchaseController = require('../controllers/purchaseController');
const { Purchase } = require('../models/itemlist'); // Import Purchase model

// More specific routes first
router.get('/purchases/all', purchaseController.getAllPurchases); // Get all purchases
router.post('/purchase', purchaseController.addBulkPurchase);     // Add bulk purchase
router.get('/categories', itemController.getCategories);          // GET categories

// Move this implementation to purchaseController and use a controller method instead
router.get('/:id/purchases', purchaseController.getItemPurchaseHistory);

router.post('/:id/purchase', purchaseController.addSinglePurchase);  // Add purchase to specific item

// Item routes
router.get('/', itemController.getAllItems); // GET all items
router.get('/:id', itemController.getItemById); // GET single item
router.post('/', itemController.createItem); // Create item
router.put('/:id', itemController.updateItem); // Update item
router.delete('/:id', itemController.deleteItem); // Delete item

module.exports = router;