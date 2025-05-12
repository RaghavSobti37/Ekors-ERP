const User = require("../models/User");
const asyncHandler = require("express-async-handler");
const { generateToken } = require("../utils/auth");

// @desc    Get all users
// @route   GET /api/users
// @access  Private/SuperAdmin
exports.getAllUsers = asyncHandler(async (req, res) => {
    // Only super-admin can access all users
    if (req.user.role !== 'super-admin') {
        return res.status(403).json({ 
            success: false,
            error: 'Unauthorized access. Only super-admins can view all users.' 
        });
    }
    
    const users = await User.find({}).select('-password -__v');
    res.status(200).json({
        success: true,
        count: users.length,
        data: users
    });
});

// @desc    Register new user
// @route   POST /api/users/register
// @access  Private/SuperAdmin
exports.registerUser = asyncHandler(async (req, res) => {
    const { firstname, lastname, email, phone, role, password } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
        return res.status(400).json({
            success: false,
            error: 'User already exists with this email'
        });
    }

    // Create user
    const user = await User.create({
        firstname,
        lastname,
        email,
        phone,
        role,
        password
    });

    if (user) {
        res.status(201).json({
            success: true,
            data: {
                _id: user._id,
                firstname: user.firstname,
                lastname: user.lastname,
                email: user.email,
                phone: user.phone,
                role: user.role,
                createdAt: user.createdAt
            },
            message: "User registered successfully"
        });
    } else {
        res.status(400).json({
            success: false,
            error: "Invalid user data"
        });
    }
});

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private/SuperAdmin
exports.updateUser = asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);

    if (!user) {
        return res.status(404).json({
            success: false,
            error: 'User not found'
        });
    }

    // Only super-admin can update users
    if (req.user.role !== 'super-admin') {
        return res.status(403).json({
            success: false,
            error: 'Not authorized to update users'
        });
    }

    // Prevent changing super-admin role unless it's yourself
    if (user.role === 'super-admin' && req.user._id.toString() !== user._id.toString()) {
        return res.status(403).json({
            success: false,
            error: 'Cannot edit super-admin details'
        });
    }

    user.firstname = req.body.firstname || user.firstname;
    user.lastname = req.body.lastname || user.lastname;
    user.email = req.body.email || user.email;
    user.phone = req.body.phone || user.phone;
    user.role = req.body.role || user.role;

    const updatedUser = await user.save();

    res.status(200).json({
        success: true,
        data: {
            _id: updatedUser._id,
            firstname: updatedUser.firstname,
            lastname: updatedUser.lastname,
            email: updatedUser.email,
            phone: updatedUser.phone,
            role: updatedUser.role,
            createdAt: updatedUser.createdAt,
            updatedAt: updatedUser.updatedAt
        },
        message: "User updated successfully"
    });
});

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private/SuperAdmin
exports.deleteUser = asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);

    if (!user) {
        return res.status(404).json({
            success: false,
            error: 'User not found'
        });
    }

    // Only super-admin can delete users
    if (req.user.role !== 'super-admin') {
        return res.status(403).json({
            success: false,
            error: 'Not authorized to delete users'
        });
    }

    // Prevent deleting super-admin
    if (user.role === 'super-admin') {
        return res.status(403).json({
            success: false,
            error: 'Cannot delete super-admin'
        });
    }

    await user.remove();

    res.status(200).json({
        success: true,
        data: {},
        message: 'User deleted successfully'
    });
});

// @desc    Get single user
// @route   GET /api/users/:id
// @access  Private/SuperAdmin
exports.getUser = asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id).select('-password -__v');

    if (!user) {
        return res.status(404).json({
            success: false,
            error: 'User not found'
        });
    }

    // Only super-admin can access user details
    if (req.user.role !== 'super-admin') {
        return res.status(403).json({
            success: false,
            error: 'Not authorized to view user details'
        });
    }

    res.status(200).json({
        success: true,
        data: user
    });
});