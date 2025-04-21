require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const connectDB = require('./db');
const auth = require('./middleware/auth');

// Routes
const authRoutes = require('./routes/authRoutes');
const ticketRoutes = require('./routes/tickets');
const logtimeRoutes = require('./routes/logTimeRoutes');
const itemRoutes = require('./routes/itemlistRoutes');
const challanRoutes = require('./routes/challanRoutes');
const quotationRoutes = require('./routes/quotations');
const initRouter = require('./routes/init');

const app = express();
connectDB();

// Middleware
app.use(express.json());
app.use(cors({
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// File upload setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tickets', auth, ticketRoutes);
app.use('/api/items', auth, itemRoutes);
app.use('/api/init', auth, initRouter);
app.use('/api/logtime', auth, logtimeRoutes);
app.use('/api/challans', auth, challanRoutes);
app.use('/api/quotations', auth, quotationRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});