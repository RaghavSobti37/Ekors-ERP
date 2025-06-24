const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const clientController = require('../controllers/clientController');

// Search clients
router.get('/search', auth, clientController.searchClients);
// Create a new client - Accessible by all authenticated users
router.post('/', auth, clientController.createClient);

// Get all clients for dashboard view (with stats)
// Access controlled within the controller based on role (user sees own, admin/super-admin see all)
router.get('/', auth, clientController.getAllClientsForDashboard);

// Get a single client by ID
// Access controlled within the controller
router.get('/:id', auth, clientController.getClientById);

// Update a client by ID
// Access controlled within the controller (super-admin or owner)
router.put('/:id', auth, clientController.updateClient);

// Delete a client by ID - Access controlled within the controller (super-admin only)
router.delete('/:id', auth, clientController.deleteClient);



module.exports = router;