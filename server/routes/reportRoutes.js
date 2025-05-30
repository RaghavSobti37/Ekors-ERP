const express = require("express");
const router = express.Router();
const {
  getUserReport,
  generateUserReportPDF,
} = require("../controllers/reportController");
const auth = require("../middleware/auth");

// @desc    Get user report data
// @route   GET /api/reports/users/:userId
// @access  Private (Admin/Super-Admin)
router.get("/users/:userId", auth, (req, res, next) => {  // Keep existing middleware structure if other logic is there
  console.log(
    `[reportRoutes.js] Route HIT: GET /api/reports/users/:userId`
  );
  console.log(
    `[reportRoutes.js] Params: UserID=${req.params.userId}, Query=${JSON.stringify(req.query)}. Calling getUserReport controller.`
  );
  getUserReport(req, res, next); // Controller handles req, res, next
});


// @desc    Export user report to Excel
// @route   GET /api/reports/users/:userId/export-excel
// @access  Private (Admin/Super-Admin)
// router.get(
//   "/users/:userId/export-excel",
//   exportUserReportToExcel
// );

// @desc    Generate PDF report for user
// @route   GET /api/reports/users/:userId/generate-pdf
// @access  Private (Admin/Super-Admin)
router.get(
  "/users/:userId/generate-pdf", auth, (req, res, next) => {     console.log(
      `[reportRoutes.js] Route HIT: GET /api/reports/users/:userId/generate-pdf`
    );
    console.log(
      `[reportRoutes.js] Params: UserID=${req.params.userId}, Query=${JSON.stringify(req.query)}. Calling generateUserReportPDF controller.`
    );
    generateUserReportPDF(req, res, next); // Controller handles req, res, next
  }
);

module.exports = router;