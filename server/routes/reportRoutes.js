const express = require("express");
const router = express.Router();
const {
  getUserReport,
  exportUserReportToExcel,
  generateUserReportPDF,
  generateQuotationsReport, // Import the quotations report controller
  generateTicketsReport, // Import the new tickets report controller
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
router.get(
  "/users/:userId/export-excel",
  auth,
  exportUserReportToExcel
);

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

// @desc    Get quotations report summary
// @route   GET /api/reports/quotations
// @access  Private
router.get("/quotations", auth, (req, res, next) => {
  console.log(`[reportRoutes.js] Route HIT: GET /api/reports/quotations. Query=${JSON.stringify(req.query)}`);
  generateQuotationsReport(req, res, next);
});

// @desc    Export quotations report to Excel
// @route   GET /api/reports/quotations/export
// @access  Private
router.get("/quotations/export", auth, (req, res, next) => {
  console.log(`[reportRoutes.js] Route HIT: GET /api/reports/quotations/export. Query=${JSON.stringify(req.query)}. Forcing exportToExcel=true.`);
  req.query.exportToExcel = "true"; // Ensure the controller knows to export
  generateQuotationsReport(req, res, next);
});

// @desc    Get tickets report summary or export to Excel
// @route   GET /api/reports/tickets
// @access  Private
router.get("/tickets", auth, (req, res, next) => {
  console.log(`[reportRoutes.js] Route HIT: GET /api/reports/tickets. Query=${JSON.stringify(req.query)}`);
  generateTicketsReport(req, res, next); // Controller handles exportToExcel query param internally
});

module.exports = router;