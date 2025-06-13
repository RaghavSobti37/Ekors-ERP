const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const clientController = require('../controllers/clientController');

// Search clients
router.get('/search', auth, clientController.searchClients);
router.post('/', auth, clientController.createOrUpdateClient);


module.exports = router;