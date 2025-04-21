const express = require('express');
require("dotenv").config(); 
console.log("JWT_SECRET is:", process.env.JWT_SECRET);

require("dotenv").config(); 
const connectDB = require('./db.js');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Routes
const authRoutes = require("./routes/authRoutes");
const ticketRoutes = require('./routes/tickets');
const quotationRoutes = require('./routes/quotations');
const logtimeRoutes = require('./routes/logTimeRoutes');
const itemRoutes = require('./routes/itemlistRoutes');
const challanRoutes = require('./routes/challanRoutes');
const initRouter = require('./routes/init');

const app = express();
connectDB();

// Middleware
app.use(express.json());
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(uploadDir));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/init', initRouter);
app.use('/api/logtime', logtimeRoutes);
app.use('/api/challans', challanRoutes);
app.use('/api/quotations', quotationRoutes);

// Health check
app.get('/', (req, res) => {
  res.send('API is running');
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});