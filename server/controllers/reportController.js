const User = require("../models/users");
const Quotation = require("../models/quotation");
const Ticket = require("../models/opentickets");
const LogTime = require("../models/LogTime");
const { formatDateRange } = require("../utils/helpers");
const PDFDocument = require("pdfkit");
const mongoose = require("mongoose");

// Helper function to calculate date ranges
const getDateRange = (period) => {
  console.log("[reportController.js] getDateRange: Calculating date range for period:", period);
  const now = new Date();
  let startDate;

  switch (period) {
    case "7days":
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "30days":
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case "90days":
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case "150days":
      startDate = new Date(now.getTime() - 150 * 24 * 60 * 60 * 1000);
      break;
    case "1year":
      const oneYearAgo = new Date(now); // Create a new Date object to avoid modifying 'now'
      startDate = new Date(oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1));
      break;
    case "financialYear":
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      startDate = currentMonth >= 3
        ? new Date(currentYear, 3, 1)
        : new Date(currentYear - 1, 3, 1);
      break;
    default:
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // Default to 7 days
      break;
  }

  const endDate = new Date();

  console.log("Calculated dates:", {
    start: startDate.toISOString(), // Ensure 'now' is not modified if '1year' case is hit first
    end: endDate.toISOString()
  });

  return { startDate, endDate };
};

// Helper to format Date object to "YYYY-MM-DD" string
const formatDateToYYYYMMDD = (dateObj) => {
  return dateObj.toISOString().split('T')[0];
};

// Internal function to fetch and process report data
async function getUserReportDataInternal(userId, period) {
  console.log(`[reportController.js] getUserReportDataInternal: Fetching data for userId: ${userId}, period: ${period}`);
  const { startDate, endDate } = getDateRange(period);

  console.log(`[reportController.js] getUserReportDataInternal: Date range - Start: ${startDate.toISOString()}, End: ${endDate.toISOString()}`);
  const user = await User.findById(userId).select(
    "firstname lastname email role createdAt"
  );

  if (!user) {
    console.warn(`[reportController.js] getUserReportDataInternal: User not found for ID: ${userId}`);
    throw new Error("User not found");
  }

  const userObjectId = new mongoose.Types.ObjectId(userId);
  console.log(`[reportController.js] getUserReportDataInternal: Converted userId to ObjectId: ${userObjectId}`);
  console.log("[reportController.js] getUserReportDataInternal: User found:", user._id);

  const quotations = await Quotation.aggregate([
    {
      $match: {
        user: userObjectId,
        createdAt: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        totalAmount: { $sum: "$grandTotal" },
      },
    },
  ]);
  console.log("[reportController.js] getUserReportDataInternal: Quotations aggregated:", quotations.length);

  const tickets = await Ticket.aggregate([
    {
      $match: {
        createdBy: userObjectId, // Assuming 'createdBy' field stores the user ID for tickets
        createdAt: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        totalAmount: { $sum: "$grandTotal" }, // Assuming tickets also have grandTotal
      },
    },
  ]);
  console.log("[reportController.js] getUserReportDataInternal: Tickets aggregated:", tickets.length);

  const startDateString = formatDateToYYYYMMDD(startDate);
  const endDateString = formatDateToYYYYMMDD(endDate);

  const logTimes = await LogTime.aggregate([
    {
      $match: {
        user: userObjectId,
        date: { $gte: startDateString, $lte: endDateString }, // Assuming LogTime.date is "YYYY-MM-DD" string
        "logs.timeSpent": { $exists: true, $ne: null, $ne: "" } // Ensure timeSpent exists and is not empty
      },
    },
    { $unwind: "$logs" }, // Consider { preserveNullAndEmptyArrays: true } if needed
    {
      $addFields: {
        // Attempt to parse timeSpent string (e.g., "HH:MM" or "MM") into total minutes
        timeSpentMinutes: {
          $let: {
            vars: {
              parts: { $split: ["$logs.timeSpent", ":"] }
            },
            in: {
              $cond: {
                if: { $eq: [{ $type: "$logs.timeSpent" }, "string"] }, // Process only if it's a string
                then: {
                  $cond: {
                    if: { $eq: [{ $size: "$$parts" }, 2] }, // "HH:MM" format
                    then: {
                      $add: [
                        { $multiply: [{ $toInt: { $arrayElemAt: ["$$parts", 0] } }, 60] }, // Hours to minutes
                        { $toInt: { $arrayElemAt: ["$$parts", 1] } }                      // Minutes
                      ]
                    },
                    else: {
                      $cond: {
                        if: { $eq: [{ $size: "$$parts" }, 1] }, // "MM" format (just minutes)
                        then: { $toInt: { $arrayElemAt: ["$$parts", 0] } },
                        else: 0 // Default to 0 if format is unexpected or not a parsable number string
                      }
                    }
                  }
                },
                else: { // If logs.timeSpent is already a number, use it directly. Otherwise, 0.
                  $cond: { if: { $isNumber: "$logs.timeSpent" }, then: "$logs.timeSpent", else: 0 }
                }
              }
            }
          }
        }
      }
    },
    {
      $group: {
        _id: null,
        totalTasks: { $sum: 1 },
        totalTimeSpent: { $sum: "$timeSpentMinutes" }, // Sum the parsed minutes
      },
    },
  ]);
  console.log("[reportController.js] getUserReportDataInternal: LogTimes aggregated:", logTimes.length);

  const quotationStats = { total: 0, open: 0, hold: 0, closed: 0, totalAmount: 0 };
  quotations.forEach((item) => {
    quotationStats.total += item.count;
    if (item._id === "open") quotationStats.open = item.count;
    else if (item._id === "hold") quotationStats.hold = item.count;
    else if (item._id === "closed") {
      quotationStats.closed = item.count;
      quotationStats.totalAmount = item.totalAmount || 0;
    }
  });

  const ticketStats = { total: 0, open: 0, hold: 0, closed: 0, totalAmount: 0 };
  tickets.forEach((item) => {
    ticketStats.total += item.count;
    if (item._id === "Closed") { ticketStats.closed = item.count; ticketStats.totalAmount = item.totalAmount || 0; }
    else if (item._id === "Hold") ticketStats.hold = item.count;
    else if (["Quotation Sent", "PO Received", "Payment Pending", "Inspection", "Packing List", "Invoice Sent"].includes(item._id)) ticketStats.open += item.count;
  });

  const logTimeStats = {
    totalTasks: logTimes.length > 0 ? logTimes[0].totalTasks : 0,
    totalTimeSpent: logTimes.length > 0 ? logTimes[0].totalTimeSpent : 0,
  };

  return {
    user: user.toObject(), // Convert Mongoose doc to plain object
    period: formatDateRange(startDate, endDate),
    quotationStats,
    ticketStats,
    logTimeStats,
  };
}

// @desc    Get user report data
// @route   GET /api/reports/users/:userId
// @access  Private
exports.getUserReport = async (req, res, next) => {
  try {
    console.log("[reportController.js] getUserReport: Received request for user report.");
    const { userId } = req.params;
    const { period = "7days" } = req.query;
    console.log(`[reportController.js] getUserReport: Params - userId: ${userId}, period: ${period}`);

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      console.warn(`[reportController.js] getUserReport: Invalid user ID: ${userId}`);
      return res.status(400).json({ success: false, error: "Invalid user ID" });
    }

    const reportPayload = await getUserReportDataInternal(userId, period);

    console.log("[reportController.js] getUserReport: Sending report data:", reportPayload);
    res.status(200).json({
      success: true,
      data: reportPayload,
    });
  } catch (err) {
    console.error("[reportController.js] getUserReport: Error fetching user report:", err);
    if (err.message === "User not found") {
        return res.status(404).json({ success: false, error: "User not found" });
    }
    res.status(500).json({ success: false, error: "Server Error while fetching user report.", details: err.message });
  }
};

// @route   GET /api/reports/users/:userId/export-excel
// @access  Private
// exports.exportUserReportToExcel = async (req, res, next) => {
//   try {
//     const { userId } = req.params;
//     const { period = "7days" } = req.query;

//     // First get the report data
//     const reportResponse = await this.getUserReportData(userId, period);
//     const { user, period: dateRange, quotationStats, ticketStats, logTimeStats } = reportResponse;

//     // Create a workbook
//     const workbook = new ExcelJS.Workbook();
//     const worksheet = workbook.addWorksheet("User Report");

//     // Add some metadata
//     worksheet.columns = [
//       { header: "User Report", key: "title", width: 30 },
//       { header: "Value", key: "value", width: 30 },
//     ];

//     worksheet.addRow({ title: "Report For", value: `${user.firstname} ${user.lastname}` });
//     worksheet.addRow({ title: "Email", value: user.email });
//     worksheet.addRow({ title: "Role", value: user.role });
//     worksheet.addRow({ title: "Period", value: dateRange });
//     worksheet.addRow({});

//     // Add Quotation Stats
//     worksheet.addRow({ title: "Quotation Statistics", value: "" });
//     worksheet.addRow({ title: "Total Quotations", value: quotationStats.total });
//     worksheet.addRow({ title: "Open Quotations", value: quotationStats.open });
//     worksheet.addRow({ title: "Hold Quotations", value: quotationStats.hold });
//     worksheet.addRow({ title: "Closed Quotations", value: quotationStats.closed });
//     worksheet.addRow({ title: "Total Amount (All)", value: quotationStats.totalAmount });
//     worksheet.addRow({ title: "Total Amount (Closed)", value: quotationStats.closedAmount });
//     worksheet.addRow({});

//     // Add Ticket Stats
//     worksheet.addRow({ title: "Ticket Statistics", value: "" });
//     worksheet.addRow({ title: "Total Tickets", value: ticketStats.total });
//     worksheet.addRow({ title: "Open Tickets", value: ticketStats.open });
//     worksheet.addRow({ title: "Hold Tickets", value: ticketStats.hold });
//     worksheet.addRow({ title: "Closed Tickets", value: ticketStats.closed });
//     worksheet.addRow({ title: "Total Amount (All)", value: ticketStats.totalAmount });
//     worksheet.addRow({ title: "Total Amount (Closed)", value: ticketStats.closedAmount });
//     worksheet.addRow({});

//     // Add Log Time Stats
//     worksheet.addRow({ title: "Time Log Statistics", value: "" });
//     worksheet.addRow({ title: "Total Tasks Logged", value: logTimeStats.totalTasks });
//     worksheet.addRow({ title: "Total Time Spent (hours)", value: (logTimeStats.totalTimeSpent / 60).toFixed(2) });

//     // Style the header row
//     worksheet.getRow(1).font = { bold: true };
//     worksheet.getRow(7).font = { bold: true };
//     worksheet.getRow(15).font = { bold: true };
//     worksheet.getRow(23).font = { bold: true };

//     // Set response headers
//     res.setHeader(
//       "Content-Type",
//       "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
//     );
//     res.setHeader(
//       "Content-Disposition",
//       `attachment; filename=user-report-${user.firstname}-${user.lastname}.xlsx`
//     );

//     // Write to response
//     await workbook.xlsx.write(res);
//     res.end();
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ success: false, error: "Server Error" });
//   }
// };

// @desc    Generate PDF report for user
// @route   GET /api/reports/users/:userId/generate-pdf
// @access  Private
exports.generateUserReportPDF = async (req, res, next) => {
  try {
    console.log("[reportController.js] generateUserReportPDF: Received request to generate PDF.");
    const { userId } = req.params;
    const { period = "7days" } = req.query;
    console.log(`[reportController.js] generateUserReportPDF: Params - userId: ${userId}, period: ${period}`);

    // Add validation
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      console.error("[reportController.js] generateUserReportPDF: Invalid user ID:", userId);
      return res.status(400).json({ error: "Invalid user ID" });
    }

    console.log("[reportController.js] generateUserReportPDF: Fetching report data for PDF.");
    const reportData = await getUserReportDataInternal(userId, period); // Use the internal function
    console.log("[reportController.js] generateUserReportPDF: Report data fetched:", reportData);
    
    // Before creating PDF, verify data exists
    if (!reportData || !reportData.user) { // Check reportData itself first
      throw new Error("No user data found");
    }

    // Destructure data for easier access in PDF generation
    const {
      user, // This 'user' object comes from reportData
      period: dateRange, // 'period' from reportData, aliased to dateRange
      quotationStats,
      ticketStats,
      logTimeStats,
    } = reportData;

    // Create PDF document
    const doc = new PDFDocument({ margin: 30 });

    // Set response headers
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
     `attachment; filename=user-report-${user.firstname}-${user.lastname}.pdf`
    );

    // Pipe to response
    doc.pipe(res);

    console.log("[reportController.js] generateUserReportPDF: Starting PDF content generation.");
    // Add content with error handling
    doc.fontSize(18).text("User Activity Report", { align: "center" });
    doc.moveDown();

    // User Information Section
    doc.fontSize(12).text(`Report for: ${user.firstname} ${user.lastname}`);
    doc.text(`Email: ${user.email}`);
    doc.text(`Role: ${user.role}`);
    doc.text(`Report Period: ${dateRange}`);
    doc.moveDown();

    // Quotation Statistics
    doc.fontSize(14).text("Quotation Statistics:", { underline: true });
    doc.fontSize(12)
      .text(`Total Quotations: ${quotationStats.total}`)
      .text(`Open: ${quotationStats.open} | Hold: ${quotationStats.hold} | Closed: ${quotationStats.closed}`)
      .text(`Total Amount (Closed): ₹${(quotationStats.totalAmount || 0).toFixed(2)}`);
    doc.moveDown();

    // Ticket Statistics
    doc.fontSize(14).text("Ticket Statistics:", { underline: true });
    doc.fontSize(12)
      .text(`Total Tickets: ${ticketStats.total}`)
      .text(`Open: ${ticketStats.open} | Hold: ${ticketStats.hold} | Closed: ${ticketStats.closed}`)
      .text(`Total Amount (Closed): ₹${(ticketStats.totalAmount || 0).toFixed(2)}`);
    doc.moveDown();

    // Time Log Statistics
    doc.fontSize(14).text("Time Logs:", { underline: true });
    doc.fontSize(12)
      .text(`Total Tasks: ${logTimeStats.totalTasks}`)
      .text(`Total Hours: ${((logTimeStats.totalTimeSpent || 0) / 60).toFixed(2)}`);
    doc.moveDown();

    // Footer
    doc.fontSize(10)
      .text(`Generated on ${new Date().toLocaleDateString()}`, { align: "right" });

    // Finalize PDF
    doc.end();
    console.log("[reportController.js] generateUserReportPDF: PDF generation complete and sent.");
  } catch (err) {
    console.error("[reportController.js] generateUserReportPDF: PDF Generation Error:", err);
    if (err.message === "User not found") { // Handle specific error from getUserReportDataInternal
      if (!res.headersSent) {
        return res.status(404).json({ success: false, error: "User not found for PDF generation" });
      }
    }
    if (!res.headersSent) {
      console.error("[reportController.js] generateUserReportPDF: Sending 500 error response.");
      res.status(500).json({ success: false, error: "Failed to generate PDF", details: err.message });
    }
  }
};

// fetchReport(); // Commented out: This was likely a test call and can cause issues on server start.
