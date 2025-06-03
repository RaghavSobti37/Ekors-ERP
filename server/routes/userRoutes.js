const express = require("express");
// User model import might not be needed here if all logic is in controller
// const User = require("../models/users"); 
const auth = require("../middleware/auth");
const { check, validationResult } = require("express-validator");
const userController = require("../controllers/userController"); // Import userController
const logger = require("../utils/logger");
// Import the avatar upload middleware and error handler from userController
const { 
  avatarUploadMiddleware, 
  handleAvatarUploadError } = require("../controllers/userController");
const multer = require("multer");
const path = require("path");
const fs = require('fs'); // For mkdirSync if enabling avatar path creation
const router = express.Router();
const {
    getUserProfile // Assuming getUserProfile is exported from userController
} = require('../controllers/userController'); 

// Ensure this route is defined BEFORE any routes with dynamic IDs like /:id
router.get(
  "/transfer-candidates",
  auth, // Ensures the user is authenticated
  userController.getTransferCandidates // Uses the new controller function
);

router.get('/profile', auth, getUserProfile);

// Middleware to check for super-admin role
const requireSuperAdmin = (req, res, next) => {
  if (req.user && req.user.role === "super-admin") {
    next();
  } else {
    logger.warn('auth-middleware', `[AUTH_FORBIDDEN] User ${req.user?.email || 'Unknown'} (Role: ${req.user?.role || 'N/A'}) attempted super-admin action on ${req.originalUrl}`, req.user);
    res.status(403).json({ error: "Forbidden: Super-admin access required" });
  }
};

// --- User Management Routes (Super-Admin) ---

// GET /api/users - Fetch all users
router.get("/", auth, requireSuperAdmin, userController.getAllUsers);

// POST /api/users - Create a new user (Super-admin only)
router.post(
  "/",
  auth,
  requireSuperAdmin,
  [
    check("firstname", "First name is required").not().isEmpty(),
    check("lastname", "Last name is required").not().isEmpty(),
    check("email", "Please include a valid email").isEmail(),
    check(
      "password",
      "Password is required and must be at least 5 characters"
    ).isLength({ min: 5 }),
    check("role", "Role is required").isIn(["user", "admin", "super-admin"]),
    // Custom validation for phone (optional, but if present, must be reasonable)
    check("phone")
      .optional({ checkFalsy: true })
      .isString()
      .withMessage("Phone number must be a string")
      .isLength({ min: 7, max: 15 }) // Example length, adjust as needed
      .withMessage("Phone number must be between 7 and 15 digits")
      .matches(/^[+]?[0-9\s\-()]*$/) // Allows digits, spaces, hyphens, parens, optional leading +
      .withMessage("Phone number contains invalid characters"),
  ],
  (req, res, next) => { // Middleware to handle validation results before controller
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('validation-error', `User creation/update validation failed for ${req.user?.email}`, req.user, { errors: errors.array(), path: req.originalUrl });
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
  userController.createUser // Call the controller function
);

// PUT /api/users/:id - Update a user
router.put(
  "/:id",
  auth,
  requireSuperAdmin,
  [ // Validation middleware
    check("firstname")
      .optional()
      .not().isEmpty().withMessage("First name cannot be empty if provided"),
    check("lastname")
      .optional()
      .not().isEmpty().withMessage("Last name cannot be empty if provided"),
    check("email")
      .optional()
      .isEmail().withMessage("Please include a valid email if provided"),
    check("role")
      .optional()
      .isIn(["user", "admin", "super-admin"]).withMessage("Invalid role specified"),
    check("phone")
      .optional({ checkFalsy: true }) // Allows empty string to clear phone
      .isString().withMessage("Phone number must be a string")
      .isLength({ max: 15 }) // Max length, min can be 0 if clearing
      .withMessage("Phone number is too long (max 15 chars)")
      .matches(/^[+]?[0-9\s\-()]*$/)
      .withMessage("Phone number contains invalid characters if provided"),
  ],
  (req, res, next) => { // Middleware to handle validation results
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('validation-error', `User update validation failed for ${req.user?.email} targeting user ${req.params.id}`, req.user, { errors: errors.array(), path: req.originalUrl });
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
  userController.updateUser // Call the controller function
);

// DELETE /api/users/:id - Delete a user (Super-admin only)
router.delete("/:id", auth, requireSuperAdmin, userController.deleteUser);

// Ensure this route is defined AFTER specific routes like /transfer-candidates or /profile
// GET /api/users/:id - Get a single user's details
router.get("/:id", auth, requireSuperAdmin, userController.getUser);


// PATCH /api/users/:id/status - Toggle user active status
router.patch(
  "/:id/status",
  auth,
  requireSuperAdmin,
  userController.toggleUserActiveStatus
);

// --- Profile Management Routes (Authenticated User for Themselves) ---

// PATCH /api/users/profile - User updates their own profile (phone, password)
router.patch(
  "/profile", // Note: No /:id, user is derived from token
  auth,
  [ // Validation for self-update
    check("phone")
      .optional({ checkFalsy: true })
      .isString().withMessage("Phone number must be a string")
      .isLength({ max: 15 }).withMessage("Phone number is too long (max 15 chars)")
      .matches(/^[+]?[0-9\s\-()]*$/).withMessage("Phone number contains invalid characters if provided"),
    check("password") // For password change
      .optional()
      .isLength({ min: 5 }).withMessage("New password must be at least 5 characters if provided")
  ],
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('validation-error', `User self-profile update validation failed for ${req.user?.email}`, req.user, { errors: errors.array(), path: req.originalUrl });
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
  userController.updateUserProfile
);

// POST /api/users/profile/avatar - User uploads their own avatar
router.post(
  "/profile/avatar", // Note: No /:id
  auth,
  avatarUploadMiddleware, // Use middleware from userController
  userController.uploadUserAvatar,
  handleAvatarUploadError // Use error handler from userController
);

module.exports = router;
