const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const itemController = require('../controllers/itemController');
const purchaseController = require('../controllers/purchaseController');
const auth = require('../middleware/auth'); // Import auth middleware
const { Purchase } = require('../models/itemlist'); // Import Purchase model

// More specific routes first
router.get('/purchases/all', purchaseController.getAllPurchases); // Get all purchases
router.post('/purchase', purchaseController.addBulkPurchase);     // Add bulk purchase
router.get('/categories', itemController.getCategories);          // GET categories
router.get('/export-excel', auth, itemController.exportItemsToExcel); // New route for export
router.post('/import-uploaded-excel', auth, itemController.uploadMiddleware, itemController.importItemsFromUploadedExcel); // New route for uploaded excel import

// Move this implementation to purchaseController and use a controller method instead
// router.post('/import-from-excel', auth, itemController.importItemsFromExcelViaAPI); // Old route for server-side Excel import - commented out
router.get('/:id/purchases', purchaseController.getItemPurchaseHistory);

router.post('/:id/purchase', purchaseController.addSinglePurchase);  // Add purchase to specific item

// Item routes
router.get('/', auth, itemController.getAllItems); // GET all items (Protected)
router.get('/:id', auth, itemController.getItemById); // GET single item (Protected)
router.post('/', auth, itemController.createItem); // Create item (Protected)
router.put('/:id', auth, itemController.updateItem); // Update item (Protected)
router.delete('/:id', auth, itemController.deleteItem); // Delete item (Protected)

module.exports = router;