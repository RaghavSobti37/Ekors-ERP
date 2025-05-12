const express = require("express");
const router = express.Router();
const {
    getAllUsers,
    registerUser,
    updateUser,
    deleteUser,
    getUser
} = require("../controllers/userController");
const { protect, authorize } = require("../middleware/auth");

// All routes protected and only accessible by super-admin
router.route("/")
    .get(protect, authorize("super-admin"), getAllUsers);

router.route("/register")
    .post(protect, authorize("super-admin"), registerUser);

router.route("/:id")
    .get(protect, authorize("super-admin"), getUser)
    .put(protect, authorize("super-admin"), updateUser)
    .delete(protect, authorize("super-admin"), deleteUser);

module.exports = router;