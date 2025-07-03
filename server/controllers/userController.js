const User = require("../models/users");
const UniversalBackup = require("../models/universalBackup"); // Import backup model
const asyncHandler = require("express-async-handler");
const logger = require("../logger"); // Import logger

// @desc    Create a new user
// @route   POST /api/users
// @access  Private/SuperAdmin
exports.createUser = asyncHandler(async (req, res) => {
  const { firstname, lastname, email, phone, role, password } = req.body;
  const performingUser = req.user || null;

  try {
    let existingUser = await User.findOne({ email });
    if (existingUser) {
      logger.log({
        user: performingUser,
        page: "User",
        action: "Create User",
        req,
        message: `Attempt to create user with existing email: ${email}`,
        details: { email },
        level: "warn",
      });
      return res
        .status(400)
        .json({ error: "User already exists with this email" });
    }

    if (
      role === "super-admin" &&
      (!performingUser || performingUser.role !== "super-admin")
    ) {
      logger.log({
        user: performingUser,
        page: "User",
        action: "Create User",
        req,
        message: `[AUTH_FAILURE] Non-super-admin attempt to create a super-admin user.`,
        details: { requestedRole: role },
        level: "warn",
      });
      return res.status(403).json({
        error: "Forbidden: Only super-admins can create super-admin users.",
      });
    }

    const newUser = new User({
      firstname,
      lastname,
      email,
      phone,
      role,
      password,
      isActive: true,
    });

    await newUser.save();

    const userResponse = newUser.toObject();
    delete userResponse.password;
    delete userResponse.__v;

    logger.log({
      user: performingUser,
      page: "User",
      action: "Create User",
      req,
      message: "User created successfully",
      details: {
        createdUserId: userResponse._id,
        createdUserEmail: userResponse.email,
        createdUserRole: userResponse.role,
      },
      level: "info",
    });

    res.status(201).json(userResponse);
  } catch (err) {
    logger.log({
      user: performingUser,
      page: "User",
      action: "Create User Error",
      req,
      message: "Error creating user",
      details: { error: err.message, requestBody: req.body },
      level: "error",
    });
    res.status(500).json({ error: "Server error while creating user" });
  }
});

// @desc    Get all users
// @route   GET /api/users
// @access  Private/SuperAdmin
exports.getAllUsers = asyncHandler(async (req, res) => {
  const user = req.user || null;

  if (req.user.role !== "super-admin") {
    logger.log({
      user,
      page: "User",
      action: "Get All Users",
      req,
      message: "[AUTH_FAILURE] Unauthorized access attempt to fetch all users",
      level: "warn",
    });
    return res.status(403).json({
      error: "Unauthorized access. Only super-admins can view all users.",
    });
  }

  try {
    const users = await User.find({})
      .select("-password -__v")
      .populate("roleChangeHistory.changedBy", "firstname lastname email");

    logger.log({
      user,
      page: "User",
      action: "Get All Users",
      req,
      message: `Found ${users.length} users`,
      details: { count: users.length },
      level: "info",
    });

    res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (err) {
    logger.log({
      user,
      page: "User",
      action: "Get All Users Error",
      req,
      message: "Fetching users failed",
      level: "error",
    });
    res.status(500).json({
      success: false,
      error: "Server error while fetching users",
    });
  }
});

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private/SuperAdmin
exports.updateUser = asyncHandler(async (req, res) => {
  const performingUser = req.user || null;
  const userIdToUpdate = req.params.id;
  const { firstname, lastname, email, phone, role, password } = req.body;

  logger.log({
    user: performingUser,
    page: "User",
    action: "Update User",
    req,
    message: `Update user request for ID: ${userIdToUpdate} by User: ${performingUser?.email}`,
    details: {
      targetUserId: userIdToUpdate,
      requestBody: {
        ...req.body,
        password: password ? "*****" : "not provided",
      },
    },
    level: "debug",
  });

  try {
    const userToUpdate = await User.findById(userIdToUpdate);
    if (!userToUpdate) {
      logger.log({
        user: performingUser,
        page: "User",
        action: "Update User",
        req,
        message: `User not found for update: ${userIdToUpdate}`,
        level: "warn",
      });
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    if (performingUser.role !== "super-admin") {
      logger.log({
        user: performingUser,
        page: "User",
        action: "Update User",
        req,
        message: `[AUTH_FAILURE] Unauthorized update attempt for User ID: ${userIdToUpdate} by User: ${performingUser.email}`,
        level: "warn",
      });
      return res.status(403).json({
        success: false,
        error: "Not authorized to update users",
      });
    }

    if (password) {
      if (password.length < 5) {
        logger.log({
          user: performingUser,
          page: "User",
          action: "Update User",
          req,
          message: `[PASSWORD_VALIDATION_FAILED] Password too short for User ID: ${userIdToUpdate}`,
          level: "warn",
        });
        return res.status(400).json({
          success: false,
          error: "Password must be at least 5 characters",
        });
      }
      userToUpdate.password = password;
      logger.log({
        user: performingUser,
        page: "User",
        action: "Update User",
        req,
        message: `[PASSWORD_CHANGE_INITIATED] Password change for User ID: ${userIdToUpdate} by Super Admin: ${performingUser.email}`,
        level: "info",
      });
    }

    if (role && role !== userToUpdate.role) {
      if (userToUpdate.role === "super-admin" && role !== "super-admin") {
        const superAdminCount = await User.countDocuments({
          role: "super-admin",
        });
        if (superAdminCount <= 1) {
          logger.log({
            user: performingUser,
            page: "User",
            action: "Update User",
            req,
            message: `[ROLE_CHANGE_DENIED] Attempt to demote the last super-admin: ${userToUpdate.email} by ${performingUser.email}.`,
            level: "warn",
          });
          return res.status(400).json({
            success: false,
            error: "Cannot demote the last super-admin.",
          });
        }
      }
      if (role === "super-admin" && performingUser.role !== "super-admin") {
        logger.log({
          user: performingUser,
          page: "User",
          action: "Update User",
          req,
          message: `[ROLE_CHANGE_DENIED] Non-super-admin ${performingUser.email} attempt to promote user ${userToUpdate.email} to super-admin.`,
          level: "warn",
        });
        return res.status(403).json({
          success: false,
          error: "Forbidden: Only super-admins can assign super-admin role.",
        });
      }
      userToUpdate.roleChangeHistory.push({
        oldRole: userToUpdate.role,
        newRole: role,
        changedBy: performingUser._id,
        changedAt: new Date(),
      });

      userToUpdate.role = role;
    }

    userToUpdate.firstname = firstname || userToUpdate.firstname;
    userToUpdate.lastname = lastname || userToUpdate.lastname;
    userToUpdate.email = email || userToUpdate.email;
    userToUpdate.phone = phone !== undefined ? phone : userToUpdate.phone;

    const updatedUser = await userToUpdate.save();
    logger.log({
      user: performingUser,
      page: "User",
      action: "Update User",
      req,
      message: `User updated successfully by ${performingUser.email}`,
      details: {
        updatedUserId: updatedUser._id,
        updatedUserEmail: updatedUser.email,
        updatedUserRole: updatedUser.role,
        passwordChanged: !!password,
      },
      level: "info",
    });

    const responseUser = updatedUser.toObject();
    delete responseUser.password;
    delete responseUser.__v;
    delete responseUser.loginAttempts;
    delete responseUser.lockUntil;

    res.status(200).json({
      success: true,
      data: responseUser,
      message:
        "User updated successfully" + (password ? " (password changed)" : ""),
    });
  } catch (err) {
    logger.log({
      user: performingUser,
      page: "User",
      action: "Update User Error",
      req,
      message: `User update failed for ID: ${userIdToUpdate} by ${performingUser?.email}`,
      details: {
        requestBody: {
          ...req.body,
          password: req.body.password ? "*****" : "not provided",
        },
        error: err.message,
      },
      level: "error",
    });
    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        error: "Email already in use by another account.",
      });
    }
    res.status(500).json({
      success: false,
      error: "Server error during user update",
      details: err.message,
    });
  }
});

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private/SuperAdmin
exports.deleteUser = asyncHandler(async (req, res) => {
  const userIdToDelete = req.params.id;
  const performingUser = req.user || null;
  const performingUserId = performingUser ? performingUser.id : null;
  const performingUserEmail = performingUser ? performingUser.email : "N/A";

  const logDetails = {
    performingUserId,
    userIdToDelete,
    model: "User",
    performingUserEmail,
  };
  let backupEntrySaved = false;

  if (!UniversalBackup) {
    logger.log({
      user: performingUser,
      page: "User",
      action: "Delete User",
      req,
      message:
        "UniversalBackup model is not available. Critical server configuration issue.",
      details: logDetails,
      level: "fatal",
    });
    return res.status(500).json({
      message:
        "Server configuration error: Backup service unavailable. User not deleted.",
    });
  }

  logger.log({
    user: performingUser,
    page: "User",
    action: "Delete User",
    req,
    message: `[DELETE_INITIATED] User ID: ${userIdToDelete} by User: ${performingUserEmail}.`,
    details: logDetails,
    level: "info",
  });

  try {
    if (performingUser.role !== "super-admin") {
      logger.log({
        user: performingUser,
        page: "User",
        action: "Delete User",
        req,
        message: `[AUTH_FAILURE] Unauthorized delete attempt for User ID: ${userIdToDelete} by User: ${performingUserEmail}.`,
        details: logDetails,
        level: "warn",
      });
      return res
        .status(403)
        .json({ message: "Forbidden: Super-admin access required" });
    }
    logger.log({
      user: performingUser,
      page: "User",
      action: "Delete User",
      req,
      message: `[FETCH_ATTEMPT] Finding User ID: ${userIdToDelete} for backup and deletion.`,
      details: logDetails,
      level: "debug",
    });
    const userToBackup = await User.findById(userIdToDelete);

    if (!userToBackup) {
      logger.log({
        user: performingUser,
        page: "User",
        action: "Delete User",
        req,
        message: `[NOT_FOUND] User not found for deletion: ${userIdToDelete}.`,
        details: logDetails,
        level: "warn",
      });
      return res.status(404).json({ message: "User not found" });
    }
    logger.log({
      user: performingUser,
      page: "User",
      action: "Delete User",
      req,
      message: `[FETCH_SUCCESS] Found User ID: ${userIdToDelete} (${userToBackup.email}). Performing checks before backup.`,
      details: logDetails,
      level: "debug",
    });

    if (performingUserId === userIdToDelete) {
      logger.log({
        user: performingUser,
        page: "User",
        action: "Delete User",
        req,
        message: `[DELETE_SELF_SUPER_ADMIN_DENIED] Super-admin ${performingUserEmail} attempted to delete themselves.`,
        details: logDetails,
        level: "warn",
      });
      return res
        .status(400)
        .json({ message: "Super-admin cannot delete themselves." });
    }

    if (userToBackup.role === "super-admin") {
      const superAdminCount = await User.countDocuments({
        role: "super-admin",
      });
      if (superAdminCount <= 1) {
        logger.log({
          user: performingUser,
          page: "User",
          action: "Delete User",
          req,
          message: `[DELETE_LAST_SUPER_ADMIN_DENIED] Attempt to delete the last super-admin: ${userToBackup.email} by ${performingUserEmail}.`,
          details: logDetails,
          level: "warn",
        });
        return res
          .status(400)
          .json({ message: "Cannot delete the last super-admin." });
      }
    }
    logger.log({
      user: performingUser,
      page: "User",
      action: "Delete User",
      req,
      message: `[CHECKS_PASSED] Checks for User ID: ${userIdToDelete} passed. Preparing for backup.`,
      details: logDetails,
      level: "debug",
    });

    const userDataToBackup = userToBackup.toObject({ transform: false });
    delete userDataToBackup.password;
    delete userDataToBackup.__v;
    delete userDataToBackup.loginAttempts;
    delete userDataToBackup.lockUntil;

    const newBackupEntry = new UniversalBackup({
      originalId: userToBackup._id,
      originalModel: "User",
      data: userDataToBackup,
      deletedBy: performingUserId,
      deletedAt: new Date(),
      originalCreatedAt: userToBackup.createdAt,
      originalUpdatedAt: userToBackup.updatedAt,
    });

    logger.log({
      user: performingUser,
      page: "User",
      action: "Delete User",
      req,
      message: `[PRE_BACKUP_SAVE] Attempting to save backup for User ID: ${userToBackup._id} (${userToBackup.email}).`,
      details: { ...logDetails, originalId: userToBackup._id },
      level: "debug",
    });
    await newBackupEntry.save();
    backupEntrySaved = true;
    logger.log({
      user: performingUser,
      page: "User",
      action: "Delete User",
      req,
      message: `[BACKUP_SUCCESS] User successfully backed up. Backup ID: ${newBackupEntry._id}.`,
      details: {
        ...logDetails,
        originalId: userToBackup._id,
        backupId: newBackupEntry._id,
        backupModel: "UniversalBackup",
      },
      level: "info",
    });

    logger.log({
      user: performingUser,
      page: "User",
      action: "Delete User",
      req,
      message: `[PRE_ORIGINAL_DELETE] Attempting to delete original User ID: ${userToBackup._id} (${userToBackup.email}).`,
      details: { ...logDetails, originalId: userToBackup._id },
      level: "debug",
    });
    await User.findByIdAndDelete(userIdToDelete);
    logger.log({
      user: performingUser,
      page: "User",
      action: "Delete User",
      req,
      message: `[ORIGINAL_DELETE_SUCCESS] Original User ${userToBackup.email} successfully deleted.`,
      details: { ...logDetails, originalId: userToBackup._id },
      level: "info",
    });

    res.status(200).json({
      message: "User deleted and backed up successfully.",
      originalId: userToBackup._id,
      backupId: newBackupEntry._id,
    });
    logger.log({
      user: performingUser,
      page: "User",
      action: "User Activity",
      req,
      message: "User profile deleted",
      details: {
        event: "USER_DELETED",
        deletedUserId: userIdToDelete,
        deletedUserEmail: userToBackup.email,
      },
      level: "info",
    });
  } catch (error) {
    logger.log({
      user: performingUser,
      page: "User",
      action: "Delete User Error",
      req,
      message: `[DELETE_ERROR] Error during User deletion process for ID: ${userIdToDelete} by ${performingUserEmail}.`,
      details: { ...logDetails, error: error.message },
      level: "error",
    });
    const userToBackupExists =
      typeof userToBackup !== "undefined" && userToBackup !== null;
    const backupAttemptedAndFailed = newBackupEntry && newBackupEntry.isNew;

    if (
      error.name === "ValidationError" ||
      !userToBackupExists ||
      backupAttemptedAndFailed
    ) {
      logger.log({
        user: performingUser,
        page: "User",
        action: "Delete User",
        req,
        message: `[ROLLBACK_DELETE_IMPLIED] Backup failed or error before backup for User ID: ${userIdToDelete}. Original document was not deleted or deletion attempt failed.`,
        details: logDetails,
        level: "warn",
      });
    }
    if (error.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid user ID format" });
    }
    res.status(500).json({
      message:
        "Server error during the deletion process. Please check server logs.",
    });
  }
});

// @desc    Get single user
// @route   GET /api/users/:id
// @access  Private/SuperAdmin
exports.getUser = asyncHandler(async (req, res) => {
  const user = req.user || null;
  const performingUser = req.user || null;
  const targetUserId = req.params.id;

  if (performingUser.role !== "super-admin") {
    logger.log({
      user: performingUser,
      page: "User",
      action: "Get User",
      req,
      message: `[AUTH_FAILURE] Unauthorized access attempt to get User ID: ${targetUserId} by ${performingUser.email}`,
      level: "warn",
    });
    return res.status(404).json({
      success: false,
      error: "Not authorized to view user details",
    });
  }

  try {
    const targetUser = await User.findById(targetUserId)
      .select("-password -__v")
      .populate("roleChangeHistory.changedBy", "firstname lastname email");
    if (!targetUser) {
      logger.log({
        user: performingUser,
        page: "User",
        action: "Get User",
        req,
        message: `User not found: ${targetUserId}`,
        level: "warn",
      });
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    logger.log({
      user: performingUser,
      page: "User",
      action: "Get User",
      req,
      message: `Fetched user details for ID: ${targetUserId}`,
      details: {
        targetUserId: targetUser._id,
        targetUserEmail: targetUser.email,
      },
      level: "info",
    });
    res.status(200).json({
      success: true,
      data: targetUser,
    });
  } catch (err) {
    logger.log({
      user: performingUser,
      page: "User",
      action: "Get User Error",
      req,
      message: `Failed to fetch user details for ID: ${targetUserId}`,
      level: "error",
    });
    if (err.kind === "ObjectId") {
      return res
        .status(400)
        .json({ success: false, error: "Invalid user ID format" });
    }
    res.status(500).json({
      success: false,
      error: "Server error while fetching user",
      details: err.message,
    });
  }
});

// @desc    Update own user profile (phone, password)
// @route   PATCH /api/users/profile
// @access  Private (Authenticated users)
exports.updateUserProfile = asyncHandler(async (req, res) => {
  const { phone, password } = req.body;
  const userId = req.user.id;

  try {
    const user = await User.findById(userId);
    if (!user) {
      logger.log({
        user: req.user,
        page: "User",
        action: "Update User Profile",
        req,
        message: `User not found for profile update. User ID from token: ${userId}.`,
        level: "warn",
      });
      return res.status(404).json({ message: "User not found" });
    }

    if (phone !== undefined) {
      user.phone = phone;
    }
    if (password) {
      if (password.length < 5) {
        logger.log({
          user: req.user,
          page: "User",
          action: "Update User Profile",
          req,
          message: `User ${userId} attempted to set a short password.`,
          level: "warn",
        });
        return res
          .status(400)
          .json({ message: "Password must be at least 5 characters long" });
      }
      user.password = password;
    }

    const updatedUser = await user.save();
    logger.log({
      user: req.user,
      page: "User",
      action: "Update User Profile",
      req,
      message: `User ${userId} updated their profile successfully.`,
      level: "info",
    });

    const userResponse = updatedUser.getSafeUser
      ? updatedUser.getSafeUser()
      : {
          _id: updatedUser._id,
          firstname: updatedUser.firstname,
          lastname: updatedUser.lastname,
          email: updatedUser.email,
          phone: updatedUser.phone,
          role: updatedUser.role,
          avatarUrl: updatedUser.avatarUrl,
          isActive: updatedUser.isActive,
        };

    res
      .status(200)
      .json({ message: "Profile updated successfully", data: userResponse });
  } catch (error) {
    logger.log({
      user: req.user,
      page: "User",
      action: "Update User Profile Error",
      req,
      message: `Error updating profile for user ${userId}: ${error.message}`,
      level: "error",
    });
    if (error.name === "ValidationError") {
      return res
        .status(400)
        .json({ message: "Validation failed", errors: error.errors });
    }
    res.status(500).json({
      message: "Server error while updating profile",
      error: error.message,
    });
  }
});

// @desc    Toggle user active status
// @route   PATCH /api/users/:id/status
// @access  Private/SuperAdmin
exports.toggleUserActiveStatus = asyncHandler(async (req, res) => {
  const { id: userIdToToggle } = req.params;
  const { isActive } = req.body;
  const performingUser = req.user;

  if (performingUser.role !== "super-admin") {
    logger.log({
      user: performingUser,
      page: "User",
      action: "Toggle User Active Status",
      req,
      message: `[AUTH_FAILURE] Unauthorized status toggle attempt for User ID: ${userIdToToggle} by User: ${performingUser.email}.`,
      level: "warn",
    });
    return res.status(403).json({
      success: false,
      error: "Forbidden: Super-admin access required.",
    });
  }

  if (typeof isActive !== "boolean") {
    logger.log({
      user: performingUser,
      page: "User",
      action: "Toggle User Active Status",
      req,
      message: `[BAD_REQUEST] Invalid 'isActive' value for User ID: ${userIdToToggle}. Received: ${isActive}`,
      level: "warn",
    });
    return res.status(400).json({
      success: false,
      error: "'isActive' field must be a boolean and is required.",
    });
  }

  const userToUpdate = await User.findById(userIdToToggle);

  if (!userToUpdate) {
    logger.log({
      user: performingUser,
      page: "User",
      action: "Toggle User Active Status",
      req,
      message: `[NOT_FOUND] User not found for status toggle: ${userIdToToggle}.`,
      level: "warn",
    });
    return res.status(404).json({ success: false, error: "User not found" });
  }

  if (
    userToUpdate.role === "super-admin" &&
    userToUpdate._id.toString() === performingUser._id.toString() &&
    !isActive
  ) {
    logger.log({
      user: performingUser,
      page: "User",
      action: "Toggle User Active Status",
      req,
      message: `[SELF_DISABLE_DENIED] Super-admin ${performingUser.email} attempted to disable themselves.`,
      level: "warn",
    });
    return res.status(400).json({
      success: false,
      error: "Super-admin cannot disable themselves.",
    });
  }

  if (
    userToUpdate.role === "super-admin" &&
    !isActive &&
    userToUpdate.isActive
  ) {
    const activeSuperAdminCount = await User.countDocuments({
      role: "super-admin",
      isActive: true,
    });
    if (activeSuperAdminCount <= 1) {
      logger.log({
        user: performingUser,
        page: "User",
        action: "Toggle User Active Status",
        req,
        message: `[LAST_SUPER_ADMIN_DISABLE_DENIED] Attempt to disable the last active super-admin: ${userToUpdate.email} by ${performingUser.email}.`,
        level: "warn",
      });
      return res.status(400).json({
        success: false,
        error: "Cannot disable the last active super-admin.",
      });
    }
  }

  userToUpdate.isActive = isActive;
  await userToUpdate.save();
  logger.log({
    user: performingUser,
    page: "User",
    action: "Toggle User Active Status",
    req,
    message: `[STATUS_TOGGLE_SUCCESS] User ${userToUpdate.email} status updated to ${isActive} by ${performingUser.email}.`,
    level: "info",
  });

  const responseUser = userToUpdate.toObject();
  delete responseUser.password;
  delete responseUser.__v;

  res.status(200).json({
    success: true,
    data: responseUser,
    message: `User ${userToUpdate.firstname} ${
      userToUpdate.lastname
    } has been ${isActive ? "enabled" : "disabled"}.`,
  });
});
