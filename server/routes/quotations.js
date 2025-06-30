const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const quotationController = require("../controllers/quotationController");
const ticketController = require("../controllers/ticketController");
const mongoose = require("mongoose"); // Required for ObjectId validation if used directly in routes

// Main CRUD and Listing
router.get("/", auth, quotationController.getAllQuotations); // Handles pagination, sort, filter
router.post("/", auth, quotationController.handleQuotationUpsert); // Create
router.get("/:id", auth, quotationController.getQuotationById);
router.put("/:id", auth, quotationController.handleQuotationUpsert); // Update
router.delete("/:id", auth, quotationController.deleteQuotation);

// Utility Routes
router.get("/next-number", auth, quotationController.getNextQuotationNumber);
router.get("/check-reference", auth, quotationController.checkReferenceNumber);
router.get(
  "/by-reference/:refNumber",
  auth,
  quotationController.getQuotationByReferenceNumber
);

module.exports = router;