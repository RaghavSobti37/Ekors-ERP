// routes/logTimeRoutes.js
const express = require('express');
const router = express.Router();
const LogTime = require('../models/LogTime');

// Save logs (POST)
router.post('/', async (req, res) => {
  const { logs, date } = req.body;
  if (!logs || !date) {
    return res.status(400).json({ error: 'Missing logs or date' });
  }

  try {
    let existing = await LogTime.findOne({ date });
    if (existing) {
      existing.logs = logs;
      await existing.save();
      return res.json({ message: 'Logs updated' });
    }

    const newLog = new LogTime({ date, logs });
    await newLog.save();
    res.status(201).json({ message: 'Logs saved' });
  } catch (err) {
    console.error('Error saving logs:', err);
    res.status(500).json({ error: 'Error saving logs' });
  }
});

// Fetch today's logs (GET)
router.get('/today', async (req, res) => {
  const today = new Date();
  const day = String(today.getDate()).padStart(2, "0");
  const month = today.toLocaleString("default", { month: "long" });
  const year = today.getFullYear();
  const formattedDate = `${day}-${month}-${year}`;

  try {
    const entry = await LogTime.findOne({ date: formattedDate });
    if (entry) {
      res.json({ logs: entry.logs });
    } else {
      res.json({ logs: [] });
    }
  } catch (err) {
    console.error('Error fetching logs:', err);
    res.status(500).json({ error: 'Error fetching logs' });
  }
});

module.exports = router;
