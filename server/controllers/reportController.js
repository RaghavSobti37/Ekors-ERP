const User = require("../models/users");
const Quotation = require("../models/quotation");
const Ticket = require("../models/opentickets");
const LogTime = require("../models/LogTime");
const { formatDateRange } = require("../utils/helpers");
const logger = require("../logger"); // Import logger
const PDFDocument = require("pdfkit");
const mongoose = require("mongoose");
const xlsx = require("xlsx"); // For Excel export
const excelJS = require('exceljs');

// Helper function to calculate date ranges
const getDateRange = (period) => {
  const now = new Date();
  let startDate;
  let endDate = new Date(); // Initialize endDate to now

  switch (
    period?.toLowerCase() // Handle potential null/undefined period
  ) {
    case "7days":
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "30days":
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case "90days":
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case "1year":
      const oneYearAgo = new Date(now); // Create a new Date object to avoid modifying 'now'
      startDate = new Date(
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
      );
      break;
    case "financialYear":
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      startDate =
        currentMonth >= 3
          ? new Date(currentYear, 3, 1)
          : new Date(currentYear - 1, 3, 1);
      break;
    case "all":
      startDate = null; // No start date for "all"
      endDate = null; // No end date for "all"
      break;
    default:
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // Default to 7 days
      break;
  }

  // For periods other than 'all', set time to start/end of day
  if (startDate) startDate.setHours(0, 0, 0, 0);
  if (endDate) endDate.setHours(23, 59, 59, 999);

  logger.debug(
    "report-getDateRange",
    `Calculated date range for period: ${period}`,
    null,
    { start: startDate?.toISOString(), end: endDate?.toISOString() }
  );

  return { startDate, endDate };
};

// Helper to format Date object to "YYYY-MM-DD" string
const formatDateToYYYYMMDD = (dateObj) => {
  return dateObj.toISOString().split("T")[0];
};

// Internal function to fetch and process report data
async function getUserReportDataInternal(userId, period) {
  logger.debug(
    "report-internal",
    `Fetching data for userId: ${userId}, period: ${period}`
  );
  const { startDate, endDate } = getDateRange(period);

  logger.debug(
    "report-internal",
    `Date range - Start: ${startDate.toISOString()}, End: ${endDate.toISOString()}`
  );
  const user = await User.findById(userId).select(
    "firstname lastname email role createdAt"
  );

  if (!user) {
    logger.log({
      user: { id: userId },
      page: "Report",
      action: "Error",
      api: "/api/reports/users/:userId",
      req: null,
      message: `User not found for ID: ${userId}`,
      details: {},
      level: "error"
    });
    throw new Error("User not found");
  }

  const userObjectId = new mongoose.Types.ObjectId(userId);
  logger.debug(
    "report-internal",
    `User found: ${user._id}, Converted userId to ObjectId: ${userObjectId}`
  );

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
  logger.debug(
    "report-internal",
    `Quotations aggregated: ${quotations.length}`
  );

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
  logger.debug("report-internal", `Tickets aggregated: ${tickets.length}`);

  const startDateString = formatDateToYYYYMMDD(startDate);
  const endDateString = formatDateToYYYYMMDD(endDate);

  const logTimes = await LogTime.aggregate([
    {
      $match: {
        user: userObjectId,
        date: { $gte: startDateString, $lte: endDateString }, // Assuming LogTime.date is "YYYY-MM-DD" string
        "logs.timeSpent": { $exists: true, $ne: null, $ne: "" }, // Ensure timeSpent exists and is not empty
      },
    },
    { $unwind: "$logs" }, // Consider { preserveNullAndEmptyArrays: true } if needed
    {
      $addFields: {
        // Attempt to parse timeSpent string (e.g., "HH:MM" or "MM") into total minutes
        timeSpentMinutes: {
          $let: {
            vars: {
              parts: { $split: ["$logs.timeSpent", ":"] },
            },
            in: {
              $cond: {
                if: { $eq: [{ $type: "$logs.timeSpent" }, "string"] }, // Process only if it's a string
                then: {
                  $cond: {
                    if: { $eq: [{ $size: "$$parts" }, 2] }, // "HH:MM" format
                    then: {
                      $add: [
                        {
                          $multiply: [
                            {
                              $convert: {
                                input: { $arrayElemAt: ["$$parts", 0] },
                                to: "int",
                                onError: 0,
                                onNull: 0,
                              },
                            },
                            60,
                          ],
                        }, // Hours to minutes
                        {
                          $convert: {
                            input: { $arrayElemAt: ["$$parts", 1] },
                            to: "int",
                            onError: 0,
                            onNull: 0,
                          },
                        }, // Minutes// Minutes
                      ],
                    },
                    else: {
                      $cond: {
                        if: { $eq: [{ $size: "$$parts" }, 1] }, // "MM" format (just minutes)
                        then: {
                          $convert: {
                            input: { $arrayElemAt: ["$$parts", 0] },
                            to: "int",
                            onError: 0,
                            onNull: 0,
                          },
                        },
                        else: 0, // Default to 0 if format is unexpected or not a parsable number string
                      },
                    },
                  },
                },
                else: {
                  // If logs.timeSpent is already a number, use it directly. Otherwise, 0.
                  $cond: {
                    if: { $isNumber: "$logs.timeSpent" },
                    then: "$logs.timeSpent",
                    else: {
                      // Attempt to convert if it's a string that's just a number, e.g., "120"
                      $cond: {
                        if: { $eq: [{ $type: "$logs.timeSpent" }, "string"] },
                        then: {
                          $convert: {
                            input: "$logs.timeSpent",
                            to: "int",
                            onError: 0,
                            onNull: 0,
                          },
                        },
                        else: 0, // Default to 0 if not a number and not a string that can be converted
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    {
      $group: {
        _id: null,
        totalTasks: { $sum: 1 },
        totalTimeSpent: { $sum: "$timeSpentMinutes" }, // Sum the parsed minutes
      },
    },
  ]);
  logger.debug(
    "report-internal",
    `LogTimes aggregated: ${
      logTimes.length > 0 ? logTimes[0].totalTasks : 0
    } tasks, ${logTimes.length > 0 ? logTimes[0].totalTimeSpent : 0} minutes`
  );

  const quotationStats = {
    total: 0,
    open: 0,
    hold: 0,
    closed: 0,
    totalAmount: 0,
  };
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
    if (item._id === "Closed") {
      ticketStats.closed = item.count;
      ticketStats.totalAmount = item.totalAmount || 0;
    } else if (item._id === "Hold") ticketStats.hold = item.count;
    else if (
      [
        "Quotation Sent",
        "PO Received",
        "Payment Pending",
        "Inspection",
        "Packing List",
        "Invoice Sent",
      ].includes(item._id)
    )
      ticketStats.open += item.count;
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
    const { userId } = req.params;
    const { period = "7days" } = req.query;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
    
      return res.status(400).json({ success: false, error: "Invalid user ID" });
    }

    const reportPayload = await getUserReportDataInternal(userId, period);

    res.status(200).json({
      success: true,
      data: reportPayload,
    });
  } catch (err) {
    logger.log({
      user: req.user,
      page: "Report",
      action: "Error",
      api: req.originalUrl,
      req,
      message: `Error fetching user report for UserId: ${req.params.userId}`,
      details: { error: err.message, stack: err.stack },
      level: "error"
    });
    if (err.message === "User not found") {
      return res.status(404).json({ success: false, error: "User not found" });
    }
    res
      .status(500)
      .json({
        success: false,
        error: "Server Error while fetching user report.",
        details: err.message,
      });
  }
};

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
    const { userId } = req.params;
    const { period = "7days" } = req.query;

    // Add validation
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    const reportData = await getUserReportDataInternal(userId, period); // Use the internal function
    logger.debug(
      "report-generatePDF",
      `Report data fetched for PDF for UserId: ${userId}`,
      req.user
    );

    // Before creating PDF, verify data exists
    if (!reportData || !reportData.user) {
      // Check reportData itself first
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

    logger.debug(
      "report-generatePDF",
      `Starting PDF content generation for UserId: ${userId}`,
      req.user
    );
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
    doc
      .fontSize(12)
      .text(`Total Quotations: ${quotationStats.total}`)
      .text(
        `Open: ${quotationStats.open} | Hold: ${quotationStats.hold} | Closed: ${quotationStats.closed}`
      )
      .text(
        `Total Amount (Closed): ₹${(quotationStats.totalAmount || 0).toFixed(
          2
        )}`
      );
    doc.moveDown();

    // Ticket Statistics
    doc.fontSize(14).text("Ticket Statistics:", { underline: true });
    doc
      .fontSize(12)
      .text(`Total Tickets: ${ticketStats.total}`)
      .text(
        `Open: ${ticketStats.open} | Hold: ${ticketStats.hold} | Closed: ${ticketStats.closed}`
      )
      .text(
        `Total Amount (Closed): ₹${(ticketStats.totalAmount || 0).toFixed(2)}`
      );
    doc.moveDown();

    // Time Log Statistics
    doc.fontSize(14).text("Time Logs:", { underline: true });
    doc
      .fontSize(12)
      .text(`Total Tasks: ${logTimeStats.totalTasks}`)
      .text(
        `Total Hours: ${((logTimeStats.totalTimeSpent || 0) / 60).toFixed(2)}`
      );
    doc.moveDown();

    // Footer
    doc
      .fontSize(10)
      .text(`Generated on ${new Date().toLocaleDateString()}`, {
        align: "right",
      });

    // Finalize PDF
    doc.end();
  } catch (err) {
    logger.log({
      user: req.user,
      page: "Report",
      action: "Error",
      api: req.originalUrl,
      req,
      message: `PDF Generation Error for UserId: ${req.params.userId}`,
      details: { error: err.message, stack: err.stack },
      level: "error"
    });
    if (err.message === "User not found") {
      // Handle specific error from getUserReportDataInternal
      if (!res.headersSent) {
        return res
          .status(404)
          .json({ success: false, error: "User not found for PDF generation" });
      }
    }
    if (!res.headersSent) {
      res
        .status(500)
        .json({
          success: false,
          error: "Failed to generate PDF",
          details: err.message,
        });
    }
  }
};

exports.generateQuotationsReport = async (req, res) => {
  const { period = "7days" } = req.query;
  const { exportToExcel } = req.query; // To distinguish between summary and excel export
  const user = req.user;

  try {
    const { startDate, endDate } = getDateRange(period);

    let dateQuery = {};
    if (startDate && endDate) {
      dateQuery = { date: { $gte: startDate, $lte: endDate } };
    } else if (startDate) {
      dateQuery = { date: { $gte: startDate } };
    } else if (endDate) {
      dateQuery = { date: { $lte: endDate } };
    }

    let userQuery = {};
    if (user.role !== "super-admin") {
      userQuery = { user: user._id };
    }

    const finalQuery = { ...dateQuery, ...userQuery };

    const quotations = await Quotation.find(finalQuery)
      .populate("client", "companyName gstNumber email phone")
      .populate("user", "firstname lastname email")
      .sort({ date: -1 })
      .lean();

    // Calculate Summary Statistics
    const totalQuotations = quotations.length;
    const statusCounts = { open: 0, running: 0, hold: 0, closed: 0, other: 0 };
    let totalClosedValue = 0;
    const clientIds = new Set();

    quotations.forEach((q) => {
      if (q.status && statusCounts.hasOwnProperty(q.status.toLowerCase())) {
        statusCounts[q.status.toLowerCase()]++;
      } else {
        statusCounts.other++;
      }
      if (q.client?._id) {
        clientIds.add(q.client._id.toString());
      }
      if (q.status === "closed") {
        totalClosedValue += q.grandTotal || 0;
      }
    });

    const uniqueClientsCount = clientIds.size;

    const summary = {
      period: period,
      dateRange:
        startDate && endDate
          ? `${formatDateToYYYYMMDD(startDate)} to ${formatDateToYYYYMMDD(
              endDate
            )}`
          : startDate
          ? `From ${formatDateToYYYYMMDD(startDate)}`
          : endDate
          ? `Up to ${formatDateToYYYYMMDD(endDate)}`
          : "All Time",
      totalQuotations,
      statusCounts,
      uniqueClientsCount,
      totalClosedValue: parseFloat(totalClosedValue.toFixed(2)),
    };

    if (exportToExcel !== "true") {
        // Return summary JSON
        return res.status(200).json({ success: true, data: summary });
    } else { // exportToExcel === "true"
        if (quotations.length === 0) {
            return res.status(404).json({ message: "No quotations found..." });
        }

        // Create workbook and worksheet
        const workbook = new excelJS.Workbook();
        const worksheet = workbook.addWorksheet("Quotations Report");

        // Define columns
        worksheet.columns = [
            { header: "Ref Number", key: "referenceNumber", width: 20 },
            { header: "Date", key: "date", width: 15 },
            { header: "Client Company", key: "clientCompany", width: 30 },
            { header: "Client GST", key: "gstNumber", width: 20 },
            { header: "Status", key: "status", width: 15 },
            { header: "Item Description", key: "description", width: 40 },
            { header: "Qty", key: "quantity", width: 10 },
            { header: "Unit", key: "unit", width: 10 },
            { header: "Price", key: "price", width: 15 },
            { header: "Amount", key: "amount", width: 15 },
            { header: "Grand Total", key: "grandTotal", width: 15 },
        ];

        // Add data
        quotations.forEach((q) => {
            if (q.goods && q.goods.length > 0) {
                q.goods.forEach((good) => {
                    worksheet.addRow({
                        referenceNumber: q.referenceNumber,
                        date: q.date ? new Date(q.date).toLocaleDateString() : "N/A",
                        clientCompany: q.client?.companyName || "N/A",
                        gstNumber: q.client?.gstNumber || "N/A",
                        status: q.status,
                        description: good.description,
                        quantity: good.quantity,
                        unit: good.unit,
                        price: good.price,
                        amount: good.amount,
                        grandTotal: q.grandTotal,
                    });
                });
            }
        });

        // Set response headers
        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.setHeader(
            "Content-Disposition",
            `attachment; filename=quotations_report_${period}.xlsx`
        );

        // Send the workbook
        return workbook.xlsx.write(res).then(() => {
            res.status(200).end();
        });
    }
  } catch (error) {
    logger.log({
      user: req.user,
      page: "Report",
      action: "Error",
      api: req.originalUrl,
      req,
      message: `Failed to generate quotations report (period: ${period})`,
      details: { error: error.message, stack: error.stack },
      level: "error"
    });
    res
      .status(500)
      .json({
        success: false,
        message: "Error generating quotations report",
        error: error.message,
      });
  }
};

exports.generateTicketsReport = async (req, res) => {
  const { period = "7days" } = req.query;
  const { exportToExcel } = req.query;
  const user = req.user;

  try {
    const { startDate, endDate } = getDateRange(period);

    let dateQuery = {};
    if (startDate && endDate) {
      dateQuery = { createdAt: { $gte: startDate, $lte: endDate } };
    } else if (startDate) {
      dateQuery = { createdAt: { $gte: startDate } };
    } else if (endDate) {
      dateQuery = { createdAt: { $lte: endDate } };
    }

    let userAccessQuery = {};
    // If not super-admin, restrict to tickets created by or assigned to the user.
    // For a "user's report", 'createdBy' is often the primary focus.
    // You might adjust this logic based on your exact reporting needs (e.g., include currentAssignee).
    if (user.role !== "super-admin") {
      userAccessQuery = { createdBy: user._id };
    }

    const finalQuery = { ...dateQuery, ...userAccessQuery };

    const tickets = await Ticket.find(finalQuery)
      .populate("createdBy", "firstname lastname email")
      .populate("currentAssignee", "firstname lastname email")
      // .populate("client", "companyName") // If tickets have a direct client ref
      .sort({ createdAt: -1 })
      .lean();

    // Calculate Summary Statistics
    const totalTickets = tickets.length;
    const ticketStatusTypes = [
      "Quotation Sent", "PO Received", "Payment Pending", "Inspection",
      "Packing List", "Invoice Sent", "Hold", "Closed"
    ];
    const statusCounts = ticketStatusTypes.reduce((acc, status) => {
      acc[status] = 0;
      return acc;
    }, { other: 0 });

    let totalValueClosedTickets = 0;
    const companyNames = new Set();

    tickets.forEach((t) => {
      if (t.status && statusCounts.hasOwnProperty(t.status)) {
        statusCounts[t.status]++;
      } else if (t.status) {
        statusCounts.other++; // Count statuses not in the predefined list
      }

      if (t.companyName) {
        companyNames.add(t.companyName);
      }
      if (t.status === "Closed") {
        totalValueClosedTickets += t.grandTotal || 0;
      }
    });

    const uniqueClientsCount = companyNames.size;

    const summary = {
      period: period,
      dateRange:
        startDate && endDate
          ? `${formatDateToYYYYMMDD(startDate)} to ${formatDateToYYYYMMDD(endDate)}`
          : startDate
          ? `From ${formatDateToYYYYMMDD(startDate)}`
          : endDate
          ? `Up to ${formatDateToYYYYMMDD(endDate)}`
          : "All Time",
      totalTickets,
      statusCounts,
      uniqueClientsCount,
      totalValueClosedTickets: parseFloat(totalValueClosedTickets.toFixed(2)),
    };

    if (exportToExcel !== "true") {
      return res.status(200).json({ success: true, data: summary });
    } else {
      if (tickets.length === 0) {
        return res.status(404).json({ message: "No tickets found for export." });
      }

      const workbook = new excelJS.Workbook();
      const worksheet = workbook.addWorksheet("Tickets Report");

      worksheet.columns = [
        { header: "Ticket Number", key: "ticketNumber", width: 20 },
        { header: "Date", key: "date", width: 15 },
        { header: "Company Name", key: "companyName", width: 30 },
        { header: "Status", key: "status", width: 15 },
        { header: "Created By", key: "createdBy", width: 25 },
        { header: "Assigned To", key: "assignedTo", width: 25 },
        { header: "Item Description", key: "itemDescription", width: 40 },
        { header: "Item Qty", key: "itemQuantity", width: 10 },
        { header: "Item Price", key: "itemPrice", width: 15 },
        { header: "Item Amount", key: "itemAmount", width: 15 },
        { header: "Ticket Grand Total", key: "grandTotal", width: 15 },
      ];

      tickets.forEach((t) => {
        const createdByFullName = t.createdBy ? `${t.createdBy.firstname || ''} ${t.createdBy.lastname || ''}`.trim() : "N/A";
        const assignedToFullName = t.currentAssignee ? `${t.currentAssignee.firstname || ''} ${t.currentAssignee.lastname || ''}`.trim() : "N/A";
        if (t.goods && t.goods.length > 0) {
          t.goods.forEach((good) => {
            worksheet.addRow({
              ticketNumber: t.ticketNumber, date: t.createdAt ? new Date(t.createdAt).toLocaleDateString() : "N/A",
              companyName: t.companyName || "N/A", status: t.status, createdBy: createdByFullName, assignedTo: assignedToFullName,
              itemDescription: good.description, itemQuantity: good.quantity, itemPrice: good.price, itemAmount: good.amount,
              grandTotal: t.grandTotal,
            });
          });
        } else { // Add a row for tickets with no goods, if desired
          worksheet.addRow({
            ticketNumber: t.ticketNumber, date: t.createdAt ? new Date(t.createdAt).toLocaleDateString() : "N/A",
            companyName: t.companyName || "N/A", status: t.status, createdBy: createdByFullName, assignedTo: assignedToFullName,
            grandTotal: t.grandTotal,
          });
        }
      });

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=tickets_report_${period}.xlsx`);
      return workbook.xlsx.write(res).then(() => res.status(200).end());
    }
  } catch (error) {
    logger.log({
      user: req.user,
      page: "Report",
      action: "Error",
      api: req.originalUrl,
      req,
      message: `Failed to generate tickets report (period: ${period})`,
      details: { error: error.message, stack: error.stack },
      level: "error"
    });
    res.status(500).json({ success: false, message: "Error generating tickets report", error: error.message });
  }
};