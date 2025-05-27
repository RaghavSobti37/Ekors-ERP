const express = require("express");
const router = express.Router();
const multer = require("multer");
const challanController = require("../controllers/challanController");

const storage = multer.memoryStorage();
const upload = multer({ storage });

// Routes
router.get("/", challanController.getAllChallans);
router.post("/", upload.single("media"), challanController.createChallan);
router.get("/:id", challanController.getChallanById);
router.get("/:id/document", challanController.getDocument);
router.put("/:id", upload.single("media"), challanController.updateChallan);
router.delete("/:id", challanController.deleteChallan); // Added delete route

module.exports = router;
