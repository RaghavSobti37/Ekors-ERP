const express = require('express');
const router = express.Router();
const LogTime = require('../models/LogTime');
const auth = require('../middleware/auth');

// Save logs (POST) - protected route
router.post('/', auth, async (req, res) => {
  const { logs, date } = req.body;
  if (!logs || !date) {
    return res.status(400).json({ error: 'Missing logs or date' });
  }

  try {
    let existing = await LogTime.findOne({ date, user: req.user._id });
    if (existing) {
      existing.logs = logs;
      await existing.save();
      return res.json({ message: 'Logs updated' });
    }

    const newLog = new LogTime({ 
      date, 
      logs,
      user: req.user._id 
    });
    await newLog.save();
    res.status(201).json({ message: 'Logs saved' });
  } catch (err) {
    console.error('Error saving logs:', err);
    res.status(500).json({ error: 'Error saving logs' });
  }
});

// Fetch today's logs (GET) - protected route
router.get('/today', auth, async (req, res) => {
  const today = new Date();
  const day = String(today.getDate()).padStart(2, "0");
  const month = today.toLocaleString("default", { month: "long" });
  const year = today.getFullYear();
  const formattedDate = `${day}-${month}-${year}`;

  try {
    const entry = await LogTime.findOne({ 
      date: formattedDate,
      user: req.user._id 
    });
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

// Get all logs by user - protected route
router.get('/all', auth, async (req, res) => {
  try {
    const allLogs = await LogTime.find({ user: req.user._id }).sort({ date: -1 });
    res.json(allLogs);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching history' });
  }
});

// Add this new route to get logs by user ID
router.get('/user/:userId', auth, async (req, res) => {
  try {
    if (req.user.role !== 'super-admin' && req.user._id.toString() !== req.params.userId) {
      return res.status(403).json({ error: 'Unauthorized access' });
    }

    const logs = await LogTime.find({ user: req.params.userId })
      .sort({ date: -1 })
      .populate('user', 'firstname lastname');

    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching user logs' });
  }
});

module.exports = router;