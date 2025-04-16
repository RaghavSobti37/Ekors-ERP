const User = require("../models/user");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

exports.registerUser = async (req, res) => {
  try {
    const user = new User(req.body);
    await user.save();
    res.status(201).json({ message: "User registered successfully." });
  } catch (err) {
    res.status(400).json({ error: "User already exists or invalid data." });
  }
};

exports.loginUser = async (req, res) => {
    try {
      const { email, password } = req.body;
      const user = await User.findOne({ email });
  
      if (!user || !user.password) {
        return res.status(400).json({ error: "Invalid email or password." });
      }
  
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ error: "Invalid email or password." });
      }
  
      const token = jwt.sign(
        { id: user._id, role: user.role, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: "2d" }
      );
  
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
      console.error("Login error:", err);
      return res.status(500).json({ error: "Server error", message: err.message });
    }
  };