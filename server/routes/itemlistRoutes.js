const express = require('express');
const router = express.Router();
const itemController = require('../controllers/itemController');
const purchaseController = require('../controllers/purchaseController');

// More specific routes first
router.get('/purchases/all', purchaseController.getAllPurchases); // Get all purchases
router.post('/purchase', purchaseController.addBulkPurchase);     // Add bulk purchase
router.get('/categories', itemController.getCategories);          // GET categories

// Item-related purchases
router.get('/:id/purchases', itemController.getItemPurchaseHistory); // Get purchase history for item
router.post('/:id/purchase', purchaseController.addSinglePurchase);  // Add purchase to specific item

// Item routes
router.get('/', itemController.getAllItems); // GET all items
router.get('/:id', itemController.getItemById); // GET single item
router.post('/', itemController.createItem); // Create item
router.put('/:id', itemController.updateItem); // Update item
router.delete('/:id', itemController.deleteItem); // Delete item

module.exports = router;
