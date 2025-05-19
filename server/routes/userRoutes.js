const express = require("express");
const router = express.Router();
const {
  getAllUsers,
  registerUser,
  updateUser,
  deleteUser,
  getUser
} = require("../controllers/userController");
const { auth } = require("../middleware/auth");

// Apply auth middleware to specific routes (better than router.use() for async middleware)
router.get("/", auth, getAllUsers);
router.post("/register", auth, registerUser);
router.get("/:id", auth, getUser);
router.put("/:id", auth, updateUser);
router.delete("/:id", auth, deleteUser);

module.exports = router;