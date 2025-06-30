const express = require('express');
const router = express.Router();
const logger = require('../logger'); // Adjust path if needed

// Unified endpoint for frontend and backend logs
router.post('/log', logger.frontendLogHandler);

module.exports = router;