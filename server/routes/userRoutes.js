const express = require('express');
const bcrypt = require('bcrypt');
const User = require('../models/users');
const auth = require('../middleware/auth');
const { check, validationResult } = require('express-validator');

const router = express.Router();

// Middleware to check for super-admin role
const requireSuperAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'super-admin') {
        next();
    } else {
        res.status(403).json({ error: 'Forbidden: Super-admin access required' });
    }
};

// GET /api/users - Fetch all users (Super-admin only)
router.get('/', auth, requireSuperAdmin, async (req, res) => {
    try {
        const users = await User.find().select('-password -__v'); // Exclude password and __v
        res.json(users);
    } catch (err) {
        console.error('Error fetching users:', err);
        res.status(500).json({ error: 'Server error while fetching users' });
    }
});

// POST /api/users - Create a new user (Super-admin only)
router.post(
    '/',
    auth,
    requireSuperAdmin,
    [
        check('firstname', 'First name is required').not().isEmpty(),
        check('lastname', 'Last name is required').not().isEmpty(),
        check('email', 'Please include a valid email').isEmail(),
        check('password', 'Password is required and must be at least 5 characters').isLength({ min: 5 }),
        check('role', 'Role is required').isIn(['user', 'admin', 'super-admin']),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { firstname, lastname, email, phone, role, password } = req.body;

        try {
            let user = await User.findOne({ email });
            if (user) {
                return res.status(400).json({ error: 'User already exists with this email' });
            }

            user = new User({
                firstname,
                lastname,
                email,
                phone,
                role,
                password,
                isActive: true // Make sure this is set
            });

            await user.save();

            // Don't send back password hash
            const userResponse = user.toObject();
            delete userResponse.password;
            delete userResponse.__v;

            res.status(201).json(userResponse);
        } catch (err) {
            console.error('Error creating user:', err);
            res.status(500).json({ error: 'Server error while creating user' });
        }
    }
);
// PUT /api/users/:id - Update a user (Super-admin only)
router.put(
    '/:id',
    auth,
    requireSuperAdmin,
    [
        check('firstname', 'First name is required').optional({ checkFalsy: true }).not().isEmpty(),
        check('lastname', 'Last name is required').optional({ checkFalsy: true }).not().isEmpty(),
        check('role', 'Role is required').optional().isIn(['user', 'admin', 'super-admin']),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { firstname, lastname, phone, role, password } = req.body;
        const userIdToUpdate = req.params.id;

        try {
            let userToUpdate = await User.findById(userIdToUpdate);
            if (!userToUpdate) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Prevent super-admin from being demoted if they are the only one
            if (userToUpdate.role === 'super-admin' && role && role !== 'super-admin') {
                const superAdminCount = await User.countDocuments({ role: 'super-admin' });
                if (superAdminCount <= 1 && userToUpdate._id.toString() === req.user.id) { // Check if it's the same user and last SA
                     return res.status(400).json({ error: 'Cannot demote the last super-admin.' });
                }
                 if (superAdminCount <= 1 && userToUpdate.role === 'super-admin' && role !== 'super-admin'){
                    return res.status(400).json({ error: 'Cannot demote the only super-admin.' });
                }
            }
            
            // Only a super-admin can assign/change to super-admin role
            if (role === 'super-admin' && req.user.role !== 'super-admin') {
                 return res.status(403).json({ error: 'Forbidden: Only super-admins can assign super-admin role.' });
            }

            const updateFields = {};
            if (firstname) updateFields.firstname = firstname;
            if (lastname) updateFields.lastname = lastname;
            if (phone !== undefined) updateFields.phone = phone;
            if (role) updateFields.role = role;


            const updatedUser = await User.findByIdAndUpdate(
                userIdToUpdate,
                { $set: updateFields },
                { new: true }
            ).select('-password -__v');

            res.json(updatedUser);
        } catch (err) {
            console.error('Error updating user:', err);
            if (err.kind === 'ObjectId') {
                return res.status(400).json({ error: 'Invalid user ID format' });
            }
            res.status(500).json({ error: 'Server error while updating user' });
        }
    }
);

// DELETE /api/users/:id - Delete a user (Super-admin only)
router.delete('/:id', auth, requireSuperAdmin, async (req, res) => {
    const userIdToDelete = req.params.id;

    try {
        const userToDelete = await User.findById(userIdToDelete);
        if (!userToDelete) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (userToDelete.role === 'super-admin') {
            if (req.user.id === userIdToDelete) {
                 return res.status(400).json({ error: 'Super-admin cannot delete themselves.' });
            }
            const superAdminCount = await User.countDocuments({ role: 'super-admin' });
            if (superAdminCount <= 1) {
                return res.status(400).json({ error: 'Cannot delete the last super-admin.' });
            }
        }

        await User.findByIdAndDelete(userIdToDelete);
        res.json({ message: 'User deleted successfully' });

    } catch (err) {
        console.error('Error deleting user:', err);
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ error: 'Invalid user ID format' });
        }
        res.status(500).json({ error: 'Server error while deleting user' });
    }
});

module.exports = router;