const User = require("../models/users");
const UserBackup = require("../models/userBackup"); // Import backup model
const asyncHandler = require("express-async-handler");
const logger = require("../utils/logger"); // Import logger

// @desc    Get all users
// @route   GET /api/users
// @access  Private/SuperAdmin
exports.getAllUsers = asyncHandler(async (req, res) => {
  const user = req.user || null;
  logger.debug('user', "[DEBUG] Fetching all users", user);
  
  if (req.user.role !== 'super-admin') {
    logger.warn('user', "[AUTH_FAILURE] Unauthorized access attempt to fetch all users", user);
    return res.status(403).json({ 
      error: 'Unauthorized access. Only super-admins can view all users.' 
    });
  }
  
  try {
    const users = await User.find({}).select('-password -__v');
    logger.debug('user', `Found ${users.length} users`, user);
    
    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
    
  } catch (err) {
    logger.error('user', "Fetching users failed", err, user);
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
  const user = req.user || null;
  logger.debug('user', `Update user request for ID: ${req.params.id}`, user);
  
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Authorization check
    if (req.user.role !== 'super-admin') {
      logger.warn('user', `[AUTH_FAILURE] Unauthorized update attempt for User ID: ${req.params.id}`, user);
      return res.status(403).json({
        success: false,
        error: 'Not authorized to update users'
      });
    }

    // Prevent editing another super-admin's details
    if (user.role === 'super-admin' && req.user._id.toString() !== user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Cannot edit super-admin details'
      });
    }

    // Update fields
    // Note: Role update logic is handled in userRoutes.js PUT route now.
    user.firstname = req.body.firstname || user.firstname;
    user.lastname = req.body.lastname || user.lastname;
    user.email = req.body.email || user.email;
    user.phone = req.body.phone || user.phone;
    
    // Only update role if not super-admin or if editing self
    if (user.role !== 'super-admin' || req.user._id.toString() === user._id.toString()) {
      user.role = req.body.role || user.role;
    }

    const updatedUser = await user.save();
    logger.info('user', `User updated successfully`, user, { updatedUserId: updatedUser._id, updatedUserEmail: updatedUser.email, updatedUserRole: updatedUser.role });
    
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
    logger.error('user', `User update failed for ID: ${req.params.id}`, err, user, { requestBody: req.body });
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
  const user = req.user || null;
  const logDetails = { performingUserId, userIdToDelete, model: 'User', performingUserEmail };

  logger.info('delete', `[DELETE_INITIATED] User ID: ${userIdToDelete} by User: ${performingUserEmail}.`, user, logDetails);

  try {
    // Authorization check (already handled by requireSuperAdmin middleware in routes)
    if (req.user.role !== 'super-admin') {
      logger.warn('delete', `[AUTH_FAILURE] Unauthorized delete attempt for User ID: ${userIdToDelete} by User: ${performingUserEmail}.`, user, logDetails);
      return res.status(403).json({ message: 'Forbidden: Super-admin access required' });
    }
    logger.debug('delete', `[FETCH_ATTEMPT] Finding User ID: ${userIdToDelete} for backup and deletion.`, user, logDetails);
    const userToBackup = await User.findById(userIdToDelete);

    if (!userToBackup) {
      logger.warn('delete', `[NOT_FOUND] User not found for deletion: ${userIdToDelete}.`, user, logDetails);
      return res.status(404).json({ message: 'User not found' });
    }
    logger.debug(`[FETCH_SUCCESS] Found User ID: ${userIdToDelete} (${userToBackup.email}). Performing checks before backup.`, logDetails);

    // Prevent super-admin from deleting themselves or the last super-admin
    if (userToBackup.role === 'super-admin') {
      if (performingUserId === userIdToDelete) {
        logger.warn('delete', `[DELETE_SELF_SUPER_ADMIN_DENIED] Super-admin ${performingUserEmail} attempted to delete themselves.`, user, logDetails);
        return res.status(400).json({ message: 'Super-admin cannot delete themselves.' });
      }
      const superAdminCount = await User.countDocuments({ role: 'super-admin' });
      if (superAdminCount <= 1) { // This check is also in userRoutes.js, but good to have defense in depth
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

    logger.debug('delete', `[PRE_BACKUP_SAVE] Attempting to save backup for User ID: ${userToBackup._id} (${userToBackup.email}).`, user, { ...logDetails, originalId: userToBackup._id });
    await newBackupEntry.save();
    logger.info('delete', `[BACKUP_SUCCESS] User successfully backed up. Backup ID: ${newBackupEntry._id}.`, user, { ...logDetails, originalId: userToBackup._id, backupId: newBackupEntry._id, backupModel: 'UserBackup' });

    logger.debug('delete', `[PRE_ORIGINAL_DELETE] Attempting to delete original User ID: ${userToBackup._id} (${userToBackup.email}).`, user, { ...logDetails, originalId: userToBackup._id });
    await User.findByIdAndDelete(userIdToDelete);
    logger.info('delete', `[ORIGINAL_DELETE_SUCCESS] Original User ${userToBackup.email} successfully deleted.`, user, { ...logDetails, originalId: userToBackup._id });

    res.status(200).json({
      message: 'User deleted and backed up successfully.',
      originalId: userToBackup._id,
      backupId: newBackupEntry._id
    });

    logger.info('userActivity', 'User profile deleted', user, { event: 'USER_DELETED', deletedUserId: userIdToDelete, deletedUserEmail: userToBackup.email });

  } catch (error) {
    logger.error('delete', `[DELETE_ERROR] Error during User deletion process for ID: ${userIdToDelete} by ${performingUserEmail}.`, error, user, logDetails);
    if (error.name === 'ValidationError' || (typeof userToBackup === 'undefined' || (userToBackup && (!newBackupEntry || newBackupEntry.isNew)))) {
        // Check if userToBackup was successfully fetched before attempting backup save
        logger.warn('delete', `[ROLLBACK_DELETE] Backup failed or error before backup for User ID: ${userIdToDelete}. Original document will not be deleted.`, user, logDetails);
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
  const user = req.user || null;
  logger.debug('user', `Get user request for ID: ${req.params.id}`, user);
  
  try {
    const user = await User.findById(req.params.id).select('-password -__v');
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Authorization check
    if (req.user.role !== 'super-admin') {
      logger.warn('user', `[AUTH_FAILURE] Unauthorized access attempt to get User ID: ${req.params.id}`, user);
      return res.status(403).json({
        success: false,
        error: 'Not authorized to view user details'
      });
    }

    logger.info('user', `Fetched user details for ID: ${req.params.id}`, user, { targetUserId: user._id, targetUserEmail: user.email });
    res.status(200).json({
      success: true,
      data: user
    });
    
  } catch (err) {
    logger.error('user', `Failed to fetch user details for ID: ${req.params.id}`, err, user);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching user',
      details: err.message
    });
  }
});

/**
 * @desc    Get a list of users suitable for ticket transfer
 * @route   GET /api/users/transfer-candidates
 * @access  Private (Authenticated users)
 */
exports.getTransferCandidates = asyncHandler(async (req, res) => {
  const initiator = req.user; // User making the request
  const logContext = { initiatorId: initiator.id, initiatorEmail: initiator.email, action: "FETCH_TRANSFER_CANDIDATES" };

  try {
    // Authorization:
    // For now, we allow any authenticated user to fetch this list.
    // You might want to restrict this further based on roles if needed, e.g.,
    // const allowedRoles = ['user', 'admin', 'super-admin'];
    // if (!allowedRoles.includes(initiator.role)) {
    //   logger.warn('user', `[AUTH_FAILURE] User ${initiator.email} (role: ${initiator.role}) attempted to fetch transfer candidates without permission.`, initiator, logContext);
    //   return res.status(403).json({ message: 'Forbidden: You do not have permission to view this user list.' });
    // }

    const users = await User.find({ isActive: true }) // Optionally filter by active users
      .select('firstname lastname email role _id department'); // Select only necessary fields

    logger.info('user', `Successfully fetched ${users.length} user candidates for ticket transfer by ${initiator.email}.`, initiator, logContext);
    res.status(200).json(users); // Send back the array of users directly
  } catch (error) {
    logger.error('user', `Failed to fetch user candidates for ticket transfer by ${initiator.email}.`, error, initiator, logContext);
    res.status(500).json({ message: 'Failed to load users for transfer.', details: error.message });
  }
});