const express = require("express");
const bcrypt = require("bcrypt");
const User = require("../models/users");
const auth = require("../middleware/auth");
const { check, validationResult } = require("express-validator");
const userController = require("../controllers/userController"); // Import userController
const logger = require("../utils/logger"); // Import logger

const router = express.Router();

// Middleware to check for super-admin role
const requireSuperAdmin = (req, res, next) => {
  if (req.user && req.user.role === "super-admin") {
    next();
  } else {
    res.status(403).json({ error: "Forbidden: Super-admin access required" });
  }
};

// GET /api/users - Fetch all users (Super-admin only)
// Now uses the controller which has its own super-admin check,
// but requireSuperAdmin middleware provides an early exit and consistent route protection.
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
        return res
          .status(400)
          .json({ error: "User already exists with this email" });
      }

      user = new User({
        firstname,
        lastname,
        email,
        phone,
        role,
        password,
        isActive: true, // Make sure this is set
      });

      await user.save();
      // Don't send back password hash
      const userResponse = user.toObject();
      delete userResponse.password;
      delete userResponse.__v;

      logger.info("user", "User created successfully", req.user, {
        userId: userResponse._id,
        email: userResponse.email,
        role: userResponse.role,
      });

      res.status(201).json(userResponse);
      // Logging for user creation is now in userController.js
    } catch (err) {
      console.error("Error creating user:", err);
      res.status(500).json({ error: "Server error while creating user" });
    }
  }
);

// PUT /api/users/:id - Update a user (Super-admin only)
router.put(
  "/:id",
  auth,
  requireSuperAdmin,
  [
    check("firstname", "First name is required")
      .optional({ checkFalsy: true })
      .not()
      .isEmpty(),
    check("lastname", "Last name is required")
      .optional({ checkFalsy: true })
      .not()
      .isEmpty(),
    check("role", "Role is required")
      .optional()
      .isIn(["user", "admin", "super-admin"]),
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
        // Logging for not found is in userController.js
        return res.status(404).json({ error: "User not found" });
      }

      // Prevent super-admin from being demoted if they are the only one
      if (
        userToUpdate.role === "super-admin" &&
        role &&
        role !== "super-admin"
      ) {
        const superAdminCount = await User.countDocuments({
          role: "super-admin",
        });
        if (
          superAdminCount <= 1 &&
          userToUpdate._id.toString() === req.user.id
        ) {
          // Check if it's the same user and last SA
          return res
            .status(400)
            .json({ error: "Cannot demote the last super-admin." });
          // Logging for this specific case is in userController.js
        }
        if (
          superAdminCount <= 1 &&
          userToUpdate.role === "super-admin" &&
          role !== "super-admin"
        ) {
          return res
            .status(400)
            .json({ error: "Cannot demote the only super-admin." });
          // Logging for this specific case is in userController.js
        }
      }
      // Only a super-admin can assign/change to super-admin role
      if (role === "super-admin" && req.user.role !== "super-admin") {
        return res.status(403).json({
          error: "Forbidden: Only super-admins can assign super-admin role.",
        });
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
      ).select("-password -__v");

      logger.info("user", "User updated successfully", req.user, {
        updatedUserId: updatedUser._id,
        email: updatedUser.email,
        role: updatedUser.role,
      });

      res.json(updatedUser);
    } catch (err) {
      console.error("Error updating user:", err);
      if (err.kind === "ObjectId") {
        return res.status(400).json({ error: "Invalid user ID format" });
      }
      res.status(500).json({ error: "Server error while updating user" });
    }
  }
);

// DELETE /api/users/:id - Delete a user (Super-admin only)
// Logging for delete is in userController.js
// Now calls the controller method which includes backup logic
router.delete("/:id", auth, requireSuperAdmin, userController.deleteUser);

// POST /api/auth/login - Authenticate user & get token
router.post(
  "/auth/login",
  [
    check("email", "Please include a valid email").isEmail(),
    check("password", "Password is required").exists(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
      let user = await User.findOne({ email });

      if (!user) {
        logger.warn("login", `Login attempt failed: User not found`, null, {
          email,
        });
        return res.status(400).json({ error: "Invalid Credentials" });
      }

      const isMatch = await user.comparePassword(password);

      if (!isMatch) {
        logger.warn("login", `Login attempt failed: Incorrect password`, user, {
          email,
        }); // Pass the fetched user object
        return res.status(400).json({ error: "Invalid Credentials" });
      }

      // Assuming generateAuthToken method exists on your User model
      const token = user.generateAuthToken();
      logger.info("login", `User logged in successfully`, user, {
        userId: user._id,
        email: user.email,
        role: user.role,
      });
      res.json({
        token,
        userId: user._id,
        email: user.email,
        role: user.role,
        firstname: user.firstname,
        lastname: user.lastname,
      }); // Send back user info
    } catch (err) {
      logger.error("login", `Server error during login process`, err, null, {
        email,
      });
      res.status(500).send("Server error");
    }
  }
);

// GET /api/users/transfer-candidates - Fetch users suitable for ticket transfer (Authenticated users)
router.get(
  "/transfer-candidates",
  auth, // Ensures the user is authenticated
  userController.getTransferCandidates // Uses the new controller function
);

module.exports = router;
