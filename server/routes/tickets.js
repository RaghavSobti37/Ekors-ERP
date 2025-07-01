// server/routes/tickets.js
const express = require("express");
const router = express.Router();
const Ticket = require("../models/opentickets");
const auth = require("../middleware/auth");
const multer = require("multer");
const path = require("path");
const fs = require("fs-extra"); // Use fs-extra for ensureDirSync
const ticketController = require("../controllers/ticketController");
const logger = require("../logger"); // Ensure logger is available

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

<<<<<<< HEAD
// Get single ticket by ID
router.get("/:id", auth, ticketController.getTicketById);
=======
router.get("/:id", auth, async (req, res) => {
  try {
    // Ensure this is not matching '/transfer-candidates'
    if (req.params.id === "transfer-candidates") {
      // This should not happen if routes are ordered correctly
      logger.error(
        "ticket-route-error",
        "CRITICAL: /:id route incorrectly matched /transfer-candidates. Check route order.",
        req.user,
        { params: req.params }
      );
      return res
        .status(500)
        .json({ error: "Server routing configuration error." });
    }

    const ticket = await Ticket.findOne({
      _id: req.params.id,
      // Allow super-admin to view any ticket by ID, others are restricted
      ...(req.user.role !== "super-admin" && {
        $or: [{ currentAssignee: req.user.id }, { createdBy: req.user.id }],
      }),
    });
    if (!ticket) {
      logger.log({
        user: req.user,
        page: "Ticket",
        action: "Get Ticket By ID",
        api: req.originalUrl,
        req,
        message: `Ticket not found or access denied for ID: ${req.params.id}`,
        details: {},
        level: "warn"
      });
      return res
        .status(404)
        .json({ error: "Ticket not found or access denied" });
    }
    logger.log({
      user: req.user,
      page: "Ticket",
      action: "Get Ticket By ID",
      api: req.originalUrl,
      req,
      message: `Fetched ticket: ${req.params.id}`,
      details: { ticketId: req.params.id },
      level: "info"
    });
    // ... (rest of your population logic for GET /:id)
    const populatedTicket = await Ticket.findById(ticket._id)
      .populate({ path: "currentAssignee", select: "firstname lastname email" })
      .populate({ path: "createdBy", select: "firstname lastname email" })
      .populate({
        path: "transferHistory.from",
        select: "firstname lastname email",
      })
      .populate({
        path: "transferHistory.to",
        select: "firstname lastname email",
      })
      .populate({
        path: "transferHistory.transferredBy",
        select: "firstname lastname email",
      })
      .populate({
        path: "documents.quotation.uploadedBy",
        select: "firstname lastname email",
      })
      .populate({
        path: "documents.po.uploadedBy",
        select: "firstname lastname email",
      })
      .populate({
        path: "documents.pi.uploadedBy",
        select: "firstname lastname email",
      })
      .populate({
        path: "documents.challan.uploadedBy",
        select: "firstname lastname email",
      })
      .populate({
        path: "documents.packingList.uploadedBy",
        select: "firstname lastname email",
      })
      .populate({
        path: "documents.feedback.uploadedBy",
        select: "firstname lastname email",
      })
      .populate({
        path: "documents.other.uploadedBy",
        select: "firstname lastname email",
      })
      .populate({
        path: "statusHistory.changedBy",
        select: "firstname lastname email",
      });

    res.json(populatedTicket);
  } catch (error) {
    logger.log({
      user: req.user,
      page: "Ticket",
      action: "Get Ticket By ID Error",
      api: req.originalUrl,
      req,
      message: `Failed to fetch ticket by ID: ${req.params.id}`,
      details: { error: error.message, stack: error.stack },
      level: "error"
    });
    res.status(500).json({ error: "Failed to fetch ticket" });
  }
});
>>>>>>> 871eea39ee2777f57e4fdae8e5265e13500dde3a

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
