// server/routes/tickets.js
const express = require("express");
const router = express.Router();
const Ticket = require("../models/opentickets");
const auth = require("../middleware/auth");
const multer = require("multer");
const path = require("path");
const fs = require("fs-extra"); // Use fs-extra for ensureDirSync
const ticketController = require("../controllers/ticketController");
const logger = require("../utils/logger"); // Ensure logger is available

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, "../uploads", req.params.id);
    // Use fs-extra's ensureDirSync for recursive directory creation
    fs.ensureDirSync(uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, "_");
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + sanitizedName);
  },
});

// Multer file filter
const fileFilter = (req, file, cb) => {
   const allowedTypes = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "application/msword", // .doc
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
    "application/vnd.ms-excel", // .xls
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type"), false);
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter,
});

// Admin-specific delete route (requires super-admin role)
router.delete(
  "/admin/:id",
  auth,
  (req, res, next) => {
    if (req.user.role !== "super-admin") {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  },
  ticketController.adminDeleteTicket
);

// CRITICAL: This route MUST come BEFORE any general '/:id' route
router.get("/transfer-candidates", auth, ticketController.getTransferCandidates);

// Get single ticket by ID
router.get("/:id", auth, ticketController.getTicketById);

// Update ticket by ID
router.put("/:id", auth, ticketController.updateTicket);

// Transfer ticket assignment
router.post("/:id/transfer", auth, ticketController.transferTicket);

// Delete ticket by ID
router.delete("/:id", auth, ticketController.deleteTicket);

// Document Upload Route
router.post(
  "/:id/documents",
  auth,
  upload.single("document"),
    // Add Multer error handling middleware
  (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
      logger.error("ticket-doc-upload-multer-error", `Multer error during upload for Ticket ID: ${req.params.id}`, err, req.user);
      return res.status(400).json({ error: "File upload failed", details: err.message });
    } else if (err) {
      logger.error("ticket-doc-upload-general-error", `General error during upload for Ticket ID: ${req.params.id}`, err, req.user);
      return res.status(500).json({ error: "Error uploading document", details: err.message });
    } next();
  },
  ticketController.uploadTicketDocument
);

// Document Delete Route
router.delete(
  "/:id/documents",
  auth,
  ticketController.deleteTicketDocument
);

// Use the new controller for the main ticket listing
router.get("/", auth, ticketController.getAllTickets);

// Create a new ticket
router.post("/", auth, ticketController.createTicket);

// Check if a ticket exists for a given quotation number
router.get(
  "/check/:quotationNumber",
  auth,
  ticketController.checkExistingTicket
);

// --- Legacy routes (consider refactoring or removing if fully replaced) ---
router.get("/from-index/all", ticketController.getAllTickets_IndexLogic);
router.post("/from-index/create", ticketController.createTicket_IndexLogic);
router.put("/from-index/:id", ticketController.updateTicket_IndexLogic);
router.get("/serve-file/:filename", ticketController.serveFile_IndexLogic);

module.exports = router;
