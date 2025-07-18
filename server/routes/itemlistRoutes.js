const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const itemController = require("../controllers/itemController");
const purchaseController = require("../controllers/purchaseController");
const auth = require("../middleware/auth"); // Import auth middleware
const { Purchase, Item } = require("../models/itemlist"); // Import Purchase and Item models
const { STANDARD_UNITS } = require("../utils/payloadServer"); // Import STANDARD_UNITS

// More specific routes first
router.get("/purchases/new", auth, (req, res) => res.status(200).send("Purchase Form Page")); // This route is primarily for frontend navigation
router.get("/purchases/all", auth, purchaseController.getAllPurchases); // Get all purchases (Protected)
router.delete("/purchases/:id", auth, purchaseController.deletePurchaseWithBackup); // Delete purchase with backup
router.post("/purchase", auth, purchaseController.addBulkPurchase); // Add bulk purchase
router.get("/categories/all", itemController.getAllCategories); // GET all unique categories for dropdown
router.get("/export-excel", auth, itemController.exportItemsToExcel); // New route for export
router.post(
  "/import-uploaded-excel",
  auth,
  itemController.uploadMiddleware, 
  itemController.importItemsFromUploadedExcel
); 
router.get("/restock-summary", auth, itemController.getRestockSummary);

router.get("/:id/purchases", auth, purchaseController.getItemPurchaseHistory);
router.delete("/:itemId/clear-logs", auth, itemController.clearItemLogs); 

router.post("/:id/purchase", auth, purchaseController.addSinglePurchase); // Add purchase to specific item

// Item routes
router.get("/", auth, itemController.getAllItems); // GET all items (Protected)
router.get("/:id", auth, itemController.getItemById); // GET single item (Protected)
router.post("/", auth, itemController.createItem); // Create item (Protected)
router.put("/:id", auth, itemController.updateItem); // Update item (Protected)
router.delete("/:id", auth, itemController.deleteItem); // Delete item (Protected)
router.patch("/:id/approve", auth, itemController.approveItem);
// router.get("/:id/ticket-usage", auth, itemController.getItemTicketUsageHistory);

// Use STANDARD_UNITS from payloads.js for all unit validation and schema.

module.exports = router;
