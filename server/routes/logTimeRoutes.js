const express = require('express');
const router = express.Router();
const LogTime = require('../models/LogTime');
const auth = require('../middleware/auth');

// Utility function for time overlap
const hasTimeOverlap = (logs) => {
  if (!logs || logs.length === 0) return { hasOverlap: false };
  const timeRanges = logs.map(log => {
    const [startH, startM] = log.start.split(':').map(Number);
    const [endH, endM] = log.finish.split(':').map(Number);
    return {
      start: startH * 60 + startM,
      end: endH * 60 + endM,
      task: log.task
    };
  });

  timeRanges.sort((a, b) => a.start - b.start);

  // Check for overlaps
  for (let i = 0; i < timeRanges.length; i++) {
    for (let j = i + 1; j < timeRanges.length; j++) {
      const a = timeRanges[i];
      const b = timeRanges[j];
      if (a.start < b.end && b.start < a.end) {
        // b.start < a.end is the crucial part after sorting
        return {
          hasOverlap: true,
          task1: a.task,
          task2: b.task
        };
      }
    }
  }
  return { hasOverlap: false };
};

// POST route to add/update logs for a specific date
router.post('/', auth, async (req, res) => {
  const { logs, date } = req.body; // date is expected in YYYY-MM-DD format

  if (!logs || !Array.isArray(logs) || !date) {
    return res.status(400).json({ error: 'Missing logs array or date' });
  }
  if (logs.length === 0) {
    // Client should filter this, but as a safeguard:
    return res.status(400).json({ error: 'Logs array cannot be empty if submitting logs.' });
  }

  // Validate date format (YYYY-MM-DD)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Invalid date format. Expected YYYY-MM-DD.' });
  }

  try {
    // Validate for time overlaps in the new logs being submitted
    const newLogsOverlapCheck = hasTimeOverlap(logs);
    if (newLogsOverlapCheck.hasOverlap) {
      return res.status(400).json({ 
        error: `Time overlap detected within your new entries: "${newLogsOverlapCheck.task1}" and "${newLogsOverlapCheck.task2}"`
      });
    }

    let existingLogEntry = await LogTime.findOne({ date, user: req.user._id });
    
    if (existingLogEntry) {
      // Date entry exists. Replace its logs with the new set.
      // The `newLogsOverlapCheck` at the beginning already ensures the incoming `logs` are internally consistent.
      existingLogEntry.logs = logs;
      existingLogEntry.logs.sort((a, b) => a.start.localeCompare(b.start)); // Sort all logs
      await existingLogEntry.save();
      return res.json({ 
        message: 'Logs updated successfully', 
        logs: existingLogEntry.logs
      });
    } else {
      // No entry for this date, create a new one
      const newLogTimeEntry = new LogTime({ 
        date, 
        logs: logs.sort((a, b) => a.start.localeCompare(b.start)),
        user: req.user._id 
      });
      await newLogTimeEntry.save();
      res.status(201).json({ 
        message: 'Logs saved successfully for the new date', 
        logs: newLogTimeEntry.logs 
      });
    }
  } catch (err) {
    console.error('Error saving/updating logs:', err);
    res.status(500).json({ error: 'Server error while saving logs' });
  }
});

// GET logs for a specific date (YYYY-MM-DD)
router.get('/by-date', auth, async (req, res) => {
  const { date } = req.query; // Expecting date in YYYY-MM-DD format

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Invalid or missing date parameter. Expected YYYY-MM-DD.' });
  }

  try {
    const logEntry = await LogTime.findOne({ user: req.user._id, date: date });

    if (!logEntry) {
      // It's not an error if no logs exist for a date, just return empty logs
      return res.json({ date: date, logs: [] });
    }
    
    res.json({ 
      date: logEntry.date,
      logs: logEntry.logs.sort((a, b) => a.start.localeCompare(b.start))
    });
  } catch (err) {
    console.error('Error fetching logs by date:', err);
    res.status(500).json({ error: 'Error fetching logs for the specified date' });
  }
});


// GET logs for "today" (based on server's date)
router.get('/today', auth, async (req, res) => {
  try {
    const today = new Date();
    // Format to YYYY-MM-DD
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
    const day = String(today.getDate()).padStart(2, '0');
    const formattedDate = `${year}-${month}-${day}`;
    
    const entry = await LogTime.findOne({ 
      user: req.user._id,
      date: formattedDate 
    });

    if (!entry) {
      return res.json({ date: formattedDate, logs: [] });
    }
    
    res.json({ 
      date: entry.date,
      logs: entry.logs.sort((a, b) => a.start.localeCompare(b.start))
    });
  } catch (err) {
    console.error('Error fetching today\'s logs:', err);
    res.status(500).json({ error: 'Error fetching today\'s logs' });
  }
});

router.get('/all', auth, async (req, res) => {
  try {
    const allLogs = await LogTime.find({ user: req.user._id })
      .sort({ date: -1 }) // Sort by date descending (most recent first)
      .lean(); // Use .lean() for faster queries if not modifying docs
    
    // Sort logs within each entry by start time
    const sorted = allLogs.map(entry => ({
      ...entry,
      logs: entry.logs.sort((a, b) => a.start.localeCompare(b.start))
    }));
    res.json(sorted);
  } catch (err) {
    console.error('Error fetching log history:', err);
    res.status(500).json({ error: 'Error fetching history' });
  }
});

module.exports = router;
