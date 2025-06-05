const User = require("../models/users");
const UserBackup = require("../models/userBackup"); // Import backup model
const asyncHandler = require("express-async-handler");
const logger = require("../utils/logger"); // Import logger


// @desc    Create a new user
// @route   POST /api/users
// @access  Private/SuperAdmin
exports.createUser = asyncHandler(async (req, res) => {
  // Validation results are handled by middleware in userRoutes.js

  const { firstname, lastname, email, phone, role, password } = req.body;
  const performingUser = req.user || null; // User performing the action

  try {
    let existingUser = await User.findOne({ email });
    if (existingUser) {
      logger.warn('user-create', `Attempt to create user with existing email: ${email}`, performingUser);
      return res.status(400).json({ error: "User already exists with this email" });
    }

    // Role assignment check: Only super-admin can create another super-admin
    if (role === 'super-admin' && (!performingUser || performingUser.role !== 'super-admin')) {
        logger.warn('user-create', `[AUTH_FAILURE] Non-super-admin attempt to create a super-admin user.`, performingUser, { requestedRole: role });
        return res.status(403).json({ error: "Forbidden: Only super-admins can create super-admin users." });
    }

    const newUser = new User({
      firstname,
      lastname,
      email,
      phone,
      role,
      password, // Password will be hashed by the pre-save hook in the User model
      isActive: true, // Default to active
    });

    await newUser.save();

    // Don't send back password hash
    const userResponse = newUser.toObject();
    delete userResponse.password;
    delete userResponse.__v;

    logger.info('user', "User created successfully", performingUser, {
      createdUserId: userResponse._id,
      createdUserEmail: userResponse.email,
      createdUserRole: userResponse.role,
    });

    res.status(201).json(userResponse);
  } catch (err) {
    logger.error('user-create', "Error creating user", err, performingUser, { requestBody: req.body });
    res.status(500).json({ error: "Server error while creating user" });
  }
});

// @desc    Get all users
// @route   GET /api/users
// @access  Private/SuperAdmin
exports.getAllUsers = asyncHandler(async (req, res) => {
  const user = req.user || null;
  logger.debug('user', "[DEBUG] Fetching all users", user);
  
  if (req.user.role !== 'super-admin') {
    logger.warn('user-getall', "[AUTH_FAILURE] Unauthorized access attempt to fetch all users", user);
    return res.status(403).json({ 
      error: 'Unauthorized access. Only super-admins can view all users.' 
    });
  }
  
  try {
    const users = await User.find({}).select('-password -__v');
    logger.debug('user-getall', `Found ${users.length} users`, user);
    
    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
    
  } catch (err) {
    logger.error('user-getall', "Fetching users failed", err, user);
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
  const performingUser = req.user || null; // User performing the update
  const userIdToUpdate = req.params.id;
  const { firstname, lastname, email, phone, role } = req.body; // Password changes are handled by updateUserProfile or a dedicated route

  logger.debug('user-update', `Update user request for ID: ${userIdToUpdate} by User: ${performingUser?.email}`, performingUser, { targetUserId: userIdToUpdate, requestBody: req.body });
  
  try {
    const userToUpdate = await User.findById(userIdToUpdate);
    if (!userToUpdate) {
      logger.warn('user-update', `User not found for update: ${userIdToUpdate}`, performingUser);
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Authorization check: Only super-admin can update users through this endpoint
    if (performingUser.role !== 'super-admin') {
      logger.warn('user-update', `[AUTH_FAILURE] Unauthorized update attempt for User ID: ${userIdToUpdate} by User: ${performingUser.email}`, performingUser);
      return res.status(403).json({
        success: false,
        error: 'Not authorized to update users'
      });
    }

    // Prevent editing another super-admin's details by a super-admin (unless it's themselves)
    if (userToUpdate.role === 'super-admin' && performingUser._id.toString() !== userToUpdate._id.toString()) {
      logger.warn('user-update', `[AUTH_FAILURE] Super-admin ${performingUser.email} attempt to edit another super-admin ${userToUpdate.email}.`, performingUser);
      return res.status(403).json({
        success: false,
        error: 'Super-admins cannot edit other super-admins\' details through this general update endpoint. Manage roles carefully.'
      });
    }
    
    // Handle role changes with specific logic
    if (role && role !== userToUpdate.role) {
        // Prevent super-admin from being demoted if they are the only one
        if (userToUpdate.role === 'super-admin' && role !== 'super-admin') {
            const superAdminCount = await User.countDocuments({ role: 'super-admin' });
            if (superAdminCount <= 1) { // This user is the last/only super-admin
                logger.warn('user-update', `[ROLE_CHANGE_DENIED] Attempt to demote the last super-admin: ${userToUpdate.email} by ${performingUser.email}.`, performingUser);
                return res.status(400).json({
                    success: false,
                    error: 'Cannot demote the last super-admin.'
                });
            }
        }
        // Only a super-admin can assign/change to super-admin role
        if (role === 'super-admin' && performingUser.role !== 'super-admin') {
            logger.warn('user-update', `[ROLE_CHANGE_DENIED] Non-super-admin ${performingUser.email} attempt to promote user ${userToUpdate.email} to super-admin.`, performingUser);
            return res.status(403).json({
                success: false,
                error: 'Forbidden: Only super-admins can assign super-admin role.'
            });
        }
        userToUpdate.role = role;
    }

    // Update fields
    userToUpdate.firstname = firstname || userToUpdate.firstname;
    userToUpdate.lastname = lastname || userToUpdate.lastname;
    userToUpdate.email = email || userToUpdate.email; // Allow email update by super-admin
    userToUpdate.phone = phone !== undefined ? phone : userToUpdate.phone; // Allow phone to be set to empty string

    const updatedUser = await userToUpdate.save();
    logger.info('user', `User updated successfully by ${performingUser.email}`, performingUser, { updatedUserId: updatedUser._id, updatedUserEmail: updatedUser.email, updatedUserRole: updatedUser.role });
    
    // Prepare response, excluding sensitive fields
    const responseUser = updatedUser.toObject();
    delete responseUser.password;
    delete responseUser.__v;
    delete responseUser.loginAttempts;
    delete responseUser.lockUntil;

    
    res.status(200).json({
      success: true,
      data: responseUser,
      message: "User updated successfully"
    });
    
  } catch (err) {
    logger.error('user-update', `User update failed for ID: ${userIdToUpdate} by ${performingUser?.email}`, err, performingUser, { requestBody: req.body });
    if (err.code === 11000) { // Duplicate key error (e.g., email)
        return res.status(400).json({ success: false, error: 'Email already in use by another account.' });
    }
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
// Logging for delete is in userController.js
exports.deleteUser = asyncHandler(async (req, res) => {
  const userIdToDelete = req.params.id;
  const performingUser = req.user || null; // User performing the delete
  const performingUserId = performingUser ? performingUser.id : null;
  const performingUserEmail = performingUser ? performingUser.email : 'N/A';
  
  const logDetails = { performingUserId, userIdToDelete, model: 'User', performingUserEmail };
  let backupEntrySaved = false; // To track if backup was successful

  if (!UserBackup) {
    logger.fatal('MODEL_LOAD_ERROR', 'UserBackup model is not available. This is a critical server configuration issue. User deletion functionality is impaired.', performingUser, logDetails);
    return res.status(500).json({ message: 'Server configuration error: Backup service unavailable. User not deleted.' });
  }

  logger.info('delete', `[DELETE_INITIATED] User ID: ${userIdToDelete} by User: ${performingUserEmail}.`, performingUser, logDetails);

  try {
    // Authorization check (already handled by requireSuperAdmin middleware in routes)
    if (performingUser.role !== 'super-admin') {
      logger.warn('delete', `[AUTH_FAILURE] Unauthorized delete attempt for User ID: ${userIdToDelete} by User: ${performingUserEmail}.`, performingUser, logDetails);
      return res.status(403).json({ message: 'Forbidden: Super-admin access required' });
    }
    logger.debug('delete', `[FETCH_ATTEMPT] Finding User ID: ${userIdToDelete} for backup and deletion.`, performingUser, logDetails);
    const userToBackup = await User.findById(userIdToDelete);

    if (!userToBackup) {
      logger.warn('delete', `[NOT_FOUND] User not found for deletion: ${userIdToDelete}.`, performingUser, logDetails);
      return res.status(404).json({ message: 'User not found' });
    }
    logger.debug('delete', `[FETCH_SUCCESS] Found User ID: ${userIdToDelete} (${userToBackup.email}). Performing checks before backup.`, performingUser, logDetails);

    // Prevent super-admin from deleting themselves
    if (performingUserId === userIdToDelete) {
      logger.warn('delete', `[DELETE_SELF_SUPER_ADMIN_DENIED] Super-admin ${performingUserEmail} attempted to delete themselves.`, performingUser, logDetails);
      return res.status(400).json({ message: 'Super-admin cannot delete themselves.' });
    }
    
    // Prevent deleting the last super-admin
    if (userToBackup.role === 'super-admin') {
      const superAdminCount = await User.countDocuments({ role: 'super-admin' });
      if (superAdminCount <= 1) {
        logger.warn('delete', `[DELETE_LAST_SUPER_ADMIN_DENIED] Attempt to delete the last super-admin: ${userToBackup.email} by ${performingUserEmail}.`, performingUser, logDetails);
        return res.status(400).json({ message: 'Cannot delete the last super-admin.' });
      }
    }
    logger.debug('delete', `[CHECKS_PASSED] Checks for User ID: ${userIdToDelete} passed. Preparing for backup.`, performingUser, logDetails);

    const backupData = userToBackup.toObject({ transform: false }); // Get plain object without transforms
    delete backupData.password; // Ensure password is not in backupData
    delete backupData.__v;

    const newBackupEntry = new UserBackup({
      ...backupData,
      originalId: userToBackup._id,
      deletedBy: performingUserId,
      deletedAt: new Date(),
      originalCreatedAt: userToBackup.createdAt,
      originalUpdatedAt: userToBackup.updatedAt,
      backupReason: "Super-admin initiated deletion via API"
    });

    logger.debug('delete', `[PRE_BACKUP_SAVE] Attempting to save backup for User ID: ${userToBackup._id} (${userToBackup.email}).`, performingUser, { ...logDetails, originalId: userToBackup._id });
    await newBackupEntry.save();
    backupEntrySaved = true; // Mark backup as successful
    logger.info('delete', `[BACKUP_SUCCESS] User successfully backed up. Backup ID: ${newBackupEntry._id}.`, performingUser, { ...logDetails, originalId: userToBackup._id, backupId: newBackupEntry._id, backupModel: 'UserBackup' });

    logger.debug('delete', `[PRE_ORIGINAL_DELETE] Attempting to delete original User ID: ${userToBackup._id} (${userToBackup.email}).`, performingUser, { ...logDetails, originalId: userToBackup._id });
    await User.findByIdAndDelete(userIdToDelete);
    logger.info('delete', `[ORIGINAL_DELETE_SUCCESS] Original User ${userToBackup.email} successfully deleted.`, performingUser, { ...logDetails, originalId: userToBackup._id });
    
    res.status(200).json({
      message: 'User deleted and backed up successfully.',
      originalId: userToBackup._id,
      backupId: newBackupEntry._id
    });
    logger.info('userActivity', 'User profile deleted', performingUser, { event: 'USER_DELETED', deletedUserId: userIdToDelete, deletedUserEmail: userToBackup.email });


  } catch (error) {
    logger.error('delete', `[DELETE_ERROR] Error during User deletion process for ID: ${userIdToDelete} by ${performingUserEmail}.`, error, performingUser, logDetails);
    // Simplified rollback check: if backup entry wasn't created or saved, it implies an error before or during backup.
    // The actual userToBackup variable might be undefined if findById failed.
    const userToBackupExists = typeof userToBackup !== 'undefined' && userToBackup !== null;
    const backupAttemptedAndFailed = newBackupEntry && newBackupEntry.isNew;

    if (error.name === 'ValidationError' || !userToBackupExists || backupAttemptedAndFailed) {
        logger.warn('delete', `[ROLLBACK_DELETE_IMPLIED] Backup failed or error before backup for User ID: ${userIdToDelete}. Original document was not deleted or deletion attempt failed.`, performingUser, logDetails);
    }
    if (error.kind === 'ObjectId') { // Mongoose error for invalid ID format
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
  
  const performingUser = req.user || null;
  const targetUserId = req.params.id;
  logger.debug('user-get', `Get user request for ID: ${targetUserId} by ${performingUser?.email}`, performingUser);
  
  try {
    // Authorization check (already in route, but good for defense in depth)
    if (performingUser.role !== 'super-admin') {
      logger.warn('user-get', `[AUTH_FAILURE] Unauthorized access attempt to get User ID: ${targetUserId} by ${performingUser.email}`, performingUser);
      return res.status(404).json({
        success: false,
        error: 'Not authorized to view user details'
      });
    }

    const targetUser = await User.findById(targetUserId).select('-password -__v');
    if (!targetUser) {
      logger.warn('user-get', `User not found: ${targetUserId}`, performingUser);
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    logger.info('user-get', `Fetched user details for ID: ${targetUserId}`, performingUser, { targetUserId: targetUser._id, targetUserEmail: targetUser.email });
    res.status(200).json({
      success: true,
      data: targetUser
    });
    
  } catch (err) {
    logger.error('user-get', `Failed to fetch user details for ID: ${targetUserId}`, err, performingUser);
    if (err.kind === 'ObjectId') {
        return res.status(400).json({ success: false, error: 'Invalid user ID format' });
    }
    res.status(500).json({
      success: false,
      error: 'Server error while fetching user',
      details: err.message // Consider removing err.message in production
    });
  }
});

// @desc    Update own user profile (phone, password)
// @route   PATCH /api/users/profile
// @access  Private (Authenticated users)
exports.updateUserProfile = asyncHandler(async (req, res) => {
  const { phone, password } = req.body;
  const userId = req.user.id; // Get ID from authenticated user

  try {
    const user = await User.findById(userId);
    if (!user) {
      // This should ideally not happen if auth middleware is working
      logger.warn('user-profile-update', `User not found for profile update. User ID from token: ${userId}. This indicates a potential issue.`, req.user);
      return res.status(404).json({ message: "User not found" });
    }

    if (phone !== undefined) {
      user.phone = phone;
    }
    if (password) {
      if (password.length < 5) {
        logger.warn('user-profile-update', `User ${userId} attempted to set a short password.`, req.user);
        return res.status(400).json({ message: "Password must be at least 5 characters long" });
      }
      user.password = password; // The pre-save hook will hash it
    }

    const updatedUser = await user.save();
    logger.info('user-profile-update', `User ${userId} updated their profile successfully.`, req.user);
    
    // Use getSafeUser if it exists and is appropriate, otherwise select fields manually
    const userResponse = updatedUser.getSafeUser ? updatedUser.getSafeUser() : {
        _id: updatedUser._id,
        firstname: updatedUser.firstname,
        lastname: updatedUser.lastname,
        email: updatedUser.email,
        phone: updatedUser.phone,
        role: updatedUser.role,
        avatarUrl: updatedUser.avatarUrl,
        isActive: updatedUser.isActive,
        // Do not include password, __v, etc.
    };
    
    res.status(200).json({ message: "Profile updated successfully", data: userResponse });
  } catch (error) {
    logger.error('user-profile-update-error', `Error updating profile for user ${userId}: ${error.message}`, error);
    logger.error('user-profile-update-error', `Error updating profile for user ${userId}: ${error.message}`, error, req.user);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: "Validation failed", errors: error.errors });
    }
    res.status(500).json({ message: "Server error while updating profile", error: error.message });
  }
});

// @desc    Toggle user active status
// @route   PATCH /api/users/:id/status
// @access  Private/SuperAdmin
exports.toggleUserActiveStatus = asyncHandler(async (req, res) => {
  const { id: userIdToToggle } = req.params;
  const { isActive } = req.body; // Expecting { isActive: boolean }
  const performingUser = req.user; // User performing the action

  logger.info('user-status-toggle', `[STATUS_TOGGLE_INITIATED] User ID: ${userIdToToggle} by User: ${performingUser.email}. Requested status: ${isActive}`, performingUser, { targetUserId: userIdToToggle, requestedStatus: isActive });

  // Authorization check (though middleware should also handle this)
  if (performingUser.role !== 'super-admin') {
    logger.warn('user-status-toggle', `[AUTH_FAILURE] Unauthorized status toggle attempt for User ID: ${userIdToToggle} by User: ${performingUser.email}.`, performingUser);
    return res.status(403).json({ success: false, error: 'Forbidden: Super-admin access required.' });
  }

  if (typeof isActive !== 'boolean') {
    logger.warn('user-status-toggle', `[BAD_REQUEST] Invalid 'isActive' value for User ID: ${userIdToToggle}. Received: ${isActive}`, performingUser);
    return res.status(400).json({ success: false, error: "'isActive' field must be a boolean and is required." });
  }

  const userToUpdate = await User.findById(userIdToToggle);

  if (!userToUpdate) {
    logger.warn('user-status-toggle', `[NOT_FOUND] User not found for status toggle: ${userIdToToggle}.`, performingUser);
    return res.status(404).json({ success: false, error: 'User not found' });
  }

  // Prevent super-admin from disabling themselves
  if (userToUpdate.role === 'super-admin' && userToUpdate._id.toString() === performingUser._id.toString() && !isActive) {
    logger.warn('user-status-toggle', `[SELF_DISABLE_DENIED] Super-admin ${performingUser.email} attempted to disable themselves.`, performingUser);
    return res.status(400).json({ success: false, error: 'Super-admin cannot disable themselves.' });
  }

  // Prevent disabling the last active super-admin
  if (userToUpdate.role === 'super-admin' && !isActive && userToUpdate.isActive) { // Only check if trying to disable an currently active super-admin
    const activeSuperAdminCount = await User.countDocuments({ role: 'super-admin', isActive: true });
    if (activeSuperAdminCount <= 1) { // If this is the last (or only) active one
        logger.warn('user-status-toggle', `[LAST_SUPER_ADMIN_DISABLE_DENIED] Attempt to disable the last active super-admin: ${userToUpdate.email} by ${performingUser.email}.`, performingUser);
        return res.status(400).json({ success: false, error: 'Cannot disable the last active super-admin.' });
    }
  }

  userToUpdate.isActive = isActive;
  await userToUpdate.save();
  logger.info('user-status-toggle', `[STATUS_TOGGLE_SUCCESS] User ${userToUpdate.email} status updated to ${isActive} by ${performingUser.email}.`, performingUser, { targetUserId: userToUpdate._id, newStatus: isActive });
  
  const responseUser = userToUpdate.toObject();
  delete responseUser.password;
  delete responseUser.__v;
  // Add other fields as needed, ensure consistency with other user responses

  res.status(200).json({
    success: true,
    data: responseUser,
    message: `User ${userToUpdate.firstname} ${userToUpdate.lastname} has been ${isActive ? 'enabled' : 'disabled'}.`
  });
});