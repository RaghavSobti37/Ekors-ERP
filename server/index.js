const express = require('express');
require("dotenv").config(); 
const connectDB = require('./db.js');
const cors = require('cors');
const bcrypt = require('bcrypt');
const path = require('path');
const morgan = require('morgan'); // HTTP request logger
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid'); // For unique file names
const userModel = require('./models/users.js');
const OpenticketModel = require('./models/opentickets.js');
require("dotenv").config(); // Make sure this is at the top before any usage

// Routes
const authRoutes = require("./routes/authRoutes");
const quotationRoutes = require('./routes/quotations.js');
const logtimeRoutes = require('./routes/logTimeRoutes.js');
const itemRoutes = require('./routes/itemlistRoutes.js');
const challanRoutes = require('./routes/challanRoutes.js');
const initRouter = require('./routes/init');
const userRoutes = require('./routes/userRoutes'); 
const clientRoutes = require('./routes/clients');

// Check if tickets route file exists before requiring it
let ticketsRouter;
try {
  ticketsRouter = require('./routes/tickets');
} catch (error) {
  console.error('Error loading tickets router:', error.message);
  // Create a simple placeholder router if the file doesn't exist
  ticketsRouter = express.Router();
}

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
// app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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

    // Store only the relative path to the file
    const filePath = `uploads/${req.file.filename}`;
    
    const update = {};
    update[`documents.${documentType}`] = filePath;

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

app.get('/uploads/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, 'uploads', filename);
  
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('File not found');
  }
  
  // Determine content type based on file extension
  const ext = path.extname(filename).toLowerCase();
  let contentType = 'application/octet-stream'; // Default
  
  if (ext === '.pdf') {
    contentType = 'application/pdf';
    // For PDFs, set Content-Disposition to inline to encourage viewing rather than downloading
    res.setHeader('Content-Disposition', 'inline; filename="' + filename + '"');
  } else if (ext === '.doc' || ext === '.docx') {
    contentType = 'application/msword';
  } else if (ext === '.xls' || ext === '.xlsx') {
    contentType = 'application/vnd.ms-excel';
  }
  
  res.setHeader('Content-Type', contentType);
  fs.createReadStream(filePath).pipe(res);
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

// Log HTTP requests
app.use(morgan('dev'));

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ----------------------------
// API Route Mounts
app.use('/api/tickets', ticketsRouter); // Use the safely required router
app.use('/api/items', itemRoutes);
app.use('/api/init', initRouter);
app.use('/api/logtime', logtimeRoutes);
app.use('/api/challans', challanRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes); // Mount user routes

// ----------------------------
// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[INFO] Server running on port ${PORT}`);
  console.log(`[DEBUG] JWT_SECRET: ${process.env.JWT_SECRET ? 'set' : 'not set'}`);
});