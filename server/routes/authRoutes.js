const express = require("express");
const router = express.Router();
const { registerUser, loginUser } = require("../controllers/authController");
const auth = require("../middleware/auth");

// @route   POST /register
// @desc    Register a new user
// @access  Public
router.post("/register", registerUser);

// @route   POST /login
// @desc    Login user
// @access  Public
router.post("/login", loginUser);

// @route   GET /verify
// @desc    Verify token
// @access  Private
router.get("/verify", auth, (req, res) => {
  console.log("[DEBUG] Token verification successful for:", req.user.email);
  res.json({ 
    user: req.user,
    message: "Token is valid" 
  });
});

module.exports = router;