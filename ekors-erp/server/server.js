require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const os = require('os');

const app = express();

// Middleware
app.use(express.json());

// Database Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

// Routes
app.get('/', (req, res) => {
  res.json({ status: 'Ekors ERP API running' });
});

// Start Server
const PORT = process.env.PORT || 5000;
const LOCALHOST = `http://localhost:${PORT}`;

app.listen(PORT, () => {
  console.log(`
  ✅ Server running on: ${LOCALHOST}
  
  Press CTRL+C to stop
  `);
});