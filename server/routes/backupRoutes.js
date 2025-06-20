const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth'); 
const { listBackups, getBackupDetails, restoreBackup } = require('../controllers/backupController');

// All backup routes should be super-admin only
router.use(auth);

// GET /api/backups - List all backup entries
router.get('/', listBackups);

// GET /api/backups/:id - Get details of a single backup entry
router.get('/:id', getBackupDetails);

// POST /api/backups/:id/restore - Restore a backup entry
router.post('/:id/restore', restoreBackup);

module.exports = router;
