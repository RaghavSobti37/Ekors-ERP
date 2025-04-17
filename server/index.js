const express = require('express');
require("dotenv").config(); 
console.log("JWT_SECRET is:", process.env.JWT_SECRET);

const connectDB = require('./db.js');
const cors = require('cors');
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid'); // For unique file names
const authRoutes = require("./routes/authRoutes");
const userModel = require('./models/User.js');
const OpenticketModel = require('./models/opentickets.js');


// Routes
const quotationRoutes = require('./routes/quotations.js');
const logtimeRoutes = require('./routes/logTimeRoutes.js');
const itemRoutes = require('./routes/itemlistRoutes.js');
const challanRoutes = require('./routes/challanRoutes.js');
const initRouter = require('./routes/init');

const app = express();
connectDB();

app.use(express.json());
app.use(cors({
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Static file serving
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Multer storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});
const upload = multer({ storage });

// ----------------------------
// Basic route
app.get('/', (req, res) => {
  res.send('API is running');
});

// ----------------------------
// User routes
app.get('/users', async (req, res) => {
  try {
    const response = await userModel.find();
    return res.json({ items: response });
  } catch (err) {
    res.status(500).json({ error: 'Error fetching users' });
  }
});

// ----------------------------
// Ticket routes
app.get('/tickets', async (req, res) => {
  try {
    const tickets = await OpenticketModel.find().sort({ createdAt: -1 });
    res.json(tickets);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching tickets' });
  }
});

app.post('/create-ticket', async (req, res) => {
  try {
    const { companyName, quotationNumber, billingAddress, shippingAddress, goods } = req.body;

    const totalQuantity = goods.reduce((sum, item) => sum + item.quantity, 0);
    const totalAmount = goods.reduce((sum, item) => sum + item.amount, 0);
    const gstAmount = totalAmount * 0.18;
    const grandTotal = totalAmount + gstAmount;

    const newTicket = await OpenticketModel.create({
      companyName,
      quotationNumber,
      billingAddress,
      shippingAddress,
      goods,
      totalQuantity,
      totalAmount,
      gstAmount,
      grandTotal,
      status: "Quotation Sent",
      statusHistory: [{
        status: "Quotation Sent",
        changedAt: new Date()
      }],
      documents: {
        quotation: "",
        po: "",
        pi: "",
        challan: "",
        packingList: "",
        feedback: ""
      }
    });

    res.status(201).json(newTicket);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error creating ticket', details: err.message });
  }
});

app.post('/tickets/:id/documents', upload.single('document'), async (req, res) => {
  try {
    const { documentType } = req.body;
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const update = {};
    update[`documents.${documentType}`] = req.file.path.replace(/\\/g, '/');

    const updatedTicket = await OpenticketModel.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true }
    );

    if (!updatedTicket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    res.json(updatedTicket);
  } catch (err) {
    res.status(500).json({ error: 'Error uploading document' });
  }
});

app.put('/tickets/:id', async (req, res) => {
  try {
    const { _id, __v, createdAt, updatedAt, ...updateData } = req.body;
    
    const updatedTicket = await OpenticketModel.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedTicket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    res.json(updatedTicket);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error updating ticket', message: err.message });
  }
});

// ----------------------------
// API Route Mounts
app.use('/api/items', itemRoutes);
app.use('/api/init', initRouter);
app.use('/api/logtime', logtimeRoutes);
app.use('/api/challans', challanRoutes);
app.use('/api/quotations', quotationRoutes);
app.use(authRoutes);

// ----------------------------
// Start server
app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
