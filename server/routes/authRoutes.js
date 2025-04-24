const express = require("express");
const router = express.Router();
const { registerUser, loginUser } = require("../controllers/authController");

router.post("/register", registerUser);
router.post("/login", loginUser);

const User = require('../models/users');
const Ticket = require('../models/opentickets');
const auth = require('../middleware/auth');
const { check, validationResult } = require('express-validator');

// Get all users (only for super-admin)
router.get('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'super-admin') {
      return res.status(403).json({ error: 'Unauthorized access' });
    }
    
    const users = await User.find({}, 'firstname lastname email phone role');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching users' });
  }
});

// Get ticket totals for all users
router.get('/ticket-totals', auth, async (req, res) => {
  try {
    if (req.user.role !== 'super-admin') {
      return res.status(403).json({ error: 'Unauthorized access' });
    }

    const result = await Ticket.aggregate([
      {
        $group: {
          _id: '$createdBy',
          total: { $sum: '$grandTotal' }
        }
      }
    ]);

    const totals = {};
    result.forEach(item => {
      totals[item._id.toString()] = item.total;
    });

    res.json(totals);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching ticket totals' });
  }
});

// Update user role
router.put('/:id/role', [
  auth,
  check('role', 'Role is required').not().isEmpty()
], async (req, res) => {
  try {
    if (req.user.role !== 'super-admin') {
      return res.status(403).json({ error: 'Unauthorized access' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent changing super-admin role
    if (user.role === 'super-admin' && req.user._id.toString() !== user._id.toString()) {
      return res.status(403).json({ error: 'Cannot change super-admin role' });
    }

    user.role = req.body.role;
    await user.save();

    res.json({ message: 'Role updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Error updating role' });
  }
});

// Update user details
router.put('/:id', [
  auth,
  check('firstname', 'First name is required').not().isEmpty(),
  check('lastname', 'Last name is required').not().isEmpty(),
  check('email', 'Please include a valid email').isEmail()
], async (req, res) => {
  try {
    if (req.user.role !== 'super-admin') {
      return res.status(403).json({ error: 'Unauthorized access' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent editing super-admin unless it's yourself
    if (user.role === 'super-admin' && req.user._id.toString() !== user._id.toString()) {
      return res.status(403).json({ error: 'Cannot edit super-admin details' });
    }

    const { firstname, lastname, email, phone } = req.body;
    user.firstname = firstname;
    user.lastname = lastname;
    user.email = email;
    user.phone = phone;

    await user.save();

    res.json(user);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    res.status(500).json({ error: 'Error updating user' });
  }
});

// Delete user
router.delete('/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'super-admin') {
      return res.status(403).json({ error: 'Unauthorized access' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent deleting super-admin
    if (user.role === 'super-admin') {
      return res.status(403).json({ error: 'Cannot delete super-admin' });
    }

    // Check if user has any tickets
    const tickets = await Ticket.countDocuments({ createdBy: user._id });
    if (tickets > 0) {
      return res.status(400).json({ error: 'Cannot delete user with associated tickets' });
    }

    await user.remove();
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Error deleting user' });
  }
});

module.exports = router;

module.exports = router;
