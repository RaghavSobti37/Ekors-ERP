const express = require("express");
const router = express.Router();
const multer = require("multer");
const challanController = require("../controllers/challanController");
const auth = require("../middleware/auth"); // Import the auth middleware

const storage = multer.memoryStorage();
const upload = multer({ storage });

// Routes
router.get("/", auth, challanController.getAllChallans);
router.post("/", auth, upload.single("media"), challanController.createChallan);
router.get("/:id", auth, challanController.getChallanById);
router.get("/:id/document", auth, challanController.getDocument);
router.put("/:id", auth, upload.single("media"), challanController.updateChallan);
router.delete("/:id", auth, challanController.deleteChallan);

module.exports = router;
