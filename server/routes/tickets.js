const express = require("express");
const router = express.Router();
const Ticket = require("../models/opentickets");
const auth = require("../middleware/auth");
const multer = require("multer");
const path = require("path");
const User = require("../models/users");
const ticketController = require("../controllers/ticketController");
const authMiddleware = require("../middleware/auth");

// Configure file upload storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}${ext}`);
  },
});

router.get("/next-number", auth, async (req, res) => {
  try {
    // Get next globally unique sequence number for tickets
    const nextNumber = await getNextSequence("ticketNumber");

    // Format with leading zeros (6 digits) and a T prefix
    const nextTicketNumber = `T-${String(nextNumber).padStart(6, "0")}`;
    res.json({ nextTicketNumber });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

const upload = multer({ storage });

// Create new ticket (protected route)
router.post("/", auth, async (req, res) => {
  try {
    const ticketData = req.body;

    ticketData.createdBy = req.user.id;

    // If assignedTo is not provided, default it to the creator.
    if (!ticketData.assignedTo) {
      ticketData.assignedTo = req.user.id;
    }
    // currentAssignee is initialized based on assignedTo (which could be the creator).
    ticketData.currentAssignee = ticketData.assignedTo;


    ticketData.statusHistory = [
      {
        status: ticketData.status || "Quotation Sent",
        changedAt: new Date(),
        changedBy: req.user.id,
      },
    ];
    ticketData.assignmentLog = [{
        assignedTo: ticketData.currentAssignee,
        assignedBy: req.user.id, // The creator is performing this initial assignment
        action: 'created',
        assignedAt: new Date()
      },
    ];

    const ticket = new Ticket(ticketData);
    await ticket.save();

    // Add ticket to creator's tickets array
    await User.findByIdAndUpdate(req.user.id, {
      $addToSet: { tickets: ticket._id },
    });

    // If assignedTo is different from creator, add to that user's tickets array as well.
    // The $addToSet in the creator's update handles the case where assignedTo is the creator.
    if (ticketData.assignedTo && ticketData.assignedTo.toString() !== req.user.id.toString()) {
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

// Get single ticket (protected route) - only tickets assigned to or created by the user
router.get("/:id", auth, async (req, res) => {
  try {
    const ticket = await Ticket.findOne({
      _id: req.params.id,
      $or: [{ currentAssignee: req.user.id }, { createdBy: req.user.id }],
    });

    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    res.json(ticket);
  } catch (error) {
    console.error("Error fetching ticket:", error);
    res.status(500).json({ error: "Failed to fetch ticket" });
  }
});

// Update ticket (protected route) - only tickets assigned to or created by the user
router.put("/:id", auth, async (req, res) => {
  try {
    const ticket = await Ticket.findOneAndUpdate(
      {
        _id: req.params.id,
        currentAssignee: req.user.id, // Only current assignee can update
      },
      req.body,
      { new: true, runValidators: true }
    );

    if (!ticket) {
      return res
        .status(404)
        .json({
          error: "Ticket not found or you are not the current assignee to update it.",
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

// Delete ticket (protected route) - only tickets created by the user
router.delete("/:id", auth, async (req, res) => {
  try {
    const ticket = await Ticket.findOneAndDelete({
      _id: req.params.id,
      createdBy: req.user.id, // Only the creator can delete
    });

    if (!ticket) {
      return res
        .status(404)
        .json({
          error: "Ticket not found or you don't have permission to delete it",
        });
    }

    // Remove ticket from user's tickets array
    await User.findByIdAndUpdate(req.user.id, {
      $pull: { tickets: ticket._id },
    });

    // If assigned to someone, also remove from their array
    if (
      ticket.currentAssignee && // Check currentAssignee instead of initial assignedTo
      ticket.currentAssignee.toString() !== req.user.id.toString()
    ) {
      await User.findByIdAndUpdate(ticket.assignedTo, {
        $pull: { tickets: ticket._id },
      });
    }

    res.json({ message: "Ticket deleted successfully" });
  } catch (error) {
    console.error("Error deleting ticket:", error);
    res.status(500).json({ error: "Failed to delete ticket" });
  }
});

// Upload document (protected route) - only for tickets assigned to or created by the user
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

      if (
        ![
          "quotation",
          "po",
          "pi",
          "challan",
          "packingList",
          "feedback",
        ].includes(documentType)
      ) {
        return res.status(400).json({ error: "Invalid document type" });
      }

      const update = {};
      update[`documents.${documentType}`] = `/uploads/${req.file.filename}`;

      const updatedTicket = await Ticket.findOneAndUpdate(
        {
          _id: req.params.id,
          currentAssignee: req.user.id, // Only current assignee can upload documents
        },
        { $set: update },
        { new: true }
      );

      if (!updatedTicket) {
        return res
          .status(404)
          .json({
            error: "Ticket not found or you are not the current assignee to upload documents.",
          });
      }

      res.json(updatedTicket);
    } catch (error) {
      console.error("Error uploading document:", error);
      res
        .status(500)
        .json({ error: "Error uploading document", details: error.message });
    }
  }
);

// Get all tickets (protected route) - only tickets assigned to or created by the user
router.get("/", auth, async (req, res) => {
  try {
    // Show tickets created by the user OR currently assigned to the user
    const query = {
      $or: [{ currentAssignee: req.user.id }, { createdBy: req.user.id }],
    };

    // Add any additional filters from request
    if (req.query.status) {
      query.status = req.query.status;
    }

    if (req.query.companyName) {
      query.companyName = { $regex: req.query.companyName, $options: "i" };
    }

    // Populate fields as requested by frontend or default to necessary ones
    let ticketsQuery = Ticket.find(query)
      .populate({ path: "currentAssignee", select: "firstname lastname email" })
      .populate({ path: "createdBy", select: "firstname lastname email" })
      .populate({ path: "transferHistory.from", select: "firstname lastname email" })
      .populate({ path: "transferHistory.to", select: "firstname lastname email" })
      .populate({ path: "transferHistory.transferredBy", select: "firstname lastname email" })
      .sort({ createdAt: -1 });

    const tickets = await ticketsQuery.exec();
    res.json(tickets);
  } catch (error) {
    console.error("Error fetching tickets:", error);
    res.status(500).json({ error: "Failed to fetch tickets" });
  }
});

router.post("/:id/transfer", auth, async (req, res) => {
  try {
    const { userId, note } = req.body;

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }
    // Permission check: Only the current assignee can transfer the ticket
    // Or, if you want creator to also be able to transfer, adjust this logic.
    if (ticket.currentAssignee.toString() !== req.user.id.toString()) {
      return res.status(403).json({ message: "Forbidden: Only the current assignee can transfer this ticket." });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Add to transfer history
    ticket.transferHistory.push({
      from: ticket.currentAssignee,
      to: userId,
      transferredBy: req.user.id,
      note: note || "",
    });

    // Add to assignment log
    ticket.assignmentLog.push({
      assignedTo: userId,
      assignedBy: req.user.id,
      action: "transferred",
    });

    // Update current assignee
    ticket.currentAssignee = userId;

    await ticket.save();


    const populatedTicket = await Ticket.findById(ticket._id)
      .populate("currentAssignee", "firstname lastname email")
      .populate(
        "transferHistory.from transferHistory.to transferHistory.transferredBy",
        "firstname lastname email"
      );

    res.status(200).json({
      ticket: populatedTicket,
      currentAssignee: {
        _id: user._id,
        firstname: user.firstname,
        lastname: user.lastname,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Error transferring ticket:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.get(
  "/next-number",
  authMiddleware,
  ticketController.generateTicketNumber
);
router.get(
  "/check/:quotationNumber",
  authMiddleware,
  ticketController.checkExistingTicket
);

module.exports = router;
