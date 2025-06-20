// c:\Users\Raghav Raj Sobti\Desktop\fresh\server\routes\tickets.js
const express = require("express");
const router = express.Router();
const Ticket = require("../models/opentickets");
const auth = require("../middleware/auth");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const ticketController = require("../controllers/ticketController");
const logger = require("../utils/logger"); // Ensure logger is available

// ... (multer setup remains the same) ...
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

router.post("/", auth, ticketController.createTicket);

router.get(
  "/check/:quotationNumber",
  auth,
  ticketController.checkExistingTicket
);

// CRITICAL: This route MUST come BEFORE any general '/:id' route
router.get(
  "/transfer-candidates",
  auth,
  ticketController.getTransferCandidates
);

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
      logger.warn(
        "ticket-fetch",
        `Ticket not found or access denied for ID: ${req.params.id}`,
        req.user
      );
      return res
        .status(404)
        .json({ error: "Ticket not found or access denied" });
    }

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
    // This is the source of the "Failed to fetch ticket" error
    logger.error(
      "ticket-fetch-error",
      `Error fetching ticket by ID: ${req.params.id}`,
      error,
      req.user
    );
    res.status(500).json({ error: "Failed to fetch ticket" });
  }
});

router.put("/:id", auth, ticketController.updateTicket);

router.post("/:id/transfer", auth, ticketController.transferTicket);

router.delete("/:id", auth, ticketController.deleteTicket);

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

  async (req, res) => {
    try {
      const { documentType } = req.body;
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const ticketId = req.params.id;
      const ticket = await Ticket.findOne({
        _id: ticketId,
        $or: [{ currentAssignee: req.user.id }, { createdBy: req.user.id }],
      });

      if (!ticket) {
        return res.status(404).json({
          error:
            "Ticket not found or you are not authorized to upload documents.",
        });
      }

      const documentData = {
        path: req.file.filename,
        originalName: req.file.originalname,
        uploadedBy: req.user.id,
        uploadedAt: new Date(),
      };

      if (!ticket.documents) {
        ticket.documents = {};
      }

      if (documentType && documentType !== "other") {
        if (
          ticket.documents[documentType] &&
          ticket.documents[documentType].path
        ) {
          const oldFilePath = path.join(
            __dirname,
            "../uploads",
            ticketId,
            ticket.documents[documentType].path
          );
          if (fs.existsSync(oldFilePath)) {
            fs.unlinkSync(oldFilePath);
          }
        }
        ticket.documents[documentType] = documentData;
      } else {
        if (!ticket.documents.other) {
          ticket.documents.other = [];
        }
        ticket.documents.other.push(documentData);
      }

      ticket.markModified("documents");
      await ticket.save();

      const finalTicket = await Ticket.findById(ticket._id)
        .populate({
          path: "currentAssignee",
          select: "firstname lastname email",
        })
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

      res.json(finalTicket);
    } catch (error) {
      logger.error(
        "ticket-doc-upload-error",
        `Failed to upload document for Ticket ID: ${req.params.id}`,
        error,
        req.user
      );
      res
        .status(500)
        .json({ error: "Error uploading document", details: error.message });
    }
  }
);

router.delete(
  "/:id/documents",
  auth,
  // ... (your existing document delete logic) ...
  async (req, res) => {
    const { documentType, documentPath } = req.body;
    const ticketId = req.params.id;

    try {
      const ticket = await Ticket.findById(ticketId);
      if (!ticket) {
        return res.status(404).json({ message: "Ticket not found." });
      }

      const canModify =
        req.user.role === "super-admin" ||
        ticket.currentAssignee.toString() === req.user.id.toString() ||
        ticket.createdBy.toString() === req.user.id.toString();

      if (!canModify) {
        return res.status(403).json({
          message: "Forbidden: You cannot modify this ticket's documents.",
        });
      }

      let fileRemoved = false;
      const fullFilePath = path.join(
        __dirname,
        "../uploads",
        ticketId,
        documentPath
      );

      if (!ticket.documents) {
        return res
          .status(404)
          .json({ message: "No documents found for this ticket." });
      }

      if (documentType && documentType !== "other") {
        if (
          ticket.documents[documentType] &&
          ticket.documents[documentType].path === documentPath
        ) {
          if (fs.existsSync(fullFilePath)) {
            fs.unlinkSync(fullFilePath);
            fileRemoved = true;
          }
          ticket.documents[documentType] = undefined;
        } else {
          return res.status(404).json({
            message: `Document of type ${documentType} with specified path not found.`,
          });
        }
      } else {
        const docIndex = ticket.documents.other?.findIndex(
          (doc) => doc.path === documentPath
        );

        if (docIndex > -1) {
          ticket.documents.other.splice(docIndex, 1);
          if (fs.existsSync(fullFilePath)) {
            fs.unlinkSync(fullFilePath);
            fileRemoved = true;
          }
        } else {
          return res
            .status(404)
            .json({ message: "Document not found in 'other' documents." });
        }
      }
      ticket.markModified("documents");
      await ticket.save();

      const finalTicket = await Ticket.findById(ticket._id)
        .populate({
          path: "currentAssignee",
          select: "firstname lastname email",
        })
        .populate({ path: "createdBy", select: "firstname lastname email" })
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

      res.status(200).json({
        message: "Document deleted successfully.",
        ticket: finalTicket,
        fileRemoved,
      });
    } catch (error) {
      logger.error(
        "ticket-doc-delete-error",
        `Error deleting document for ticket ${ticketId}`,
        error,
        req.user
      );
      res.status(500).json({
        message: "Server error while deleting document.",
        details: error.message,
      });
    }
  }
);

// Use the new controller for the main ticket listing
router.get("/", auth, ticketController.getAllTickets);

// ... (rest of your routes, e.g., /from-index/*)
router.get("/from-index/all", ticketController.getAllTickets_IndexLogic);
router.post("/from-index/create", ticketController.createTicket_IndexLogic);
// router.post(
//   "/from-index/:id/documents",
//   auth,
//   upload.single("document"),
//   ticketController.uploadDocument_IndexLogic
// );
router.put("/from-index/:id", ticketController.updateTicket_IndexLogic);
router.get("/serve-file/:filename", ticketController.serveFile_IndexLogic);

module.exports = router;
