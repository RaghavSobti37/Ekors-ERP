const User = require("../models/users");
const asyncHandler = require("express-async-handler");

// @desc    Get all users
// @route   GET /api/users
// @access  Private/SuperAdmin
exports.getAllUsers = asyncHandler(async (req, res) => {
  console.log("[DEBUG] Fetching all users - requester:", req.user.email);
  
  if (req.user.role !== 'super-admin') {
    console.log("[DEBUG] Unauthorized access attempt by:", req.user.email);
    return res.status(403).json({ 
      error: 'Unauthorized access. Only super-admins can view all users.' 
    });
  }
  
  try {
    const users = await User.find({}).select('-password -__v');
    console.log("[DEBUG] Found", users.length, "users");
    
    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
    
  } catch (err) {
    console.error("[ERROR] Fetching users failed:", err);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching users'
    });
  }
});

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private/SuperAdmin
exports.updateUser = asyncHandler(async (req, res) => {
  console.log("[DEBUG] Update user request for ID:", req.params.id, "by:", req.user.email);
  
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      console.log("[DEBUG] User not found with ID:", req.params.id);
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Authorization check
    if (req.user.role !== 'super-admin') {
      console.log("[DEBUG] Unauthorized update attempt by:", req.user.email);
      return res.status(403).json({
        success: false,
        error: 'Not authorized to update users'
      });
    }

    // Prevent changing super-admin role unless it's yourself
    if (user.role === 'super-admin' && req.user._id.toString() !== user._id.toString()) {
      console.log("[DEBUG] Attempt to modify another super-admin by:", req.user.email);
      return res.status(403).json({
        success: false,
        error: 'Cannot edit super-admin details'
      });
    }

    // Update fields
    user.firstname = req.body.firstname || user.firstname;
    user.lastname = req.body.lastname || user.lastname;
    user.email = req.body.email || user.email;
    user.phone = req.body.phone || user.phone;
    
    // Only update role if not super-admin or if editing self
    if (user.role !== 'super-admin' || req.user._id.toString() === user._id.toString()) {
      user.role = req.body.role || user.role;
    }

    const updatedUser = await user.save();
    console.log("[DEBUG] User updated successfully:", updatedUser.email);
    
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
    
  } catch (err) {
    console.error("[ERROR] User update failed:", err);
    res.status(500).json({
      success: false,
      error: 'Server error during user update',
      details: err.message
    });
  }
});

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private/SuperAdmin
exports.deleteUser = asyncHandler(async (req, res) => {
  console.log("[DEBUG] Delete user request for ID:", req.params.id, "by:", req.user.email);
  
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      console.log("[DEBUG] User not found with ID:", req.params.id);
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Authorization check
    if (req.user.role !== 'super-admin') {
      console.log("[DEBUG] Unauthorized delete attempt by:", req.user.email);
      return res.status(403).json({
        success: false,
        error: 'Not authorized to delete users'
      });
    }

    // // Prevent deleting super-admin
    // if (user.role === 'super-admin') {
    //   console.log("[DEBUG] Attempt to delete super-admin by:", req.user.email);
    //   return res.status(403).json({
    //     success: false,
    //     error: 'Cannot delete super-admin'
    //   });
    // }

    await user.remove();
    console.log("[DEBUG] User deleted successfully:", user.email);
    
    res.status(200).json({
      success: true,
      data: {},
      message: 'User deleted successfully'
    });
    
  } catch (err) {
    console.error("[ERROR] User deletion failed:", err);
    res.status(500).json({
      success: false,
      error: 'Server error during user deletion',
      details: err.message
    });
  }
});

// @desc    Get single user
// @route   GET /api/users/:id
// @access  Private/SuperAdmin
exports.getUser = asyncHandler(async (req, res) => {
  console.log("[DEBUG] Get user request for ID:", req.params.id, "by:", req.user.email);
  
  try {
    const user = await User.findById(req.params.id).select('-password -__v');

    if (!user) {
      console.log("[DEBUG] User not found with ID:", req.params.id);
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Authorization check
    if (req.user.role !== 'super-admin') {
      console.log("[DEBUG] Unauthorized access attempt by:", req.user.email);
      return res.status(403).json({
        success: false,
        error: 'Not authorized to view user details'
      });
    }

    console.log("[DEBUG] Returning user data for:", user.email);
    
    res.status(200).json({
      success: true,
      data: user
    });
    
  } catch (err) {
    console.error("[ERROR] Fetching user failed:", err);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching user',
      details: err.message
    });
  }
});