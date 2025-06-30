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

// // Report Routes (pointing to controller methods)
// router.get("/report/summary", auth, quotationController.generateQuotationsReport);
// router.get("/report/excel", auth, quotationController.exportQuotationsToExcel);

router.get(
  "/quotations/ref/:quotationNumber",
  auth, // Assuming authentication is required to fetch quotations
  ticketController.getQuotationByReference // New controller function
);

module.exports = router;