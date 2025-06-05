const express = require("express");
const auth = require("../middleware/auth");
const { check, validationResult } = require("express-validator");
const userController = require("../controllers/userController");
const logger = require("../utils/logger");
const router = express.Router();

// Middleware to check for super-admin role
const requireSuperAdmin = (req, res, next) => {
  if (req.user && req.user.role === "super-admin") {
    next();
  } else {
    logger.warn('auth-middleware', `Unauthorized access attempt by ${req.user?.email || 'unknown'}`, req.user);
    return res.status(403).json({ 
      success: false,
      error: "Forbidden: Super-admin access required" 
    });
  }
};

// GET all users
router.get("/", auth, requireSuperAdmin, userController.getAllUsers);

// Create new user
router.post(
  "/",
  auth,
  requireSuperAdmin,
  [
    check("firstname", "First name is required").not().isEmpty().trim(),
    check("lastname", "Last name is required").not().isEmpty().trim(),
    check("email", "Please include a valid email").isEmail().normalizeEmail(),
    check("password", "Password must be at least 6 characters").isLength({ min: 6 }),
    check("role", "Invalid role").isIn(["user", "admin", "super-admin"]),
    check("phone").optional().isLength({ max: 15 })
  ],
  userController.createUser
);

// Update user
router.put(
  "/:id",
  auth,
  requireSuperAdmin,
  [
    check("firstname").optional().not().isEmpty().trim(),
    check("lastname").optional().not().isEmpty().trim(),
    check("email").optional().isEmail().normalizeEmail(),
    check("role").optional().isIn(["user", "admin", "super-admin"]),
    check("phone").optional().isLength({ max: 15 }),
    check("password").optional().isLength({ min: 6 })
  ],
  userController.updateUser
);

// Delete user
router.delete("/:id", auth, requireSuperAdmin, userController.deleteUser);

// Get single user
router.get("/:id", auth, requireSuperAdmin, userController.getUser);

// Toggle user status
router.patch(
  "/:id/status",
  auth,
  requireSuperAdmin,
  userController.toggleUserActiveStatus
);

// The route GET /api/users/transfer-candidates has been removed from here
// and its logic moved to ticketController.js and ticketRoutes.js

// The following routes related to profile picture uploads have been removed:
// - POST /api/users/profile/avatar (for uploading avatar)
// - The userController.uploadUserAvatar function has been removed.
// - Multer setup for avatar uploads (if it was specific to this route file) has been removed.
// The `avatarUrl` field may still exist in the User model and database,
// but the functionality to upload or update it via the API has been removed.

module.exports = router;