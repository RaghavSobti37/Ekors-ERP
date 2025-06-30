const User = require("../models/users");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const logger = require("../logger");

exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      logger.log({
        user: { email },
        page: "Login",
        action: "Login Attempt",
        api: req.originalUrl,
        req,
        message: "Missing email or password",
        details: {},
        level: "warn",
      });
      return res
        .status(400)
        .json({ error: "Email and password are required." });
    }

    const user = await User.findOne({ email });
    if (!user) {
      logger.log({
        user: { email },
        page: "Login",
        action: "Login Attempt",
        api: req.originalUrl,
        req,
        message: "Invalid email",
        details: {},
        level: "warn",
      });
      return res.status(400).json({ error: "Invalid email" });
    }

    if (user.isActive === false) {
      logger.log({
        user: { email },
        page: "Login",
        action: "Login Attempt",
        api: req.originalUrl,
        req,
        message: "Account is disabled",
        details: {},
        level: "warn",
      });
      return res
        .status(403)
        .json({ error: "Account is disabled. Please contact administrator." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      logger.log({
        user: { email },
        page: "Login",
        action: "Login Attempt",
        api: req.originalUrl,
        req,
        message: "Invalid password",
        details: {},
        level: "warn",
      });
      return res.status(400).json({ error: "Invalid password." });
    }

    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
        email: user.email,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    logger.log({
      user: { email: user.email, id: user._id },
      page: "Login",
      action: "Login Success",
      api: req.originalUrl,
      req,
      message: "User logged in successfully",
      details: {},
      level: "info",
    });

    res.json({
      token,
      user: {
        id: user._id,
        firstname: user.firstname,
        lastname: user.lastname,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (err) {
    logger.log({
      user: { email: req.body?.email },
      page: "Login",
      action: "Login Error",
      api: req.originalUrl,
      req,
      message: "Login process failed",
      details: { error: err.message },
      level: "error",
    });
    res.status(500).json({ error: "Login failed. Please try again." });
  }
};
