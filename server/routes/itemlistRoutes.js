const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const itemController = require("../controllers/itemController");
const purchaseController = require("../controllers/purchaseController");
const auth = require("../middleware/auth"); // Import auth middleware
const { Purchase } = require("../models/itemlist"); // Import Purchase model

// More specific routes first
router.get("/purchases/all", auth, purchaseController.getAllPurchases); // Get all purchases (Protected)
router.post("/purchase", auth, purchaseController.addBulkPurchase); // Add bulk purchase
router.get("/categories", itemController.getCategories); // GET categories
router.post("/categories", auth, itemController.createCategory); // POST new category (Protected)
// router.post('/categories/subcategory', auth, itemController.createSubcategory); // POST new subcategory (Protected)
router.get("/export-excel", auth, itemController.exportItemsToExcel); // New route for export
router.post(
  "/import-uploaded-excel",
  auth,
  itemController.uploadMiddleware,
  itemController.importItemsFromUploadedExcel
); // New route for uploaded excel import
router.get("/restock-summary", auth, itemController.getRestockSummary); // Added route for restock summary

router.get("/:id/purchases", auth, purchaseController.getItemPurchaseHistory);

router.post("/:id/purchase", auth, purchaseController.addSinglePurchase); // Add purchase to specific item

// Item routes
router.get("/", auth, itemController.getAllItems); // GET all items (Protected)
router.get("/:id", auth, itemController.getItemById); // GET single item (Protected)
router.post("/", auth, itemController.createItem); // Create item (Protected)
router.put("/:id", auth, itemController.updateItem); // Update item (Protected)
router.delete("/:id", auth, itemController.deleteItem); // Delete item (Protected)

router.patch("/:id/approve", auth, itemController.approveItem);
// router.get("/:id/ticket-usage", auth, itemController.getItemTicketUsageHistory);

module.exports = router;
