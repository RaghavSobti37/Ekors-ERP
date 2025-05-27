const User = require("../models/users");
const UserBackup = require("../models/userBackup"); // Import backup model
const asyncHandler = require("express-async-handler");
const logger = require("../utils/logger"); // Import logger

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
// This function replaces the direct logic previously in userRoutes.js
exports.deleteUser = asyncHandler(async (req, res) => {
  const userIdToDelete = req.params.id;
  const performingUserId = req.user ? req.user.id : null; // User performing the delete
  const performingUserEmail = req.user ? req.user.email : 'N/A';
  const logDetails = { performingUserId, userIdToDelete, model: 'User', operation: 'delete', performingUserEmail };

  logger.info(`[DELETE_INITIATED] User ID: ${userIdToDelete} by User: ${performingUserEmail}.`, logDetails);

  try {
    // Authorization check (already handled by requireSuperAdmin middleware in routes)
    if (req.user.role !== 'super-admin') {
      logger.warn(`[AUTH_FAILURE] Unauthorized delete attempt for User ID: ${userIdToDelete} by User: ${performingUserEmail}.`, logDetails);
      return res.status(403).json({ message: 'Forbidden: Super-admin access required' });
    }
    logger.debug(`[FETCH_ATTEMPT] Finding User ID: ${userIdToDelete} for backup and deletion.`, logDetails);
    const userToBackup = await User.findById(userIdToDelete);

    if (!userToBackup) {
      logger.warn(`[NOT_FOUND] User not found for deletion: ${userIdToDelete}.`, logDetails);
      return res.status(404).json({ message: 'User not found' });
    }
    logger.debug(`[FETCH_SUCCESS] Found User ID: ${userIdToDelete} (${userToBackup.email}). Performing checks before backup.`, logDetails);

    // Prevent super-admin from deleting themselves or the last super-admin
    if (userToBackup.role === 'super-admin') {
      if (performingUserId === userIdToDelete) {
        logger.warn(`[DELETE_SELF_SUPER_ADMIN_DENIED] Super-admin ${performingUserEmail} attempted to delete themselves.`, logDetails);
        return res.status(400).json({ message: 'Super-admin cannot delete themselves.' });
      }
      const superAdminCount = await User.countDocuments({ role: 'super-admin' });
      if (superAdminCount <= 1) {
        logger.warn(`[DELETE_LAST_SUPER_ADMIN_DENIED] Attempt to delete the last super-admin: ${userToBackup.email} by ${performingUserEmail}.`, logDetails);
        return res.status(400).json({ message: 'Cannot delete the last super-admin.' });
      }
    }
    logger.debug(`[CHECKS_PASSED] Checks for User ID: ${userIdToDelete} passed. Preparing for backup.`, logDetails);

    const backupData = userToBackup.toObject({ transform: false }); // Get plain object without transforms

    const newBackupEntry = new UserBackup({
      ...backupData,
      originalId: userToBackup._id,
      deletedBy: performingUserId, // This is correct, it's the ID of the user performing the delete
      deletedAt: new Date(),
      originalCreatedAt: userToBackup.createdAt,
      originalUpdatedAt: userToBackup.updatedAt,
      backupReason: "Super-admin initiated deletion via API"
    });

    logger.debug(`[PRE_BACKUP_SAVE] Attempting to save backup for User ID: ${userToBackup._id} (${userToBackup.email}).`, { ...logDetails, originalId: userToBackup._id });
    await newBackupEntry.save();
    logger.info(`[BACKUP_SUCCESS] User successfully backed up. Backup ID: ${newBackupEntry._id}.`, { ...logDetails, originalId: userToBackup._id, backupId: newBackupEntry._id, backupModel: 'UserBackup' });

    logger.debug(`[PRE_ORIGINAL_DELETE] Attempting to delete original User ID: ${userToBackup._id} (${userToBackup.email}).`, { ...logDetails, originalId: userToBackup._id });
    await User.findByIdAndDelete(userIdToDelete);
    logger.info(`[ORIGINAL_DELETE_SUCCESS] Original User ${userToBackup.email} successfully deleted.`, { ...logDetails, originalId: userToBackup._id });

    res.status(200).json({
      message: 'User deleted and backed up successfully.',
      originalId: userToBackup._id,
      backupId: newBackupEntry._id
    });

  } catch (error) {
    logger.error(`[DELETE_ERROR] Error during User deletion process for ID: ${userIdToDelete} by ${performingUserEmail}.`, error, logDetails);
    if (error.name === 'ValidationError' || (typeof userToBackup === 'undefined' || (userToBackup && (!newBackupEntry || newBackupEntry.isNew)))) {
        logger.warn(`[ROLLBACK_DELETE] Backup failed or error before backup for User ID: ${userIdToDelete}. Original document will not be deleted.`, logDetails);
    }
    if (error.kind === 'ObjectId') {
        return res.status(400).json({ message: 'Invalid user ID format' });
    }
    res.status(500).json({ message: 'Server error during the deletion process. Please check server logs.' });
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