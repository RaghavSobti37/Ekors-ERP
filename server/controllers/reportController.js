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
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');

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
  return { startDate, endDate };
};

// Helper to format Date object to "YYYY-MM-DD" string
const formatDateToYYYYMMDD = (dateObj) => {
  return dateObj.toISOString().split("T")[0];
};

// Helper function to get monthly analytics data
async function getMonthlyAnalytics(userId, months = 6) {
  const userObjectId = new mongoose.Types.ObjectId(userId);
  const monthsAgo = new Date();
  monthsAgo.setMonth(monthsAgo.getMonth() - months);
  
  // Get monthly quotation data
  const quotationAnalytics = await Quotation.aggregate([
    {
      $match: {
        user: userObjectId,
        createdAt: { $gte: monthsAgo }
      }
    },
    {
      $group: {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" }
        },
        totalQuotations: { $sum: 1 },
        totalAmount: { $sum: "$grandTotal" },
        avgAmount: { $avg: "$grandTotal" },
        statusBreakdown: {
          $push: {
            status: "$status",
            amount: "$grandTotal"
          }
        }
      }
    },
    {
      $sort: { "_id.year": 1, "_id.month": 1 }
    }
  ]);

  // Get monthly ticket data
  const ticketAnalytics = await Ticket.aggregate([
    {
      $match: {
        createdBy: userObjectId,
        createdAt: { $gte: monthsAgo }
      }
    },
    {
      $group: {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" }
        },
        totalTickets: { $sum: 1 },
        totalAmount: { $sum: "$grandTotal" },
        avgAmount: { $avg: "$grandTotal" },
        statusBreakdown: {
          $push: {
            status: "$status",
            amount: "$grandTotal"
          }
        }
      }
    },
    {
      $sort: { "_id.year": 1, "_id.month": 1 }
    }
  ]);

  return { quotationAnalytics, ticketAnalytics };
}

// Function to generate chart images
async function generateChartImage(chartConfig) {
  const width = 800;
  const height = 400;
  const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height, backgroundColour: 'white' });
  
  try {
    const imageBuffer = await chartJSNodeCanvas.renderToBuffer(chartConfig);
    return imageBuffer;
  } catch (error) {
    logger.log({
      user: null,
      page: "Report",
      action: "Chart Generation Error",
      message: `Failed to generate chart: ${error.message}`,
      level: "error"
    });
    return null;
  }
}

// Enhanced internal function to fetch and process report data
async function getUserReportDataInternal(userId, period) {
  // Get date range based on period
  const { startDate, endDate } = getDateRange(period);
  
  // Find the user
  const user = await User.findById(userId);
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
  // Build match conditions for quotations
  const quotationMatchConditions = { user: userObjectId };
  if (startDate && endDate) {
    quotationMatchConditions.createdAt = { $gte: startDate, $lte: endDate };
  }
  
  const quotations = await Quotation.aggregate([
    {
      $match: quotationMatchConditions,
    },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        totalAmount: { $sum: "$grandTotal" },
      },
    },
  ]);
  
  // Build match conditions for tickets
  const ticketMatchConditions = { createdBy: userObjectId };
  if (startDate && endDate) {
    ticketMatchConditions.createdAt = { $gte: startDate, $lte: endDate };
  }
  
  const tickets = await Ticket.aggregate([
    {
      $match: ticketMatchConditions,
    },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        totalAmount: { $sum: "$grandTotal" }, // Assuming tickets also have grandTotal
      },
    },
  ]);

  // Build match conditions for log times
  const logTimeMatchConditions = { user: userObjectId };
  if (startDate && endDate) {
    const startDateString = formatDateToYYYYMMDD(startDate);
    const endDateString = formatDateToYYYYMMDD(endDate);
    logTimeMatchConditions.date = { $gte: startDateString, $lte: endDateString };
  }
  logTimeMatchConditions["logs.timeSpent"] = { $exists: true, $ne: null, $ne: "" };

  const logTimes = await LogTime.aggregate([
    {
      $match: logTimeMatchConditions,
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

  const quotationStats = {
    total: 0,
    open: 0,
    hold: 0,
    closed: 0,
    totalAmount: 0,
    openAmount: 0,
    holdAmount: 0,
    closedAmount: 0,
  };
  quotations.forEach((item) => {
    quotationStats.total += item.count;
    quotationStats.totalAmount += item.totalAmount || 0;
    if (item._id === "open") {
      quotationStats.open = item.count;
      quotationStats.openAmount = item.totalAmount || 0;
    } else if (item._id === "hold") {
      quotationStats.hold = item.count;
      quotationStats.holdAmount = item.totalAmount || 0;
    } else if (item._id === "closed") {
      quotationStats.closed = item.count;
      quotationStats.closedAmount = item.totalAmount || 0;
    }
  });

  const ticketStats = { 
    total: 0, 
    open: 0, 
    hold: 0, 
    closed: 0, 
    totalAmount: 0,
    openAmount: 0,
    holdAmount: 0,
    closedAmount: 0,
  };
  tickets.forEach((item) => {
    ticketStats.total += item.count;
    ticketStats.totalAmount += item.totalAmount || 0;
    if (item._id === "Closed") {
      ticketStats.closed = item.count;
      ticketStats.closedAmount = item.totalAmount || 0;
    } else if (item._id === "Hold") {
      ticketStats.hold = item.count;
      ticketStats.holdAmount = item.totalAmount || 0;
    } else if (
      [
        "Quotation Sent",
        "PO Received",
        "Payment Pending",
        "Inspection",
        "Packing List",
        "Invoice Sent",
      ].includes(item._id)
    ) {
      ticketStats.open += item.count;
      ticketStats.openAmount += item.totalAmount || 0;
    }
  });

  const logTimeStats = {
    totalTasks: logTimes.length > 0 ? logTimes[0].totalTasks : 0,
    totalTimeSpent: logTimes.length > 0 ? logTimes[0].totalTimeSpent : 0,
  };

  return {
    user: user.toObject(), // Convert Mongoose doc to plain object
    period: startDate && endDate ? formatDateRange(startDate, endDate) : "All Time",
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

    const reportData = await getUserReportDataInternal(userId, period);
    const monthlyData = await getMonthlyAnalytics(userId, 6);

    // Before creating PDF, verify data exists
    if (!reportData || !reportData.user) {
      throw new Error("No user data found");
    }

    // Destructure data for easier access in PDF generation
    const {
      user,
      period: dateRange,
      quotationStats,
      ticketStats,
      logTimeStats,
    } = reportData;

    // Create PDF document with better margins
    const doc = new PDFDocument({ 
      margin: 50, 
      size: 'A4',
      info: {
        Title: `User Report - ${user.firstname} ${user.lastname}`,
        Author: 'ERP System',
        Subject: `Performance Report for ${dateRange}`,
        Keywords: 'user report, analytics, performance'
      }
    });

    // Set response headers
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=user-report-${user.firstname}-${user.lastname}-${new Date().toISOString().split('T')[0]}.pdf`
    );

    // Pipe to response
    doc.pipe(res);

    // Colors for the report
    const primaryColor = '#800000'; // Maroon
    const accentColor = '#4A90E2';
    const lightGray = '#F5F5F5';
    const darkGray = '#333333';

    // Header with company branding
    doc.rect(0, 0, doc.page.width, 80).fill(primaryColor);
    doc.fontSize(24).fillColor('white').text('USER PERFORMANCE REPORT', 50, 30, { align: 'center' });
    doc.moveDown(2);

    // User Information Section with styling
    doc.rect(50, 120, doc.page.width - 100, 100).fill(lightGray).stroke();
    doc.fillColor(darkGray).fontSize(16).text('USER INFORMATION', 70, 135);
    
    doc.fontSize(12)
      .text(`Name: ${user.firstname} ${user.lastname}`, 70, 160)
      .text(`Email: ${user.email}`, 70, 180)
      .text(`Role: ${user.role}`, 300, 160)
      .text(`Report Period: ${dateRange}`, 300, 180)
      .text(`Generated: ${new Date().toLocaleDateString()}`, 300, 200);

    doc.moveDown(3);

    // Performance Summary Section
    let yPosition = 250;
    doc.rect(50, yPosition, doc.page.width - 100, 30).fill(accentColor);
    doc.fillColor('white').fontSize(14).text('PERFORMANCE SUMMARY', 70, yPosition + 10);
    yPosition += 50;

    // Create performance metrics table
    const tableWidth = doc.page.width - 100;
    const colWidth = tableWidth / 4;
    
    // Table headers
    doc.rect(50, yPosition, tableWidth, 25).fill(lightGray).stroke();
    doc.fillColor(darkGray).fontSize(11).text('Metric', 60, yPosition + 8);
    doc.text('Quotations', 60 + colWidth, yPosition + 8);
    doc.text('Tickets', 60 + colWidth * 2, yPosition + 8);
    doc.text('Time Logs', 60 + colWidth * 3, yPosition + 8);
    
    yPosition += 25;
    
    // Table data
    const metrics = [
      ['Total Count', quotationStats.total, ticketStats.total, logTimeStats.totalTasks],
      ['Open/Running', quotationStats.open, ticketStats.open, '-'],
      ['On Hold', quotationStats.hold, ticketStats.hold, '-'],
      ['Completed', quotationStats.closed, ticketStats.closed, '-'],
      ['Total Value', `₹${quotationStats.totalAmount?.toFixed(2) || '0.00'}`, `₹${ticketStats.totalAmount?.toFixed(2) || '0.00'}`, `${((logTimeStats.totalTimeSpent || 0) / 60).toFixed(1)}h`],
      ['Open Value', `₹${quotationStats.openAmount?.toFixed(2) || '0.00'}`, `₹${ticketStats.openAmount?.toFixed(2) || '0.00'}`, '-'],
      ['Hold Value', `₹${quotationStats.holdAmount?.toFixed(2) || '0.00'}`, `₹${ticketStats.holdAmount?.toFixed(2) || '0.00'}`, '-'],
      ['Closed Value', `₹${quotationStats.closedAmount?.toFixed(2) || '0.00'}`, `₹${ticketStats.closedAmount?.toFixed(2) || '0.00'}`, '-']
    ];

    metrics.forEach((row, index) => {
      const bgColor = index % 2 === 0 ? 'white' : lightGray;
      doc.rect(50, yPosition, tableWidth, 20).fill(bgColor).stroke();
      doc.fillColor(darkGray).fontSize(10);
      row.forEach((cell, cellIndex) => {
        doc.text(String(cell), 60 + colWidth * cellIndex, yPosition + 6);
      });
      yPosition += 20;
    });

    // Only add charts if we have meaningful data
    const hasMonthlyData = monthlyData.quotationAnalytics.length > 0 || monthlyData.ticketAnalytics.length > 0;
    
    if (hasMonthlyData) {
      // Add new page for charts only if we have data
      doc.addPage();
      yPosition = 50;
      
      // Charts section header
      doc.rect(50, yPosition, doc.page.width - 100, 30).fill(accentColor);
      doc.fillColor('white').fontSize(14).text('MONTHLY PERFORMANCE TRENDS', 70, yPosition + 10);
      yPosition += 50;

      // Prepare chart data
      const months = monthlyData.quotationAnalytics.map(item => 
        `${item._id.year}-${String(item._id.month).padStart(2, '0')}`
      );
      
      const quotationValues = monthlyData.quotationAnalytics.map(item => item.totalQuotations);
      const ticketValues = monthlyData.ticketAnalytics.map(item => item.totalTickets || 0);

      // Only create charts if we have data
      if (months.length > 0) {
        // Create chart configuration
        const chartConfig = {
          type: 'line',
          data: {
            labels: months,
            datasets: [{
              label: 'Quotations',
              data: quotationValues,
              borderColor: primaryColor,
              backgroundColor: primaryColor + '20',
              tension: 0.4
            }, {
              label: 'Tickets',
              data: ticketValues,
              borderColor: accentColor,
              backgroundColor: accentColor + '20',
              tension: 0.4
            }]
          },
          options: {
            responsive: true,
            plugins: {
              title: {
                display: true,
                text: 'Monthly Activity Trends'
              },
              legend: {
                display: true,
                position: 'top'
              }
            },
            scales: {
              y: {
                beginAtZero: true,
                title: {
                  display: true,
                  text: 'Count'
                }
              },
              x: {
                title: {
                  display: true,
                  text: 'Month'
                }
              }
            }
          }
        };

        // Generate and embed chart
        const chartImage = await generateChartImage(chartConfig);
        if (chartImage) {
          doc.image(chartImage, 80, yPosition, { width: 400, height: 200 });
          yPosition += 220;
        }

        // Value chart
        const valueChartConfig = {
          type: 'bar',
          data: {
            labels: months,
            datasets: [{
              label: 'Quotation Value (₹)',
              data: monthlyData.quotationAnalytics.map(item => item.totalAmount || 0),
              backgroundColor: primaryColor + '80',
              borderColor: primaryColor,
              borderWidth: 1
            }, {
              label: 'Ticket Value (₹)',
              data: monthlyData.ticketAnalytics.map(item => item.totalAmount || 0),
              backgroundColor: accentColor + '80',
              borderColor: accentColor,
              borderWidth: 1
            }]
          },
          options: {
            responsive: true,
            plugins: {
              title: {
                display: true,
                text: 'Monthly Revenue Trends'
              },
              legend: {
                display: true,
                position: 'top'
              }
            },
            scales: {
              y: {
                beginAtZero: true,
                title: {
                  display: true,
                  text: 'Amount (₹)'
                }
              }
            }
          }
        };

        const valueChartImage = await generateChartImage(valueChartConfig);
        if (valueChartImage) {
          doc.image(valueChartImage, 80, yPosition, { width: 400, height: 200 });
        }
      }
    }

    // Footer on the last page
    doc.rect(0, doc.page.height - 50, doc.page.width, 50).fill(primaryColor);
    doc.fillColor('white').fontSize(10)
      .text('Generated by ERP System', 50, doc.page.height - 30)
      .text(`Generated on ${new Date().toLocaleDateString()}`, 0, doc.page.height - 30, { align: 'right', width: doc.page.width - 50 });

    // Finalize PDF
    doc.end();
  } catch (err) {
    logger.log({
      user: req.user,
      page: "Report",
      action: "Error",
     
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
     
      req,
      message: `Failed to generate tickets report (period: ${period})`,
      details: { error: error.message, stack: error.stack },
      level: "error"
    });
    res.status(500).json({ success: false, message: "Error generating tickets report", error: error.message });
  }
};