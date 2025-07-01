const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth'); 
const UniversalBackup = require('../models/universalBackup');
const logger = require('../logger');
const { listBackups, getBackupDetails, restoreBackup } = require('../controllers/backupController');

// All backup routes should be super-admin only
router.use(auth);

// GET /api/backups - List all backup entries
router.get('/', listBackups);

// GET /api/backups/:id - Get details of a single backup entry
router.get('/:id', getBackupDetails);

// POST /api/backups/:id/restore - Restore a backup entry
router.post('/:id/restore', restoreBackup);

// DELETE /api/backups/clear-all - Clear all backups (super-admin only)
router.delete('/clear-all', async (req, res) => {
  if (req.user.role !== "super-admin") {
    return res.status(403).json({ error: "Forbidden" });
  }
  try {
    const result = await UniversalBackup.clearAll();
    // Defensive: handle null/undefined or different result shapes
    const deletedCount = result?.deletedCount ?? result?.n ?? 0;
    logger.log({
      user: req.user,
      page: "Backup",
      action: "Clear All Backups",
      api: req.originalUrl,
      req,
      message: `All UniversalBackup entries cleared by ${req.user.email}`,
      details: { deletedCount },
      level: "warn"
    });
    res.json({ success: true, deletedCount });
  } catch (error) {
    logger.log({
      user: req.user,
      page: "Backup",
      action: "Clear All Backups Error",
      api: req.originalUrl,
      req,
      message: "Failed to clear UniversalBackup entries",
      details: { error: error.message },
      level: "error"
    });
    res.status(500).json({ error: "Failed to clear backups" });
  }
});

module.exports = router;
