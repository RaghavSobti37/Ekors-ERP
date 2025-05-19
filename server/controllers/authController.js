const User = require("../models/users");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

exports.registerUser = async (req, res) => {
  console.log("[DEBUG] Register request received:", req.body);
  
  try {
    const { firstname, lastname, email, phone, password } = req.body;
    
    // Validate input
    if (!firstname || !lastname || !email || !password) {
      console.log("[DEBUG] Validation failed - missing required fields");
      return res.status(400).json({ error: "All fields are required." });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log("[DEBUG] User already exists with email:", email);
      return res.status(400).json({ error: "User already exists with this email." });
    }

    // Create user
    const user = new User({
      firstname,
      lastname,
      email,
      phone,
      password,
      role: "user" // Default role
    });

    await user.save();
    console.log("[DEBUG] User registered successfully:", user.email);
    
    res.status(201).json({ 
      message: "User registered successfully.",
      user: {
        id: user._id,
        firstname: user.firstname,
        lastname: user.lastname,
        email: user.email,
        role: user.role
      }
    });

  } catch (err) {
    console.error("[ERROR] Registration error:", err);
    res.status(500).json({ 
      error: "Registration failed.",
      details: err.message 
    });
  }
};

exports.loginUser = async (req, res) => {
  console.log("[DEBUG] Login attempt for email:", req.body.email);
  
  try {
    const { email, password } = req.body;
    
    // Validate input
    if (!email || !password) {
      console.log("[DEBUG] Missing email or password");
      return res.status(400).json({ error: "Email and password are required." });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      console.log("[DEBUG] User not found for email:", email);
      return res.status(400).json({ error: "Invalid email or password." });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log("[DEBUG] Password mismatch for user:", email);
      return res.status(400).json({ error: "Invalid email or password." });
    }

    // Generate token
    const token = jwt.sign(
      { 
        id: user._id, 
        role: user.role, 
        email: user.email 
      },
      process.env.JWT_SECRET,
      { expiresIn: "2d" }
    );

    console.log("[DEBUG] Login successful for user:", email);
    
    res.json({
      token,
      user: {
        id: user._id,
        firstname: user.firstname,
        lastname: user.lastname,
        email: user.email,
        phone: user.phone,
        role: user.role
      },
    });

  } catch (err) {
    console.error("[ERROR] Login error:", err);
    res.status(500).json({ 
      error: "Login failed",
      details: err.message 
    });
  }
};