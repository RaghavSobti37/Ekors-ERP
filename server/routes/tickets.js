const express = require("express");
const router = express.Router();
const Ticket = require("../models/opentickets");
const auth = require("../middleware/auth");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const User = require("../models/users");
const ticketController = require("../controllers/ticketController");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Store documents in a subfolder named by the ticket ID
    const uploadPath = path.join(__dirname, "../uploads", req.params.id); 
    fs.mkdirSync(uploadPath, { recursive: true });
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
    "image/png"
    // Removed MS Word types, add back if needed. Keep it simple for now.
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

router.post("/", auth, async (req, res) => {
  try {
    const ticketData = req.body;
    ticketData.createdBy = req.user.id;

    // Rest of your existing code
    if (!ticketData.assignedTo) {
      ticketData.assignedTo = req.user.id;
    }
    ticketData.currentAssignee = ticketData.assignedTo;

    ticketData.statusHistory = [
      {
        status: ticketData.status || "Quotation Sent",
        changedAt: new Date(),
        changedBy: req.user.id,
      },
    ];

    ticketData.assignmentLog = [
      {
        assignedTo: ticketData.currentAssignee,
        assignedBy: req.user.id,
        action: "created",
        assignedAt: new Date(),
      },
    ];

    const ticket = new Ticket(ticketData);
    await ticket.save();

    await User.findByIdAndUpdate(req.user.id, {
      $addToSet: { tickets: ticket._id },
    });

    if (
      ticketData.assignedTo &&
      ticketData.assignedTo.toString() !== req.user.id.toString()
    ) {
      await User.findByIdAndUpdate(ticketData.assignedTo, {
        $addToSet: { tickets: ticket._id },
      });
    }

    res.status(201).json(ticket);
  } catch (error) {
    console.error("Error creating ticket:", error);
    res
      .status(500)
      .json({ error: "Failed to create ticket", details: error.message });
  }
});

router.get("/:id", auth, async (req, res) => {
  try {
    const ticket = await Ticket.findOne({
      _id: req.params.id,
      $or: [{ currentAssignee: req.user.id }, { createdBy: req.user.id }],
    });
    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    // Populate uploadedBy fields for all document types
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
      });

    res.json(populatedTicket);
  } catch (error) {
    console.error("Error fetching ticket:", error);
    res.status(500).json({ error: "Failed to fetch ticket" });
  }
});

router.put("/:id", auth, async (req, res) => {
  try {
    const ticket = await Ticket.findOneAndUpdate(
      {
        _id: req.params.id,
        $or: [
          { currentAssignee: req.user.id },
          { createdBy: req.user.id },
          {
            $and: [{ _id: req.params.id }, { "createdBy.role": "super-admin" }],
          },
        ],
      },
      req.body,
      { new: true }
    );

    if (!ticket) {
      return res.status(404).json({
        error:
          "Ticket not found or you are not the current assignee to update it.",
      });
    }

    res.json(ticket);
  } catch (error) {
    console.error("Error updating ticket:", error);
    res
      .status(500)
      .json({ error: "Failed to update ticket", details: error.message });
  }
});

router.delete("/:id", auth, ticketController.deleteTicket);

router.post(
  "/:id/documents",
  auth,
  upload.single("document"),
  async (req, res) => {
    try {
      const { documentType } = req.body;
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const ticketId = req.params.id;
      // Ensure user is authorized to upload to this ticket (e.g., assignee or creator)
      // This check might be more complex depending on your exact rules.
      // Allow creator or current assignee to upload
      const ticket = await Ticket.findOne({ _id: ticketId, $or: [{ currentAssignee: req.user.id }, { createdBy: req.user.id }] });


      if (!ticket) {
        return res.status(404).json({
          error:
            "Ticket not found or you are not the current assignee to upload documents.",
        });
      }

      const documentData = {
        path: req.file.filename, // Filename is now relative to 'uploads/<ticketId>/'
        originalName: req.file.originalname,
        uploadedBy: req.user.id,
        uploadedAt: new Date(),
      };

      if (!ticket.documents) { // Initialize documents object if it doesn't exist
        ticket.documents = {};
      }

      if (documentType && documentType !== "other") {
        // If replacing an existing file for a specific type, delete the old one
        if (ticket.documents[documentType] && ticket.documents[documentType].path) {
          const oldFilePath = path.join(__dirname, "../uploads", ticketId, ticket.documents[documentType].path);
          if (fs.existsSync(oldFilePath)) {
            fs.unlinkSync(oldFilePath);
          }
        }
        ticket.documents[documentType] = documentData;
      } else { // Default to 'other' or if documentType is explicitly 'other'
        if (!ticket.documents.other) {
          ticket.documents.other = [];
        }
        ticket.documents.other.push(documentData);
      }
      
      // Mark 'documents' as modified if it's a Mixed type or to ensure save
      ticket.markModified('documents');

      await ticket.save();

      // Repopulate after save to get user details for uploadedBy
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
        });

      res.json(finalTicket);
    } catch (error) {
       console.error( // Assuming logger might not be defined here, use console.error
        "Error uploading document for ticket",
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

// DELETE a document from a ticket
router.delete("/:id/documents", auth, async (req, res) => {
  const { documentType, documentPath } = req.body; // documentPath is the filename stored in DB, relative to 'uploads/<ticketId>/'
  const ticketId = req.params.id;

  try {
    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found." });
    }

    // Authorization: Only current assignee or creator (or super-admin)
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
    // Construct full path: uploads/<ticketId>/<documentPath>
    const fullFilePath = path.join(__dirname, "../uploads", ticketId, documentPath);

    if (!ticket.documents) {
        return res.status(404).json({ message: "No documents found for this ticket." });
    }

    if (documentType && documentType !== "other") {
        if (ticket.documents[documentType] && ticket.documents[documentType].path === documentPath) {
            if (fs.existsSync(fullFilePath)) {
                fs.unlinkSync(fullFilePath);
                fileRemoved = true;
            }
            ticket.documents[documentType] = undefined; // Or delete ticket.documents[documentType];
        } else {
            return res.status(404).json({ message: `Document of type ${documentType} with specified path not found.` });
        }
    } else {
      // Handling 'other' documents array
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
            return res.status(404).json({ message: "Document not found in 'other' documents." });
        }
    }
    ticket.markModified('documents');
    await ticket.save();

    // Repopulate after save
    const finalTicket = await Ticket.findById(ticket._id)
      .populate({ path: "currentAssignee", select: "firstname lastname email" })
      .populate({ path: "createdBy", select: "firstname lastname email" })
      // Add all other necessary populates here as in the GET route
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
      });

    res.status(200).json({
      message: "Document deleted successfully.",
      ticket: finalTicket,
      fileRemoved,
    });
  } catch (error) {
    console.error("Error deleting document:", error);
    res.status(500).json({
      message: "Server error while deleting document.",
      details: error.message,
    });
  }
});

router.get("/", auth, async (req, res) => {
  try {
    const query = {
      $or: [{ currentAssignee: req.user.id }, { createdBy: req.user.id }],
    };

    if (req.query.status) {
      query.status = req.query.status;
    }

    if (req.query.companyName) {
      query.companyName = { $regex: req.query.companyName, $options: "i" };
    }

    const tickets = await Ticket.find(query)
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
      .sort({ createdAt: -1 });

    res.json(tickets);
  } catch (error) {
    console.error("Error fetching tickets:", error);
    res.status(500).json({ error: "Failed to fetch tickets" });
  }
});

// Route to transfer a ticket
router.post("/:id/transfer", auth, ticketController.transferTicket);
module.exports = router;
