const express = require('express');
const router = express.Router();
const LogTime = require('../models/LogTime');
const auth = require('../middleware/auth');

// Add this utility function at the top of the file
const hasTimeOverlap = (logs) => {
  // Convert all times to minutes since midnight for comparison
  const timeRanges = logs.map(log => {
    const [startH, startM] = log.start.split(':').map(Number);
    const [endH, endM] = log.finish.split(':').map(Number);
    return {
      start: startH * 60 + startM,
      end: endH * 60 + endM,
      task: log.task
    };
  });

  // Check for overlaps
  for (let i = 0; i < timeRanges.length; i++) {
    for (let j = i + 1; j < timeRanges.length; j++) {
      const a = timeRanges[i];
      const b = timeRanges[j];
      if (a.start < b.end && b.start < a.end) {
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

// Update the POST route to include validation
router.post('/', auth, async (req, res) => {
  const { logs, date } = req.body;
  if (!logs || !date) {
    return res.status(400).json({ error: 'Missing logs or date' });
  }

  try {
    // Validate for time overlaps in the new logs
    const overlapCheck = hasTimeOverlap(logs);
    if (overlapCheck.hasOverlap) {
      return res.status(400).json({ 
        error: `Time overlap detected between "${overlapCheck.task1}" and "${overlapCheck.task2}"`
      });
    }

    let existing = await LogTime.findOne({ date, user: req.user._id });
    
    if (existing) {
      // Check for overlaps between new logs and existing logs
      const allLogs = [...existing.logs, ...logs];
      const fullOverlapCheck = hasTimeOverlap(allLogs);
      if (fullOverlapCheck.hasOverlap) {
        return res.status(400).json({ 
          error: `Time overlap detected between "${fullOverlapCheck.task1}" and "${fullOverlapCheck.task2}"`
        });
      }

      // Add only non-duplicate logs
      const newLogs = logs.filter(newLog => 
        !existing.logs.some(existingLog => 
          existingLog.task === newLog.task && 
          existingLog.start === newLog.start && 
          existingLog.finish === newLog.finish
        )
      );
      
      existing.logs = [...existing.logs, ...newLogs];
      await existing.save();
      return res.json({ 
        message: 'Logs added', 
        logs: existing.logs.sort((a, b) => a.start.localeCompare(b.start))
      });
    }

    const newLog = new LogTime({ 
      date, 
      logs: logs.sort((a, b) => a.start.localeCompare(b.start)),
      user: req.user._id 
    });
    await newLog.save();
    res.status(201).json({ 
      message: 'Logs saved', 
      logs: newLog.logs 
    });
  } catch (err) {
    console.error('Error saving logs:', err);
    res.status(500).json({ error: 'Error saving logs' });
  }
});

// Update the GET endpoints to return sorted logs
router.get('/today', auth, async (req, res) => {
  try {
    const today = new Date();
    const formattedDate = today.toISOString().split('T')[0];
    
    const entries = await LogTime.find({ 
      user: req.user._id,
      $or: [
        { date: formattedDate },
        { date: { $regex: new RegExp(today.getDate() + '-', 'i')}}
      ]
    });

    const allLogs = entries.reduce((acc, entry) => [...acc, ...entry.logs], []);
    
    res.json({ 
      logs: allLogs.sort((a, b) => a.start.localeCompare(b.start))
    });
  } catch (err) {
    console.error('Error fetching logs:', err);
    res.status(500).json({ error: 'Error fetching logs' });
  }
});

router.get('/all', auth, async (req, res) => {
  try {
    const allLogs = await LogTime.find({ user: req.user._id })
      .sort({ date: -1 })
      .lean();
    
    // Sort logs within each entry by start time
    const sorted = allLogs.map(entry => ({
      ...entry,
      logs: entry.logs.sort((a, b) => a.start.localeCompare(b.start))
    }));
    
    res.json(sorted);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching history' });
  }
});

module.exports = router;
