const express = require("express");
const router = express.Router();
const Ticket = require("../models/opentickets");
const auth = require("../middleware/auth");
const multer = require("multer");
const path = require("path");
const User = require("../models/users");
const ticketController = require("../controllers/ticketController");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}${ext}`);
  },
});

router.delete('/admin/:id', auth, (req, res, next) => {
  if (req.user.role !== 'super-admin') {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
}, ticketController.adminDeleteTicket);

const upload = multer({ storage });

router.post("/", auth, async (req, res) => {
  try {
    const ticketData = req.body;
    ticketData.createdBy = req.user.id;

    // Rest of your existing code
    if (!ticketData.assignedTo) {
      ticketData.assignedTo = req.user.id;
    }
    ticketData.currentAssignee = ticketData.assignedTo;

    ticketData.statusHistory = [{
      status: ticketData.status || "Quotation Sent",
      changedAt: new Date(),
      changedBy: req.user.id,
    }];

     ticketData.assignmentLog = [{
      assignedTo: ticketData.currentAssignee,
      assignedBy: req.user.id,
      action: 'created',
      assignedAt: new Date()
    }];

    const ticket = new Ticket(ticketData);
    await ticket.save();

     await User.findByIdAndUpdate(req.user.id, {
      $addToSet: { tickets: ticket._id },
    });

    if (ticketData.assignedTo && ticketData.assignedTo.toString() !== req.user.id.toString()) {
      await User.findByIdAndUpdate(ticketData.assignedTo, {
        $addToSet: { tickets: ticket._id },
      });
    }

    res.status(201).json(ticket);

  } catch (error) {
    console.error("Error creating ticket:", error);
    res.status(500).json({ error: "Failed to create ticket", details: error.message });
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

    res.json(ticket);
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
          { $and: [
              { _id: req.params.id },
              { "createdBy.role": "super-admin" }
            ] 
          }
        ]
      },
      req.body,
      { new: true }
    );

    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found or you are not the current assignee to update it." });
    }

    res.json(ticket);
  } catch (error) {
    console.error("Error updating ticket:", error);
    res.status(500).json({ error: "Failed to update ticket", details: error.message });
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

      const validTypes = ["quotation", "po", "pi", "challan", "packingList", "feedback"];
      if (!validTypes.includes(documentType)) {
        return res.status(400).json({ error: "Invalid document type" });
      }

      const update = {};
      update[`documents.${documentType}`] = `/uploads/${req.file.filename}`;

      const updatedTicket = await Ticket.findOneAndUpdate(
        {
          _id: req.params.id,
          currentAssignee: req.user.id,
        },
        { $set: update },
        { new: true }
      );

      if (!updatedTicket) {
        return res.status(404).json({ error: "Ticket not found or you are not the current assignee to upload documents." });
      }

      res.json(updatedTicket);
    } catch (error) {
      logger.error('ticket', `Failed to upload document for Ticket ID: ${req.params.id}`, error, req.user, { documentType });
      res.status(500).json({ error: "Error uploading document", details: error.message });
    }
  }
);

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
      .populate({ path: "transferHistory.from", select: "firstname lastname email" })
      .populate({ path: "transferHistory.to", select: "firstname lastname email" })
      .populate({ path: "transferHistory.transferredBy", select: "firstname lastname email" })
      .sort({ createdAt: -1 });

    res.json(tickets);
  } catch (error) {
    console.error("Error fetching tickets:", error);
    res.status(500).json({ error: "Failed to fetch tickets" });
  }
});

router.post("/:id/transfer", auth, async (req, res) => {
  try {
    const { userId, note } = req.body;
    const currentUser = req.user || null;
    const ticketId = req.params.id;

    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    if (ticket.currentAssignee.toString() !== currentUser.id.toString()) {
      return res.status(403).json({ message: "Forbidden: Only the current assignee can transfer this ticket." });
    }

    const assignedUser = await User.findById(userId);
    if (!assignedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    ticket.transferHistory.push({
      from: ticket.currentAssignee,
      to: userId,
      transferredBy: currentUser.id,
      note: note || "",
      transferredAt: new Date(),
      statusAtTransfer: ticket.status
    });

    ticket.assignmentLog.push({
      assignedTo: userId,
      assignedBy: currentUser.id,
      action: "transferred",
    });

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
        _id: assignedUser._id,
        firstname: assignedUser.firstname,
        lastname: assignedUser.lastname,
        email: assignedUser.email,
      },
    });
  } catch (error) {
    console.error("Error transferring ticket:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;