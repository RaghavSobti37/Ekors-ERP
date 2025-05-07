const Challan = require("../models/challan");

// Create or Submit Challan
exports.createChallan = async (req, res) => {
  try {
    const { companyName, phone, email, totalBilling, billNumber } = req.body;
    const challanData = {
      companyName,
      phone,
      email,
      totalBilling,
      billNumber,
    };

    if (req.file) {
      challanData.document = {
        data: req.file.buffer,
        contentType: req.file.mimetype,
        originalName: req.file.originalname,
      };
    }

    const newChallan = new Challan(challanData);
    await newChallan.save();

    res.status(201).json(newChallan);
  } catch (err) {
    console.error("Error creating challan:", err);
    res.status(500).json({ error: "Failed to create challan" });
  }
};

// Get All Challans
exports.getAllChallans = async (req, res) => {
  try {
    const challans = await Challan.find().select("-document");
    res.json(challans);
  } catch (err) {
    console.error("Error fetching challans:", err);
    res.status(500).json({ error: "Failed to fetch challans" });
  }
};

// Get Single Challan
exports.getChallanById = async (req, res) => {
  try {
    const challan = await Challan.findById(req.params.id).select("-document.data");
    if (!challan) return res.status(404).json({ error: "Challan not found" });
    res.json(challan);
  } catch (err) {
    console.error("Error fetching challan:", err);
    res.status(500).json({ error: "Failed to fetch challan" });
  }
};

// Get Document Preview
exports.getDocument = async (req, res) => {
  try {
    const challan = await Challan.findById(req.params.id);
    if (!challan || !challan.document || !challan.document.data) {
      return res.status(404).json({ error: "Document not found" });
    }

    res.set("Content-Type", challan.document.contentType);
    res.send(challan.document.data);
  } catch (err) {
    console.error("Error retrieving document:", err);
    res.status(500).json({ error: "Failed to retrieve document" });
  }
};

// Update Challan
exports.updateChallan = async (req, res) => {
  try {
    const { companyName, phone, email, totalBilling, billNumber } = req.body;

    const updateData = {
      companyName,
      phone,
      email,
      totalBilling,
      billNumber,
    };

    if (req.file) {
      updateData.document = {
        data: req.file.buffer,
        contentType: req.file.mimetype,
        originalName: req.file.originalname,
      };
    }

    const updated = await Challan.findByIdAndUpdate(req.params.id, updateData, { new: true });
    res.json(updated);
  } catch (err) {
    console.error("Error updating challan:", err);
    res.status(500).json({ error: "Failed to update challan" });
  }
};
