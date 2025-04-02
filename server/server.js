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