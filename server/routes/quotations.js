const express = require("express");
const router = express.Router();
const Quotation = require("../models/quotation");
const Client = require("../models/client");
const auth = require("../middleware/auth");

// Create or update quotation
const handleQuotationUpsert = async (req, res) => {
  try {
    const { client, ...quotationData } = req.body;
    const { id } = req.params;

    // Validate required fields
    if (!quotationData.referenceNumber || !client?.email) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Check reference number uniqueness for this user
    const refCheck = await Quotation.findOne({
      user: req.user._id,
      referenceNumber: quotationData.referenceNumber,
      ...(id && { _id: { $ne: id } }),
    });

    if (refCheck) {
      return res
        .status(400)
        .json({ message: "Reference number already exists" });
    }

    let savedClient;
    if (client && client._id) {
      // Client ID is provided, try to find and update it
      savedClient = await Client.findOne({
        _id: client._id,
        user: req.user._id,
      });
      if (!savedClient) {
        // Client with this ID not found for this user. This could be an error or stale ID.
        // As a robust fallback, try to find by email for this user.
        savedClient = await Client.findOne({
          email: client.email,
          user: req.user._id,
        });
        if (savedClient) {
          // Found by email, update it with data possibly including a new _id if frontend sent one by mistake
          savedClient = await Client.findByIdAndUpdate(
            savedClient._id,
            { ...client, user: req.user._id },
            { new: true }
          );
        } else {
          // Still not found by email, and original ID was invalid.
          // Treat as new client creation if all details are present.
          if (
            !client.companyName ||
            !client.gstNumber ||
            !client.email ||
            !client.phone
          ) {
            return res.status(400).json({
              message:
                "Client details are incomplete for new client creation within quotation.",
            });
          }
          const { _id, ...clientDataWithoutId } = client;
          savedClient = new Client({
            ...clientDataWithoutId,
            user: req.user._id,
          }); // Create new, ignoring potentially invalid _id from input
          await savedClient.save();
        }
      } else {
        // Client found by ID, update it with the provided client data
        savedClient = await Client.findByIdAndUpdate(
          client._id,
          { ...client, user: req.user._id },
          { new: true }
        );
      }
    } else if (client && client.email) {
      // No client ID provided, try to find by email for this user
      savedClient = await Client.findOne({
        email: client.email,
        user: req.user._id,
      });
      if (savedClient) {
        // Found by email, update it
        savedClient = await Client.findByIdAndUpdate(
          savedClient._id,
          { ...client, user: req.user._id },
          { new: true }
        );
      } else {
        // Not found by email, create new client
        if (
          !client.companyName ||
          !client.gstNumber ||
          !client.email ||
          !client.phone
        ) {
          return res.status(400).json({
            message: "Client details are incomplete for new client creation.",
          });
        }
        savedClient = new Client({ ...client, user: req.user._id });
        await savedClient.save();
      }
    } else {
      return res
        .status(400)
        .json({ message: "Client information is missing or invalid." });
    }

    if (client.gstNumber) {
      const gstCheck = await Client.findOne({
        gstNumber: { $regex: new RegExp(`^${client.gstNumber}$`, "i") },
        user: req.user._id,
        _id: { $ne: savedClient?._id }, // Exclude current client during updates
      });

      if (gstCheck) {
        return res.status(400).json({
          message: "GST Number already exists",
          field: "gstNumber",
        });
      }
    }

    // Prepare quotation data
    const data = {
      ...quotationData,
      user: req.user._id,
      date: new Date(quotationData.date),
      validityDate: new Date(quotationData.validityDate),
      client: savedClient._id,
    };

    let quotation;
    if (id) {
      quotation = await Quotation.findOneAndUpdate(
        { _id: id, user: req.user._id },
        data,
        { new: true }
      );
    } else {
      quotation = new Quotation(data);
      await quotation.save();
    }

    const populated = await Quotation.findById(quotation._id)
      .populate("client")
      .populate("user", "name email")
      .populate("orderIssuedBy", "firstname lastname");

    if (populated && savedClient) {
      try {
        await Client.findByIdAndUpdate(
          savedClient._id,
          { $addToSet: { quotations: populated._id } },
          { new: true }
        );
      } catch (clientUpdateError) {
        console.error(
          "Error updating client with quotation ID:",
          clientUpdateError
        );
        // Log this error, but don't let it fail the main quotation creation/update response
      }
    }
    res.status(id ? 200 : 201).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

router.get("/next-number", auth, async (req, res) => {
  try {
    // Get next globally unique sequence number
    const nextNumber = await getNextSequence("quotationNumber");

    // Format with leading zeros (6 digits)
    const nextQuotationNumber = `Q-${String(nextNumber).padStart(6, "0")}`;
    res.json({ nextQuotationNumber });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Replace the existing GET /quotations route with this:
router.get("/", auth, async (req, res) => {
  try {
    let query = {};

    // For non-superadmin users, only show their own quotations
    if (req.user.role !== "super-admin") {
      query.user = req.user._id;
    }

    // Handle status filter if provided
    if (req.query.status) {
      query.status = req.query.status;
    }

    const quotations = await Quotation.find(query)
      .populate("client")
      .populate("user", "firstname lastname")
      .sort({ date: -1 });

    res.json(quotations);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching quotations",
      error: error.message,
    });
  }
});

// Create new quotation
router.post("/", auth, handleQuotationUpsert);

// Update quotation
router.put("/:id", auth, handleQuotationUpsert);

// Check reference number availability
router.get("/check-reference", auth, async (req, res) => {
  try {
    const { referenceNumber, excludeId } = req.query;
    const query = {
      user: req.user._id,
      referenceNumber,
    };

    if (excludeId) {
      query._id = { $ne: excludeId };
    }

    const existing = await Quotation.findOne(query);
    res.json({ exists: !!existing });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get single quotation
router.get("/:id", auth, async (req, res) => {
  try {
    const quotation = await Quotation.findOne({
      _id: req.params.id,
      user: req.user._id,
    })
      .populate("client")
      .populate("orderIssuedBy", "firstname lastname");

    if (!quotation) {
      return res.status(404).json({ message: "Quotation not found" });
    }

    res.json(quotation);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Replace the existing DELETE route with this:
router.delete("/:id", auth, async (req, res) => {
  try {
    // Only superadmin can delete quotations
    if (req.user.role !== "super-admin") {
      return res
        .status(403)
        .json({ message: "Only superadmin can delete quotations" });
    }

    const quotation = await Quotation.findOneAndDelete({
      _id: req.params.id,
    });

    if (!quotation) {
      return res.status(404).json({ message: "Quotation not found" });
    }

    // If quotation had a client, remove this quotation from that client's list
    if (quotation.client) {
      try {
        await Client.findByIdAndUpdate(quotation.client, {
          $pull: { quotations: quotation._id },
        });
      } catch (clientUpdateError) {
        console.error(
          "Error removing quotation from client's list during delete:",
          clientUpdateError
        );
      }
    }

    res.json({ message: "Quotation deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/next-number", auth, async (req, res) => {
  try {
    // Find the latest quotation across ALL users (globally unique)
    const latestQuotation = await Quotation.findOne({})
      .sort({ referenceNumber: -1 })
      .select("referenceNumber");

    let nextNumber = 1;

    if (latestQuotation) {
      // Extract number from format like "Q-000001"
      const match = latestQuotation.referenceNumber.match(/Q-(\d+)/);
      if (match && match[1]) {
        nextNumber = parseInt(match[1]) + 1;
      }
    }

    const nextQuotationNumber = `Q-${String(nextNumber).padStart(6, "0")}`;
    res.json({ nextQuotationNumber });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
