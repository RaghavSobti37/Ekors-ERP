const { Item, Purchase } = require("../models/itemlist");
const UniversalBackup = require("../models/universalBackup"); // Changed from ItemBackup
const mongoose = require("mongoose");
const logger = require("../utils/logger");
const multer = require("multer");
const xlsx = require("xlsx");
const Ticket = require("../models/opentickets"); // Make sure this path is correct
const exceljs = require("exceljs");
const asyncHandler = require("express-async-handler");

// Get all items - Updated for server-side pagination, sorting, and filtering
exports.getAllItems = async (req, res) => {
  const user = req.user || null;
  const {
    page = 1,
    limit = 10, // Default limit for items page
    sortKey = "name",
    sortDirection = "asc",
    searchTerm,
    category,
    // subcategory, // Removed
    quantityThreshold,
    status, // e.g., 'approved', 'pending_review'
    filter, // Special filter like 'stock_alerts'
    lowThreshold, // Used with 'stock_alerts'
  } = req.query;

  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const skip = (pageNum - 1) * limitNum;

  try {
    let query = {};

    if (searchTerm) {
      query.$or = [
        { name: { $regex: searchTerm, $options: "i" } },
        { hsnCode: { $regex: searchTerm, $options: "i" } },
      ];
    }
    if (category && category !== "All" && category !== "undefined")
      query.category = category;
    // if (subcategory && subcategory !== "All" && subcategory !== "undefined") // Removed
    //   query.subcategory = subcategory;

    if (
      quantityThreshold !== undefined &&
      quantityThreshold !== null &&
      quantityThreshold !== "All" &&
      quantityThreshold !== "null"
    ) {
      query.quantity = { $lte: parseInt(quantityThreshold, 10) };
    } else if (quantityThreshold === "0") {
      // Explicitly handle "0" if sent as string
      query.quantity = { $lte: 0 };
    }

    if (status && status !== "undefined") query.status = status;

    if (
      filter === "stock_alerts" &&
      lowThreshold !== undefined &&
      lowThreshold !== "undefined"
    ) {
      const thresholdValue = parseInt(lowThreshold, 10);
      // This overrides other quantity filters if stock_alerts is active
      if (Number.isFinite(thresholdValue)) {
        query.quantity = { $lt: thresholdValue };
      } else {
        // Potentially log a warning if lowThreshold is not a valid number
        logger.warn(
          "item",
          `Invalid lowThreshold value received for stock_alerts: ${lowThreshold}`,
          user
        );
      }
    }

    const totalItems = await Item.countDocuments(query);
    const items = await Item.find(query)
      .populate("createdBy", "firstname lastname email")
      .populate("reviewedBy", "firstname lastname email")
      .sort({ [sortKey]: sortDirection === "desc" ? -1 : 1 })
      .skip(skip)
      .limit(limitNum);

    logger.debug("item", "Items fetched successfully", user, {
      count: items.length,
      totalItems,
      currentPage: pageNum,
      totalPages: Math.ceil(totalItems / limitNum),
    });
    res.json({
      data: items,
      totalItems,
      currentPage: pageNum,
      totalPages: Math.ceil(totalItems / limitNum),
    });
  } catch (error) {
    logger.error("item", "Error fetching items", error, user);
    res.status(500).json({
      message: "Server error while fetching items",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      file.mimetype === "application/vnd.ms-excel"
    ) {
      cb(null, true);
    } else {
      cb(
        new Error("Invalid file type. Only .xlsx and .xls files are allowed."),
        false
      );
    }
  },
  limits: { fileSize: 20 * 1024 * 1024 },
});
exports.uploadMiddleware = upload.single("excelFile");

// --- EXCEL EXPORT LOGIC START ---

const MAX_CUSTOM_UNITS_TO_EXPORT = 3;
exports.exportItemsToExcel = async (req, res) => {
  const user = req.user || null;
  logger.info("excel_export", "API: Starting Excel export process", {
    userId: user?._id,
  });
  try {
    // Fetch all approved items, sorted by category and then by name
    const items = await Item.find({ status: "approved" })
      .sort({ category: 1, name: 1 })
      .lean();
    if (!items || items.length === 0) {
      logger.info("excel_export", "No items found to export", {
        userId: user?._id,
      });
      return res
        .status(404)
        .json({ message: "No approved items found to export." });
    }

    const workbook = new exceljs.Workbook();
    const worksheet = workbook.addWorksheet("Items");

    // Define columns with headers and widths
    worksheet.columns = [
      { header: "Category", key: "category", width: 25 },
      { header: "Name", key: "name", width: 40 },
      { header: "Quantity", key: "quantity", width: 15 },
      { header: "HSN Code", key: "hsnCode", width: 15 },
      { header: "GST Rate", key: "gstRate", width: 12 },
      { header: "Max Discount %", key: "maxDiscountPercentage", width: 18 },
      { header: "Low Stock Threshold", key: "lowStockThreshold", width: 20 },
      { header: "Base Unit", key: "baseUnit", width: 15 },
      {
        header: "Selling Price (per Base Unit)",
        key: "sellingPriceBaseUnit",
        width: 25,
      },
      {
        header: "Buying Price (per Base Unit)",
        key: "buyingPriceBaseUnit",
        width: 25,
      },
      // Add generic custom unit columns
      ...Array.from({ length: MAX_CUSTOM_UNITS_TO_EXPORT }).flatMap((_, i) => [
        {
          header: `Custom Unit ${i + 1} Name`,
          key: `customUnit${i + 1}Name`,
          width: 20,
        },
        {
          header: `Custom Unit ${i + 1} Conversion Factor`,
          key: `customUnit${i + 1}ConversionFactor`,
          width: 25,
        },
      ]),
      { header: "Image", key: "image", width: 15 },
    ];

    // Apply header styling
    worksheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } }; // White text
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF4472C4" }, // Blue background (similar to Excel's default header blue)
      };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });

    let currentRow = 2; // Start data from row 2
    let currentCategory = null;
    let imageMergeStartRow = -1;
    let lastImageBase64 = null;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      // Add category header if it changes
      if (item.category !== currentCategory) {
        const imageColIndex = worksheet.columns.findIndex(
          (col) => col.key === "image"
        );
        const imageColLetter = String.fromCharCode(
          "A".charCodeAt(0) + imageColIndex
        );
        // Before adding new category header, finalize any pending image merge from previous category
        if (imageMergeStartRow !== -1 && currentRow > imageMergeStartRow) {
          worksheet.mergeCells(
            `${imageColLetter}${imageMergeStartRow}:${imageColLetter}${
              currentRow - 1
            }`
          );
        }
        // Reset image merge tracking for the new category
        imageMergeStartRow = -1;
        lastImageBase64 = null;

        currentCategory = item.category;
        const lastColumnLetter = String.fromCharCode(
          "A".charCodeAt(0) + worksheet.columns.length - 1
        );
        worksheet.mergeCells(`A${currentRow}:${lastColumnLetter}${currentRow}`); // Merge all columns for category header
        worksheet.getCell(`A${currentRow}`).value = `Category: ${
          currentCategory || "Other"
        }`;
        worksheet.getCell(`A${currentRow}`).font = {
          bold: true,
          size: 12,
          color: { argb: "FF000000" },
        }; // Black text
        worksheet.getCell(`A${currentRow}`).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFD9E1F2" }, // Light blue background
        };
        worksheet.getCell(`A${currentRow}`).alignment = {
          vertical: "middle",
          horizontal: "left",
        };
        currentRow++;
      }

      // Prepare row data
      const rowData = {
        category: "", // Category is handled by the merged header
        name: item.name,
        quantity: item.quantity,
        baseUnit: item.pricing?.baseUnit || "N/A",
        sellingPriceBaseUnit: item.pricing?.sellingPrice || 0,
        buyingPriceBaseUnit: item.pricing?.buyingPrice || 0,
        hsnCode: item.hsnCode,
        gstRate: item.gstRate,
        maxDiscountPercentage: item.maxDiscountPercentage,
        lowStockThreshold: item.lowStockThreshold,
        image: "", // Image will be added separately
      };
      // Populate custom unit columns
      const nonBaseUnits = item.units?.filter((u) => !u.isBaseUnit) || [];
      for (let j = 0; j < MAX_CUSTOM_UNITS_TO_EXPORT; j++) {
        if (nonBaseUnits[j]) {
          rowData[`customUnit${j + 1}Name`] = nonBaseUnits[j].name;
          rowData[`customUnit${j + 1}ConversionFactor`] =
            nonBaseUnits[j].conversionFactor;
        } else {
          // Ensure empty cells if no more custom units
          rowData[`customUnit${j + 1}Name`] = "";
          rowData[`customUnit${j + 1}ConversionFactor`] = "";
        }
      }

      worksheet.addRow(rowData);
      const addedRow = worksheet.getRow(currentRow);

      // --- Image Placement and Merge Start ---
      const hasImage = !!item.image;
      const isNewImageSequence = item.image !== lastImageBase64;
      const imageColIndex = worksheet.columns.findIndex(
        (col) => col.key === "image"
      );
      const imageColLetter = String.fromCharCode(
        "A".charCodeAt(0) + imageColIndex
      );

      // If a new image sequence is starting (or no image for current item) AND an old sequence was active, finalize the old one.
      if (imageMergeStartRow !== -1 && (isNewImageSequence || !hasImage)) {
        if (currentRow - 1 >= imageMergeStartRow) {
          worksheet.mergeCells(
            `${imageColLetter}${imageMergeStartRow}:${imageColLetter}${
              currentRow - 1
            }`
          );
        }
        imageMergeStartRow = -1; // Reset for new sequence
        lastImageBase64 = null; // Reset for new sequence
      }

      if (hasImage) {
        if (imageMergeStartRow === -1) {
          imageMergeStartRow = currentRow;
          lastImageBase64 = item.image;
          const imageId = workbook.addImage({
            // Add image to workbook
            base64: item.image, // Base64 image data
            extension: item.image.split(";")[0].split("/")[1],
          });
          worksheet.addImage(imageId, {
            tl: { col: imageColIndex, row: currentRow - 1 },
            ext: { width: 60, height: 60 },
          });
        }
        worksheet.getRow(currentRow).height = 65; // Always set row height if there's an image in this row
      }

      // Apply cell styling for data rows
      addedRow.eachCell((cell) => {
        cell.alignment = { vertical: "middle", horizontal: "left" };
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });

      // Center align numeric columns
      addedRow.getCell("quantity").alignment = {
        vertical: "middle",
        horizontal: "center",
      };
      addedRow.getCell("gstRate").alignment = {
        vertical: "middle",
        horizontal: "center",
      };
      addedRow.getCell("maxDiscountPercentage").alignment = {
        vertical: "middle",
        horizontal: "center",
      };
      addedRow.getCell("lowStockThreshold").alignment = {
        vertical: "middle",
        horizontal: "center",
      };

      addedRow.getCell("sellingPriceBaseUnit").alignment = {
        vertical: "middle",
        horizontal: "right",
      };
      addedRow.getCell("buyingPriceBaseUnit").alignment = {
        vertical: "middle",
        horizontal: "right",
      };
      // Custom unit conversion factors should also be centered
      for (let j = 0; j < MAX_CUSTOM_UNITS_TO_EXPORT; j++) {
        addedRow.getCell(`customUnit${j + 1}ConversionFactor`).alignment = {
          vertical: "middle",
          horizontal: "center",
        };
      }
      addedRow.getCell("gstRate").alignment = {
        vertical: "middle",
        horizontal: "center",
      };
      addedRow.getCell("maxDiscountPercentage").alignment = {
        vertical: "middle",
        horizontal: "center",
      };
      addedRow.getCell("lowStockThreshold").alignment = {
        vertical: "middle",
        horizontal: "center",
      };

      currentRow++;
    }

    // Finalize any pending image merge for the last category
    if (imageMergeStartRow !== -1 && currentRow > imageMergeStartRow) {
      const imageColIndex = worksheet.columns.findIndex(
        (col) => col.key === "image"
      );
      const imageColLetter = String.fromCharCode(
        "A".charCodeAt(0) + imageColIndex
      );
      worksheet.mergeCells(
        `${imageColLetter}${imageMergeStartRow}:${imageColLetter}${
          currentRow - 1
        }`
      );
    }

    const excelBuffer = await workbook.xlsx.writeBuffer();

    // Set headers for file download
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="items_export.xlsx"'
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    logger.info(
      "excel_export",
      "API: Excel file generated and sent for download",
      { userId: user?._id, itemCount: items.length }
    );
    res.send(excelBuffer);
  } catch (error) {
    logger.error("excel_export", "API: Error during Excel export process", {
      error: error.message,
      stack: error.stack,
      userId: user?._id,
    });
    res.status(500).json({
      message: "Server error during Excel export.",
      error: error.message,
    });
  }
};

// --- EXCEL EXPORT LOGIC END ---

// --- EXCEL IMPORT LOGIC START ---

async function parseExcelBufferForUpdate(fileBuffer) {
  const itemsToUpsert = [];
  const parsingErrors = [];

  try {
    const workbook = new exceljs.Workbook();
    await workbook.xlsx.load(fileBuffer);
    const worksheet = workbook.getWorksheet(1); // Assuming data is in the first sheet

    if (!worksheet) {
      throw new Error("No worksheet found in the Excel file.");
    }

    let currentCategory = "Other"; // Default category

    // Collect all images first to map them by row
    const imageMap = new Map();
    worksheet.getImages().forEach((image) => {
      const row = image.range.tl.row + 1; // 1-based row number
      const imageId = image.imageId;
      const excelImage = workbook.getImage(imageId);
      if (excelImage) {
        const base64Image = `data:image/${
          excelImage.extension || "png"
        };base64,${excelImage.buffer.toString("base64")}`;
        imageMap.set(row, base64Image);
      }
    });

    // Iterate over rows, skipping the header row and empty rows
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return; // Skip the header row explicitly

      // Check if this row is a category header (merged cells in column A)
      const firstCell = row.getCell("A");
      if (firstCell.isMerged) {
        const categoryCellValue = firstCell.value;
        if (
          typeof categoryCellValue === "string" &&
          categoryCellValue.startsWith("Category:")
        ) {
          currentCategory = categoryCellValue.replace("Category: ", "").trim();
          return; // This is a category header row, skip processing as an item
        }
      }

      const name = row.getCell("B").value;

      // If the name is missing, consider it an empty row and skip
      if (!name) {
        if (row.values.length > 1) {
          // Avoid logging for completely blank rows
          parsingErrors.push({
            row: rowNumber,
            message: `Skipped: Item name is missing in row ${rowNumber}.`,
          });
        }
        return;
      }

      const item = {
        name: String(name).trim(),
        quantity: parseFloat(row.getCell("C").value) || 0,
        hsnCode: String(row.getCell("D").value || "").trim(),
        gstRate: parseFloat(row.getCell("E").value) || 0,
        maxDiscountPercentage: parseFloat(row.getCell("F").value) || 0,
        lowStockThreshold: parseInt(row.getCell("G").value, 10) || 5,
        baseUnit: String(row.getCell("H").value || "Nos").trim(),
        sellingPriceBaseUnit: parseFloat(row.getCell("I").value) || 0,
        buyingPriceBaseUnit: parseFloat(row.getCell("J").value) || 0,
        category: currentCategory,
        image: imageMap.get(rowNumber) || "",
      };

      // Read custom units dynamically. Custom Unit 1 Name starts at column K (11).
      for (let i = 0; i < MAX_CUSTOM_UNITS_TO_EXPORT; i++) {
        const unitNameColIndex = 11 + i * 2; // K, M, O
        const conversionFactorColIndex = 12 + i * 2; // L, N, P

        const unitName = row.getCell(unitNameColIndex).value;
        const conversionFactor = row.getCell(conversionFactorColIndex).value;

        if (
          unitName &&
          conversionFactor !== null &&
          conversionFactor !== undefined
        ) {
          item[`customUnit${i + 1}Name`] = String(unitName).trim();
          item[`customUnit${i + 1}ConversionFactor`] =
            parseFloat(conversionFactor);
        }
      }

      // Further validations
      if (isNaN(item.sellingPriceBaseUnit)) {
        parsingErrors.push({
          row: rowNumber,
          message: `Skipped: Invalid Selling Price for item "${
            item.name
          }" in row ${rowNumber}. Value: ${row.getCell("I").value}.`,
        });
        return;
      }

      itemsToUpsert.push(item);
    });

    return { itemsToUpsert, parsingErrors };
  } catch (error) {
    logger.error(
      "excel_importer",
      `Error parsing Excel buffer: ${error.message}`,
      error
    );
    return {
      itemsToUpsert: [],
      parsingErrors: [
        {
          row: "general",
          message: `Fatal error during Excel parsing: ${error.message}`,
        },
      ],
    };
  }
}

// --- EXCEL IMPORT LOGIC END ---

exports.importItemsFromUploadedExcel = async (req, res) => {
  const user = req.user || null;
  logger.info(
    "excel_upload_import",
    "API: Starting Excel import from uploaded file",
    { userId: user?._id }
  );

  if (!req.file) {
    logger.warn("excel_upload_import", "API: No file uploaded.", {
      userId: user?._id,
    });
    return res.status(400).json({ message: "No Excel file uploaded." });
  }

  try {
    const fileBuffer = req.file.buffer;
    const { itemsToUpsert, parsingErrors } = await parseExcelBufferForUpdate(
      fileBuffer
    );

    if (parsingErrors && parsingErrors.length > 0) {
      logger.warn(
        "excel_upload_import",
        "API: Errors/Warnings during Excel parsing",
        {
          parsingErrorsCount: parsingErrors.length,
          parsingErrors,
          userId: user?._id,
        }
      );
    }

    if (!itemsToUpsert || itemsToUpsert.length === 0) {
      logger.info(
        "excel_upload_import",
        "API: No items found in uploaded Excel to process",
        { userId: user?._id }
      );
      return res.status(200).json({
        message:
          "No valid items found in the uploaded Excel to process or file is empty.",
        itemsCreated: 0,
        itemsUpdated: 0,
        itemsDeleted: 0,
        parsingErrors,
      });
    }

    const {
      itemsCreated,
      itemsUpdated,
      itemsDeleted,
      operationResults,
      databaseProcessingErrors,
    } = await syncItemsWithDatabase(
      req,
      itemsToUpsert,
      user,
      "excel_upload_import"
    );

    logger.info(
      "excel_upload_import",
      "API: Excel import from upload process completed",
      {
        itemsCreated,
        itemsUpdated,
        itemsDeleted,
        errors: databaseProcessingErrors.length,
        userId: user?._id,
      }
    );
    res.status(200).json({
      message: "Uploaded Excel data processed.",
      itemsCreated,
      itemsUpdated,
      itemsDeleted,
      parsingErrors,
      databaseProcessingDetails: operationResults,
      databaseProcessingErrors,
    });
  } catch (error) {
    if (error instanceof multer.MulterError) {
      logger.error(
        "excel_upload_import",
        "API: Multer error during file upload",
        { error: error.message, stack: error.stack, userId: user?._id }
      );
      return res
        .status(400)
        .json({ message: `File upload error: ${error.message}` });
    }
    logger.error(
      "excel_upload_import",
      "API: Unhandled error during Excel import from upload",
      { error: error.message, stack: error.stack, userId: user?._id }
    );
    res.status(500).json({
      message: "Server error during Excel processing.",
      error: error.message,
    });
  }
};

async function syncItemsWithDatabase(req, excelItems, user, logContextPrefix) {
  let itemsCreated = 0;
  let itemsUpdated = 0;
  let itemsDeleted = 0;
  const operationResults = [];
  const databaseProcessingErrors = [];

  const itemUpsertOps = [];
  const backupInsertOps = [];
  const itemDeleteOps = [];

  const importUserId = user?._id || null;
  const importFileName = req?.file?.originalname || "unknown_excel_file.xlsx";

  const session = await mongoose.startSession(); // Start session for transaction

  try {
    session.startTransaction();
    logger.info(
      logContextPrefix,
      "Starting database sync with Excel data within transaction.",
      { userId: importUserId },
      { itemCountExcel: excelItems.length, sessionId: session.id }
    );

    const existingDbItems = await Item.find().session(session).lean();
    const dbItemsMap = new Map(
      existingDbItems.map((item) => [item.name.toLowerCase(), item])
    );
    const excelItemNamesLowerCase = new Set(
      excelItems.map((item) => item.name.toLowerCase())
    );

    logger.debug(
      logContextPrefix,
      `Fetched ${existingDbItems.length} existing items from DB.`,
      { userId: importUserId }
    );

    for (const excelItemData of excelItems) {
      const normalizedExcelItemName = excelItemData.name.toLowerCase();
      const existingItem = dbItemsMap.get(normalizedExcelItemName);

      const quantityForPayload =
        excelItemData.quantity !== undefined
          ? parseFloat(excelItemData.quantity) || 0
          : existingItem
          ? existingItem.quantity
          : 0;

      // Construct pricing object
      const pricingPayload = {
        baseUnit: excelItemData.baseUnit || "Nos",
        sellingPrice: parseFloat(excelItemData.sellingPriceBaseUnit) || 0,
        buyingPrice: parseFloat(excelItemData.buyingPriceBaseUnit) || 0,
      };

      // Construct units array
      const unitsPayload = [
        {
          name: pricingPayload.baseUnit,
          isBaseUnit: true,
          conversionFactor: 1,
        },
      ];
      // Add custom units from Excel data
      for (let i = 1; i <= MAX_CUSTOM_UNITS_TO_EXPORT; i++) {
        const unitNameKey = `customUnit${i}Name`;
        const conversionFactorKey = `customUnit${i}ConversionFactor`;
        if (excelItemData[unitNameKey] && excelItemData[conversionFactorKey]) {
          unitsPayload.push({
            name: excelItemData[unitNameKey],
            isBaseUnit: false,
            conversionFactor: parseFloat(excelItemData[conversionFactorKey]),
          });
        }
      }

      // Merge with existing units, prioritizing Excel data
      const finalUnits = [];
      const seenUnitNames = new Set();

      // Add units from Excel payload, ensuring uniqueness
      unitsPayload.forEach((u) => {
        const lowerCaseName = u.name.toLowerCase();
        if (!seenUnitNames.has(lowerCaseName)) {
          finalUnits.push(u);
          seenUnitNames.add(lowerCaseName);
        }
      });
      // Merge with existing units if updating and new units are not fully specified
      // This ensures that any units not explicitly in the Excel (e.g., if MAX_CUSTOM_UNITS_TO_EXPORT is less than total units)
      // are preserved from the existing item, unless they conflict with an Excel-provided unit.
      if (existingItem && existingItem.units) {
        existingItem.units.forEach((u) => {
          const lowerCaseName = u.name.toLowerCase();
          if (!seenUnitNames.has(lowerCaseName)) {
            finalUnits.push(u);
            seenUnitNames.add(lowerCaseName);
          }
        });
      }

      // Ensure base unit is correctly marked and conversion factor is 1
      // And ensure only one base unit exists
      let hasBaseUnit = false;
      finalUnits.forEach((u) => {
        if (u.name.toLowerCase() === pricingPayload.baseUnit.toLowerCase()) {
          u.isBaseUnit = true;
          u.conversionFactor = 1;
          hasBaseUnit = true;
        } else {
          u.isBaseUnit = false; // Ensure other units are not marked as base
        }
      });

      // If for some reason the base unit from pricingPayload wasn't in finalUnits (e.g., typo in Excel custom unit name)
      if (!hasBaseUnit) {
        finalUnits.unshift({
          name: pricingPayload.baseUnit,
          isBaseUnit: true,
          conversionFactor: 1,
        });
      }

      // Sort units to ensure base unit is always first, then by name for consistency
      finalUnits.sort((a, b) => {
        if (a.isBaseUnit) return -1;
        if (b.isBaseUnit) return 1;
        return a.name.localeCompare(b.name);
      });

      const payload = {
        name: excelItemData.name,
        quantity: quantityForPayload,
        pricing: pricingPayload,
        units: finalUnits,
        category: excelItemData.category || "Other",
        // subcategory: excelItemData.subcategory || "General", // Removed
        gstRate: excelItemData.gstRate || 0,
        hsnCode: excelItemData.hsnCode || "",
        maxDiscountPercentage: excelItemData.maxDiscountPercentage || 0,
        lowStockThreshold: excelItemData.lowStockThreshold || 5,
        image:
          excelItemData.image !== undefined
            ? excelItemData.image
            : existingItem?.image || "",
        discountAvailable:
          excelItemData.discountAvailable !== undefined
            ? excelItemData.discountAvailable
            : existingItem?.discountAvailable || false,
        lastPurchaseDate:
          excelItemData.lastPurchaseDate !== undefined
            ? excelItemData.lastPurchaseDate
            : existingItem?.lastPurchaseDate || null,
        lastPurchasePrice:
          excelItemData.lastPurchasePrice !== undefined
            ? excelItemData.lastPurchasePrice
            : existingItem?.lastPurchasePrice || null,
        status:
          excelItemData.status ||
          (existingItem
            ? existingItem.status
            : importUserId && user?.role === "user"
            ? "pending_review"
            : "approved"), // Handle status from Excel or default
        createdBy: existingItem ? existingItem.createdBy : importUserId, // Preserve original creator or set new
      };

      if (
        payload.status === "approved" &&
        (!existingItem || existingItem.status !== "approved")
      ) {
        payload.reviewedBy = importUserId;
        payload.reviewedAt = new Date();
      }

      payload.needsRestock = payload.quantity < payload.lowStockThreshold; // Corrected logic for needsRestock

      if (existingItem) {
        const currentHistory = existingItem.excelImportHistory || [];
        const changes = [];
        let itemActuallyModified = false;
        const compareObjects = (obj1, obj2) => {
          if (obj1 === obj2) return true;
          if (
            typeof obj1 !== "object" ||
            obj1 === null ||
            typeof obj2 !== "object" ||
            obj2 === null
          )
            return false;
          const keys1 = Object.keys(obj1);
          const keys2 = Object.keys(obj2);
          if (keys1.length !== keys2.length) return false;
          for (const key of keys1) {
            if (!keys2.includes(key) || !compareObjects(obj1[key], obj2[key])) {
              return false;
            }
          }
          return true;
        };

        const compareUnits = (arr1, arr2) => {
          if (arr1.length !== arr2.length) return false;
          // Sort arrays by name for consistent comparison
          const sortedArr1 = [...arr1].sort((a, b) =>
            a.name.localeCompare(b.name)
          );
          const sortedArr2 = [...arr2].sort((a, b) =>
            a.name.localeCompare(b.name)
          );

          for (let i = 0; i < sortedArr1.length; i++) {
            if (!compareObjects(sortedArr1[i], sortedArr2[i])) {
              return false;
            }
          }
          return true;
        };

        // Check for changes in simple fields
        Object.keys(payload).forEach((key) => {
          if (key === "pricing" || key === "units") return; // Handle these separately
          if (String(existingItem[key]) !== String(payload[key])) {
            changes.push({
              field: key,
              oldValue: existingItem[key],
              newValue: payload[key],
            });
            itemActuallyModified = true;
          }
        });

        // Check for changes in pricing object
        if (!compareObjects(existingItem.pricing, payload.pricing)) {
          changes.push({
            field: "pricing",
            oldValue: existingItem.pricing,
            newValue: payload.pricing,
          });
          itemActuallyModified = true;
        }

        // Check for changes in units array
        if (!compareUnits(existingItem.units, payload.units)) {
          changes.push({
            field: "units",
            oldValue: existingItem.units,
            newValue: payload.units,
          });
          itemActuallyModified = true;
        }

        if (itemActuallyModified) {
          currentHistory.push({
            action: "updated",
            importedBy: importUserId,
            importedAt: new Date(),
            fileName: importFileName,
            changes: changes,
          });
          payload.excelImportHistory = currentHistory;

          itemUpsertOps.push({
            updateOne: {
              filter: { _id: existingItem._id },
              update: { $set: payload },
            },
          });
          logger.debug(
            logContextPrefix,
            `Item "${excelItemData.name}" marked for UPDATE with history.`,
            { userId: importUserId },
            { itemId: existingItem._id }
          );
        } else {
          logger.debug(
            logContextPrefix,
            `Item "${excelItemData.name}" has no changes from Excel. Skipping update.`,
            { userId: importUserId },
            { itemId: existingItem._id }
          );
        }
      } else {
        // New item
        payload.excelImportHistory = [
          {
            action: "created",
            importedBy: importUserId,
            importedAt: new Date(),
            fileName: importFileName,
            snapshot: { ...payload }, // Snapshot of initial state
          },
        ];
        // If created by a 'user' role via Excel, it should be pending_review unless Excel specifies 'approved'
        if (
          importUserId &&
          user?.role === "user" &&
          payload.status !== "approved"
        ) {
          payload.status = "pending_review";
        } else if (payload.status === "approved") {
          // If Excel says approved, or admin creates
          payload.reviewedBy = importUserId;
          payload.reviewedAt = new Date();
        }
        payload.createdBy = importUserId; // Set creator for new items

        itemUpsertOps.push({
          insertOne: {
            document: payload,
          },
        });
        logger.debug(
          logContextPrefix,
          `Item "${excelItemData.name}" marked for CREATE with history.`,
          { userId: importUserId }
        );
      }
    }

    const itemsToBeDeletedFromDb = [];
    for (const dbItem of existingDbItems) {
      if (!excelItemNamesLowerCase.has(dbItem.name.toLowerCase())) {
        itemsToBeDeletedFromDb.push(dbItem);
      }
    }

    if (itemsToBeDeletedFromDb.length > 0) {
      logger.info(
        logContextPrefix,
        `${itemsToBeDeletedFromDb.length} items identified for DELETION. Preparing backups.`,
        { userId: importUserId }
      );
      for (const itemToDelete of itemsToBeDeletedFromDb) {
        const backupDocData = itemToDelete; // Already a plain object from .lean()

        backupInsertOps.push({
          insertOne: {
            document: {
              originalId: itemToDelete._id,
              originalModel: "Item",
              data: backupDocData,
              deletedBy: importUserId,
              deletedAt: new Date(),
              // backupReason: "Deleted during Excel synchronization",
              originalCreatedAt: itemToDelete.createdAt,
              originalUpdatedAt: itemToDelete.updatedAt,
            },
          },
        });
        itemDeleteOps.push({
          deleteOne: {
            filter: { _id: itemToDelete._id },
          },
        });
        logger.debug(
          logContextPrefix,
          `Item "${itemToDelete.name}" (ID: ${itemToDelete._id}) marked for BACKUP (UniversalBackup) and DELETION.`,
          { userId: importUserId }
        );
      }
    } else {
      logger.info(
        logContextPrefix,
        "No items from DB are marked for deletion (all DB items present in Excel or DB is empty).",
        { userId: importUserId }
      );
    }

    if (backupInsertOps.length > 0) {
      logger.info(
        logContextPrefix,
        `Attempting to bulk insert ${backupInsertOps.length} item backups to UniversalBackup.`,
        { userId: importUserId }
      );
      try {
        const backupResult = await UniversalBackup.bulkWrite(backupInsertOps, {
          session,
          ordered: false,
        });
        logger.info(
          logContextPrefix,
          `UniversalBackup item backups bulk operation completed. Inserted: ${backupResult.insertedCount}.`,
          { userId: importUserId },
          {
            backupResult: {
              inserted: backupResult.insertedCount,
              errors: backupResult.hasWriteErrors()
                ? backupResult.getWriteErrors().length
                : 0,
            },
          }
        );

        if (backupResult.hasWriteErrors()) {
          const writeErrors = backupResult.getWriteErrors();
          logger.warn(
            logContextPrefix,
            `${writeErrors.length} errors occurred during UniversalBackup item backup. These items will not be deleted.`,
            { userId: importUserId }
          );
          writeErrors.forEach((err) => {
            const failedBackupOp =
              backupInsertOps[err.index]?.insertOne?.document;
            const originalItemId = failedBackupOp?.originalId;
            logger.error(
              logContextPrefix,
              `UniversalBackup failed for item (original name: ${failedBackupOp?.data?.name}, original ID: ${originalItemId}). Original item will NOT be deleted.`,
              { userId: importUserId },
              { error: err.errmsg, opDetails: failedBackupOp }
            );
            databaseProcessingErrors.push({
              name: `Backup for ${
                failedBackupOp?.data?.name || originalItemId
              }`,
              status: "backup_error",
              message: err.errmsg,
            });

            const deleteOpIndex = itemDeleteOps.findIndex(
              (op) =>
                op.deleteOne.filter._id.toString() === originalItemId.toString()
            );
            if (deleteOpIndex > -1) {
              itemDeleteOps.splice(deleteOpIndex, 1);
              logger.warn(
                logContextPrefix,
                `Removed item "${failedBackupOp?.data?.name}" (ID: ${originalItemId}) from deletion queue due to backup failure.`,
                { userId: importUserId }
              );
            }
          });
        }
      } catch (backupBulkError) {
        logger.error(
          logContextPrefix,
          "CRITICAL error during UniversalBackup.bulkWrite. ALL delete operations for this sync will be cancelled.",
          { userId: importUserId },
          { error: backupBulkError.message, stack: backupBulkError.stack }
        );
        databaseProcessingErrors.push({
          name: "Bulk Backup Operation",
          status: "critical_error",
          message: `UniversalBackup bulkWrite failed: ${backupBulkError.message}. No items were deleted.`,
        });
        itemDeleteOps.length = 0; // Cancel all deletions
        logger.warn(
          logContextPrefix,
          "All item delete operations cancelled due to critical failure in bulk backup.",
          { userId: importUserId }
        );
      }
    }

    if (itemUpsertOps.length > 0) {
      logger.info(
        logContextPrefix,
        `Attempting to bulk create/update ${itemUpsertOps.length} items.`,
        { userId: importUserId }
      );
      const upsertResult = await Item.bulkWrite(itemUpsertOps, {
        session,
        ordered: false,
      });
      itemsCreated = upsertResult.insertedCount || 0;
      itemsUpdated = upsertResult.modifiedCount || 0;

      logger.info(
        logContextPrefix,
        `Item create/update bulk operation completed. Created: ${itemsCreated}, Updated: ${itemsUpdated}.`,
        { userId: importUserId },
        {
          upsertResult: {
            inserted: itemsCreated,
            modified: itemsUpdated,
            errors: upsertResult.hasWriteErrors()
              ? upsertResult.getWriteErrors().length
              : 0,
          },
        }
      );
      operationResults.push({
        type: "upsert",
        created: itemsCreated,
        updated: itemsUpdated,
        hasErrors: upsertResult.hasWriteErrors(),
        errors: upsertResult.hasWriteErrors()
          ? upsertResult.getWriteErrors()
          : [],
      });
      if (upsertResult.hasWriteErrors()) {
        upsertResult.getWriteErrors().forEach((err) => {
          const opDescription = itemUpsertOps[err.index]?.insertOne
            ? `Create item "${
                itemUpsertOps[err.index].insertOne.document.name
              }"`
            : `Update item (filter: ${JSON.stringify(
                itemUpsertOps[err.index]?.updateOne?.filter
              )})`;
          logger.error(
            logContextPrefix,
            `DB Bulk Write Error during upsert: ${opDescription}`,
            { userId: importUserId },
            { error: err.errmsg, op: err.op }
          );
          databaseProcessingErrors.push({
            name: opDescription,
            status: "error",
            message: err.errmsg,
            details: err.op,
          });
        });
      }
    } else {
      logger.info(
        logContextPrefix,
        "No items to create or update from Excel.",
        { userId: importUserId }
      );
    }

    if (itemDeleteOps.length > 0) {
      // These are items whose backups were successful (or not needed if no deletions)
      logger.info(
        logContextPrefix,
        `Attempting to bulk delete ${itemDeleteOps.length} items (whose backups were processed).`,
        { userId: importUserId }
      );
      const deleteResult = await Item.bulkWrite(itemDeleteOps, {
        session,
        ordered: false,
      });
      itemsDeleted = deleteResult.deletedCount || 0;
      logger.info(
        logContextPrefix,
        `Item delete bulk operation completed. Deleted: ${itemsDeleted}.`,
        { userId: importUserId },
        {
          deleteResult: {
            deleted: itemsDeleted,
            errors: deleteResult.hasWriteErrors()
              ? deleteResult.getWriteErrors().length
              : 0,
          },
        }
      );
      operationResults.push({
        type: "delete",
        deleted: itemsDeleted,
        hasErrors: deleteResult.hasWriteErrors(),
        errors: deleteResult.hasWriteErrors()
          ? deleteResult.getWriteErrors()
          : [],
      });
      if (deleteResult.hasWriteErrors()) {
        deleteResult.getWriteErrors().forEach((err) => {
          const opDescription = `Delete item (filter: ${JSON.stringify(
            itemDeleteOps[err.index]?.deleteOne?.filter
          )})`;
          logger.error(
            logContextPrefix,
            `DB Bulk Write Error during delete: ${opDescription}`,
            { userId: importUserId },
            { error: err.errmsg, op: err.op }
          );
          databaseProcessingErrors.push({
            name: opDescription,
            status: "error",
            message: err.errmsg,
            details: err.op,
          });
        });
      }
    } else {
      logger.info(
        logContextPrefix,
        "No items to delete, or all deletions were cancelled due to backup issues.",
        { userId: importUserId }
      );
    }

    await session.commitTransaction();
    logger.info(
      logContextPrefix,
      "Database sync with Excel data finished and transaction committed.",
      { userId: importUserId },
      { itemsCreated, itemsUpdated, itemsDeleted }
    );
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
      logger.warn(
        logContextPrefix,
        `Transaction aborted due to error during syncItemsWithDatabase: ${error.message}`,
        { userId: importUserId },
        { error, stack: error.stack }
      );
    }
    logger.error(
      logContextPrefix,
      `CRITICAL error during syncItemsWithDatabase: ${error.message}`,
      { userId: importUserId },
      { error, stack: error.stack }
    );
    databaseProcessingErrors.push({
      name: "General Sync Error",
      status: "critical_error",
      message: error.message,
    });
  } finally {
    session.endSession();
  }

  return {
    itemsCreated,
    itemsUpdated,
    itemsDeleted,
    operationResults,
    databaseProcessingErrors,
  };
}

exports.importItemsFromExcelViaAPI = async (req, res) => {
  const user = req.user || null;
  logger.info(
    "excel_import_api",
    "API: Starting Excel import process from server file",
    { userId: user?._id }
  );

  try {
    const excelFilePath = require("path").resolve(
      __dirname,
      "..",
      "itemlist.xlsx"
    ); // Corrected path usage
    logger.debug(
      "excel_import_api",
      `Attempting to read Excel file from: ${excelFilePath}`,
      { userId: user?._id }
    );

    if (!require("fs").existsSync(excelFilePath)) {
      logger.error(
        "excel_import_api",
        "Excel file not found at specified path.",
        { path: excelFilePath, userId: user?._id }
      );
      return res
        .status(404)
        .json({ message: "Excel file (itemlist.xlsx) not found on server." });
    }

    const { itemsToUpsert, parsingErrors } = await parseExcelBufferForUpdate(
      require("fs").readFileSync(excelFilePath)
    );

    if (parsingErrors && parsingErrors.length > 0) {
      logger.warn(
        "excel_import_api",
        "API: Errors/Warnings during Excel parsing",
        {
          parsingErrorsCount: parsingErrors.length,
          parsingErrors,
          userId: user?._id,
        }
      );
    }

    if (!itemsToUpsert || itemsToUpsert.length === 0) {
      logger.info(
        "excel_import_api",
        "API: No items found in Excel to process",
        { userId: user?._id }
      );
      return res.status(200).json({
        message: "No valid items found in Excel to process or file is empty.",
        itemsCreated: 0,
        itemsUpdated: 0,
        itemsDeleted: 0,
        parsingErrors,
      });
    }

    const {
      itemsCreated,
      itemsUpdated,
      itemsDeleted,
      operationResults,
      databaseProcessingErrors,
    } = await syncItemsWithDatabase(
      req,
      itemsToUpsert,
      user,
      "excel_import_api"
    );

    logger.info("excel_import_api", "API: Excel import process completed", {
      itemsCreated,
      itemsUpdated,
      itemsDeleted,
      errors: databaseProcessingErrors.length,
      userId: user?._id,
    });
    res.status(200).json({
      message: "Excel data processed.",
      itemsCreated,
      itemsUpdated,
      itemsDeleted,
      parsingErrors,
      databaseProcessingDetails: operationResults,
      databaseProcessingErrors,
    });
  } catch (error) {
    logger.error(
      "excel_import_api",
      "API: Unhandled error during Excel import process",
      { error: error.message, stack: error.stack, userId: user?._id }
    );
    res.status(500).json({
      message: "Server error during Excel processing.",
      error: error.message,
    });
  }
};

exports.getCategories = async (req, res) => {
  const user = req.user || null;
  try {
    logger.debug("item", "Attempting to fetch categories", user);
    // Fetch distinct categories efficiently
    const aggregationResult = await Item.aggregate([
      { $match: { status: "approved" } }, // Only consider approved items for category listing
      {
        $group: {
          _id: "$category",
          // subcategories: { $addToSet: "$subcategory" }, // Removed
        },
      },
      { $project: { category: "$_id", _id: 0 } }, // subcategories: 1 removed
      { $sort: { category: 1 } },
    ]);

    const categories = aggregationResult.map((catGroup) => ({
      category: catGroup.category || "Other",
      // subcategories: (catGroup.subcategories || ["General"]) // Removed
      //   .filter(Boolean)
      //   .sort(),
    }));

    logger.debug("item", "Categories fetched successfully", user, {
      categoryCount: categories.length,
    });
    res.json(categories);
  } catch (error) {
    logger.error("item", "Error in getCategories", error, user);
    res.status(500).json({
      success: false,
      message: "Error fetching categories",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

exports.createCategory = async (req, res) => {
  const user = req.user || null;
  const { categoryName } = req.body;
  const logDetails = { userId: user?._id, categoryName };

  if (
    !categoryName ||
    typeof categoryName !== "string" ||
    categoryName.trim() === ""
  ) {
    logger.warn(
      "item",
      "API: createCategory - Invalid or missing categoryName",
      user,
      logDetails
    );
    return res.status(400).json({ message: "Category name is required." });
  }

  const trimmedCategoryName = categoryName.trim();

  try {
    logger.info(
      "item",
      `API: createCategory - Attempting to create category "${trimmedCategoryName}"`,
      user,
      logDetails
    );

    // Check if a category effectively exists (even via a dummy item)
    const existingCategory = await Item.findOne({
      category: trimmedCategoryName,
    });
    if (existingCategory) {
      logger.info(
        "item",
        `API: createCategory - Category "${trimmedCategoryName}" already exists or an item with this category exists.`,
        user,
        logDetails
      );
      return res
        .status(409)
        .json({ message: `Category "${trimmedCategoryName}" already exists.` });
    }

    logger.info(
      "item",
      `API: createCategory - Category "${trimmedCategoryName}" is available for use.`,
      user,
      logDetails
    );
    res.status(201).json({
      message: `Category "${trimmedCategoryName}" is available. It will be formally created when an item is saved with it.`,
      category: trimmedCategoryName,
    });
  } catch (error) {
    logger.error(
      "item",
      `API: createCategory - Error checking/creating category "${trimmedCategoryName}"`,
      error,
      user,
      logDetails
    );
    res.status(500).json({
      message: "Server error while adding category",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// exports.createSubcategory = async (req, res) => {
//   const user = req.user || null;
//   const { categoryName, subcategoryName } = req.body;
//   const logDetails = { userId: user?._id, categoryName, subcategoryName };

//   if (
//     !categoryName ||
//     typeof categoryName !== "string" ||
//     categoryName.trim() === ""
//   ) {
//     logger.warn(
//       "item",
//       "API: createSubcategory - Invalid or missing categoryName",
//       user,
//       logDetails
//     );
//     return res.status(400).json({ message: "Category name is required." });
//   }
//   if (
//     !subcategoryName ||
//     typeof subcategoryName !== "string" ||
//     subcategoryName.trim() === ""
//   ) {
//     logger.warn(
//       "item",
//       "API: createSubcategory - Invalid or missing subcategoryName",
//       user,
//       logDetails
//     );
//     return res.status(400).json({ message: "Subcategory name is required." });
//   }

//   const trimmedCategoryName = categoryName.trim();
//   const trimmedSubcategoryName = subcategoryName.trim();

//   try {
//     logger.info(
//       "item",
//       `API: createSubcategory - Attempting to add subcategory "${trimmedSubcategoryName}" to category "${trimmedCategoryName}"`,
//       user,
//       logDetails
//     );

//     const existingSubcategory = await Item.findOne({
//       category: trimmedCategoryName,
//       // subcategory: trimmedSubcategoryName, // Subcategory removed
//     });
//     if (existingSubcategory) {
//       logger.info(
//         "item",
//         `API: createSubcategory - Subcategory "${trimmedSubcategoryName}" already exists under category "${trimmedCategoryName}"`,
//         user,
//         logDetails
//       );
//       return res
//         .status(409)
//         .json({
//           message: `Subcategory "${trimmedSubcategoryName}" already exists under category "${trimmedCategoryName}".`,
//         });
//     }

//     logger.info(
//       "item",
//       `API: createSubcategory - Subcategory "${trimmedSubcategoryName}" under category "${trimmedCategoryName}" is available for use.`,
//       user,
//       logDetails
//     );
//     res
//       .status(201)
//       .json({
//         message: `Subcategory "${trimmedSubcategoryName}" is available for category "${trimmedCategoryName}". It will be formally created when an item is saved with it.`,
//         category: trimmedCategoryName,
//         // subcategory: trimmedSubcategoryName, // Subcategory removed
//       });
//   } catch (error) {
//     logger.error(
//       "item",
//       `API: createSubcategory - Error adding subcategory "${trimmedSubcategoryName}" to category "${trimmedCategoryName}"`,
//       error,
//       user,
//       logDetails
//     );
//     res.status(500).json({
//       message: "Server error while adding subcategory",
//       error: process.env.NODE_ENV === "development" ? error.message : undefined,
//     });
//   }
// };

exports.getItemById = async (req, res) => {
  const { id } = req.params;
  const user = req.user || null;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid item ID format" });
  }

  try {
    const item = await Item.findById(id)
      .populate("createdBy", "firstname lastname email")
      .populate("reviewedBy", "firstname lastname email")
      .populate({
        path: "inventoryLog.userReference", // Populate userReference within inventoryLog
        select: "firstname lastname email",
      })
      .populate({
        path: "inventoryLog.ticketReference", // Populate ticketReference within inventoryLog
        select: "ticketNumber", // Assuming Ticket model has ticketNumber
      })
      .populate({
        // Also populate excelImportHistory.importedBy
        path: "excelImportHistory.importedBy",
        select: "firstname lastname email",
      });

    if (!item) {
      logger.warn("item", `Item not found when fetching details: ${id}`, user);
      return res.status(404).json({ message: "Item not found" });
    }
    logger.info("item", `Fetched item by ID: ${id}`, user, {
      itemId: id,
      itemName: item.name,
    });
    res.json(item);
  } catch (error) {
    logger.error(
      "item",
      `Error fetching item details for ID: ${id}`,
      error,
      user
    );
    res.status(500).json({ message: "Server error while fetching item" });
  }
};

exports.createItem = async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      logger.warn(
        "item",
        "Create item attempt without authenticated user.",
        null,
        { requestBody: req.body }
      );
      return res.status(401).json({ message: "Authentication required." });
    }

    const quantity = parseFloat(req.body.quantity) || 0;
    const lowStockThreshold = req.body.lowStockThreshold
      ? parseInt(req.body.lowStockThreshold, 10)
      : 5;
    const sellingPrice = parseFloat(req.body.sellingPrice) || 0;
    const buyingPrice = parseFloat(req.body.buyingPrice) || 0;
    const image = req.body.image || "";

    if (buyingPrice > sellingPrice) {
      logger.warn(
        "item",
        "Create item attempt with buying price > selling price.",
        user,
        req.body
      );
      return res.status(400).json({
        message: "Buying price cannot be greater than selling price.",
      });
    }

    const newItemData = {
      name: req.body.name,
      quantity: quantity,
      pricing: req.body.pricing, // Expecting { baseUnit, sellingPrice, buyingPrice }
      units: req.body.units,
      gstRate: req.body.gstRate || 0,
      hsnCode: req.body.hsnCode || "",
      category: req.body.category || "Other",
      // subcategory: req.body.subcategory || "General", // Removed
      maxDiscountPercentage: req.body.maxDiscountPercentage
        ? parseFloat(req.body.maxDiscountPercentage)
        : 0,
      lowStockThreshold: lowStockThreshold,
      createdBy: user._id,
      image: image,
      needsRestock: quantity < lowStockThreshold,
    };

    if (user.role === "user") {
      newItemData.status = "pending_review";
    } else {
      // admin or super-admin
      newItemData.status = "approved";
      newItemData.reviewedBy = user._id;
      newItemData.reviewedAt = new Date();
    }

    const newItem = new Item(newItemData);
    const savedItem = await newItem.save();
    logger.info(
      "item",
      `Item created successfully by ${user.email} with status ${savedItem.status}`,
      user,
      {
        itemId: savedItem._id,
        itemName: savedItem.name,
        status: savedItem.status,
      }
    );
    res.status(201).json(savedItem);
  } catch (error) {
    logger.error("item", `Failed to create item`, error, req.user, {
      requestBody: req.body,
      userId: req.user?._id,
    });
    if (error.code === 11000) {
      // Duplicate key error
      return res.status(400).json({
        message:
          "An item with this name already exists. Please use a unique name.",
        errorType: "DuplicateKeyError",
      });
    }
    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: `Validation failed: ${error.message}`,
        errors: error.errors,
        errorType: "ValidationError",
      });
    }

    // For any other unexpected errors, return a 500 Internal Server Error
    res.status(500).json({
      message: "Server error during item creation.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
      errorType: "InternalServerError",
    });
  }
};

exports.updateItem = async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      logger.warn(
        "item",
        `Update item attempt without authenticated user. Item ID: ${req.params.id}`,
        null,
        { requestBody: req.body }
      );
      return res.status(401).json({ message: "Authentication required." });
    }

    const itemId = req.params.id;
    const existingItem = await Item.findById(itemId);
    if (!existingItem) {
      logger.warn("item", `Item not found for update: ${itemId}`, user, {
        itemId,
        requestBody: req.body,
      });
      return res.status(404).json({ message: "Item not found" });
    }

    const quantity =
      req.body.quantity !== undefined
        ? parseFloat(req.body.quantity) || 0
        : existingItem.quantity;

    // Robust handling for lowStockThreshold
    let resolvedLowStockThreshold;
    if (
      req.body.lowStockThreshold === undefined ||
      req.body.lowStockThreshold === null ||
      String(req.body.lowStockThreshold).trim() === ""
    ) {
      resolvedLowStockThreshold =
        existingItem.lowStockThreshold !== undefined
          ? existingItem.lowStockThreshold
          : 5;
    } else {
      const parsed = parseInt(String(req.body.lowStockThreshold), 10); // Ensure it's a string before parseInt
      if (Number.isFinite(parsed) && parsed >= 0) {
        resolvedLowStockThreshold = parsed;
      } else {
        logger.warn(
          `item`,
          `Invalid lowStockThreshold value "${req.body.lowStockThreshold}" for item ${itemId}. Using existing or default.`,
          user
        );
        resolvedLowStockThreshold =
          existingItem.lowStockThreshold !== undefined
            ? existingItem.lowStockThreshold
            : 5;
      }
    }
    const sellingPrice =
      req.body.sellingPrice !== undefined
        ? parseFloat(req.body.sellingPrice)
        : existingItem.sellingPrice;
    const buyingPrice =
      req.body.buyingPrice !== undefined
        ? parseFloat(req.body.buyingPrice)
        : existingItem.buyingPrice;

    if (buyingPrice > sellingPrice) {
      logger.warn(
        "item",
        `Update item attempt for ${itemId} with buying price > selling price.`,
        user,
        req.body
      );
      return res.status(400).json({
        message: "Buying price cannot be greater than selling price.",
      });
    }

    const updatePayload = {
      name: req.body.name,
      quantity: quantity,
      pricing: req.body.pricing, // Expecting { baseUnit, sellingPrice, buyingPrice }
      units: req.body.units,
      gstRate: req.body.gstRate || 0,
      hsnCode: req.body.hsnCode || "",
      category: req.body.category || "Other",
      // subcategory: req.body.subcategory || "General", // Removed
      maxDiscountPercentage: req.body.maxDiscountPercentage
        ? parseFloat(req.body.maxDiscountPercentage)
        : 0,
      lowStockThreshold: resolvedLowStockThreshold, // Use the resolved value
      needsRestock: quantity < resolvedLowStockThreshold,
      ...(req.body.image !== undefined && { image: req.body.image }),
    };

    // Handle status update logic
    if (
      req.body.status &&
      (user.role === "admin" || user.role === "super-admin")
    ) {
      if (["pending_review", "approved"].includes(req.body.status)) {
        updatePayload.status = req.body.status;
        if (
          req.body.status === "approved" &&
          existingItem.status !== "approved"
        ) {
          updatePayload.reviewedBy = user._id;
          updatePayload.reviewedAt = new Date();
          logger.info(
            "item",
            `Item ${itemId} status changed to 'approved' by ${user.email}.`,
            user,
            { itemId }
          );
        }
      }
    } else if (
      (user.role === "admin" || user.role === "super-admin") &&
      existingItem.status === "pending_review"
    ) {
      // If admin edits a pending item, it gets approved
      updatePayload.status = "approved";
      updatePayload.reviewedBy = user._id;
      updatePayload.reviewedAt = new Date();
      logger.info(
        "item",
        `Item ${itemId} approved upon update by admin ${user.email}.`,
        user,
        { itemId }
      );
    }

    // Prepare inventory log entries
    const inventoryLogEntries = []; // Initialize, will be populated by other changes if needed
    const changedFieldsDetails = []; // For general item details update log

    // Check for quantity change specifically for "Manual Quantity Adjustment"
    if (existingItem.quantity !== quantity) {
      inventoryLogEntries.push({
        type: "Manual Quantity Adjustment",
        date: new Date(),
        quantityChange: quantity - existingItem.quantity,
        details: `Quantity directly edited from ${
          existingItem.quantity
        } to ${quantity} by ${user.firstname || user.email}.`,
        userReference: user._id,
      });
    }

    // Check for other field changes
    for (const key in updatePayload) {
      if (
        key === "quantity" ||
        key === "needsRestock" ||
        key === "status" ||
        key === "reviewedBy" ||
        key === "reviewedAt"
      )
        continue; // Skip quantity as it's handled, and internal/status fields

      let existingValue = existingItem[key];
      let newValue = updatePayload[key];

      if (
        typeof existingValue === "number" ||
        !isNaN(parseFloat(existingValue))
      ) {
        existingValue = parseFloat(existingValue) || 0;
      }
      if (typeof newValue === "number" || !isNaN(parseFloat(newValue))) {
        newValue = parseFloat(newValue) || 0;
      }

      if (String(existingValue) !== String(newValue)) {
        changedFieldsDetails.push(
          `${key}: '${existingValue}' to '${newValue}'`
        );
      }
    }

    if (changedFieldsDetails.length > 0) {
      inventoryLogEntries.push({
        type: "Item Details Updated",
        date: new Date(),
        quantityChange: 0,
        details: `${changedFieldsDetails.join(", ")}.`,
        userReference: user._id,
      });
    }

    const updatedItem = await Item.findByIdAndUpdate(
      itemId,
      {
        $set: updatePayload,
        $push: { inventoryLog: { $each: inventoryLogEntries } },
      },
      { new: true, runValidators: true }
    );

    if (!updatedItem) {
      logger.warn(
        "item",
        `Item not found during update execution: ${itemId}`,
        user,
        { itemId, requestBody: req.body }
      );
      return res
        .status(404)
        .json({ message: "Item not found during update execution" });
    }

    logger.info("item", `Item updated successfully by ${user.email}`, user, {
      itemId: updatedItem._id,
      itemName: updatedItem.name,
      newStatus: updatedItem.status,
    });
    res.json(updatedItem);
  } catch (error) {
    logger.error(
      "item",
      `Error updating item ID: ${req.params.id}`,
      error,
      req.user,
      { requestBody: req.body, userId: req.user?._id }
    );
    if (error.code === 11000) {
      return res.status(400).json({
        message:
          "An item with this name already exists. Please use a unique name.",
      });
    }
    res.status(400).json({
      message: error.message.includes("validation")
        ? "Validation failed: " + error.message
        : "Error updating item",
    });
  }
};

exports.approveItem = async (req, res) => {
  try {
    const user = req.user;
    if (!user || (user.role !== "admin" && user.role !== "super-admin")) {
      logger.warn(
        "item",
        `Unauthorized attempt to approve item ${req.params.id} by user ${
          user?.email || "unknown"
        }.`,
        user
      );
      return res
        .status(403)
        .json({ message: "Forbidden: Only admins can approve items." });
    }

    const itemId = req.params.id;
    const itemToApprove = await Item.findById(itemId);

    if (!itemToApprove) {
      logger.warn("item", `Item not found for approval: ${itemId}`, user, {
        itemId,
      });
      return res.status(404).json({ message: "Item not found." });
    }

    if (itemToApprove.status === "approved") {
      logger.info(
        "item",
        `Item ${itemId} is already approved. No action taken by ${user.email}.`,
        user,
        { itemId }
      );
      return res.status(200).json(itemToApprove);
    }

    itemToApprove.status = "approved";
    itemToApprove.reviewedBy = user._id;
    itemToApprove.reviewedAt = new Date();

    const approvedItem = await itemToApprove.save();
    logger.info(
      "item",
      `Item ${itemId} approved successfully by ${user.email}.`,
      user,
      { itemId: approvedItem._id, itemName: approvedItem.name }
    );
    res.json(approvedItem);
  } catch (error) {
    logger.error(
      "item",
      `Error approving item ID: ${req.params.id}`,
      error,
      req.user,
      { userId: req.user?._id }
    );
    res.status(500).json({ message: "Error approving item." });
  }
};

exports.deleteItem = async (req, res) => {
  const itemId = req.params.id;
  const userId = req.user ? req.user._id : null;
  const user = req.user || null;
  const session = await mongoose.startSession();
  const logDetails = {
    userId,
    itemId,
    model: "Item",
    operation: "delete",
    sessionId: session.id.toString(),
  };

  logger.info(
    "delete",
    `[DELETE_INITIATED] Item ID: ${itemId}. Transaction started.`,
    user,
    logDetails
  );

  try {
    session.startTransaction();
    logger.debug(
      "delete",
      `[FETCH_ATTEMPT] Finding Item ID: ${itemId} for backup and deletion within transaction.`,
      user,
      logDetails
    );
    const itemToBackup = await Item.findById(itemId).session(session);

    if (!itemToBackup) {
      await session.abortTransaction();
      logger.warn(
        "delete",
        `[NOT_FOUND] Item not found for deletion. Transaction aborted.`,
        user,
        logDetails
      );
      return res.status(404).json({ message: "Item not found" });
    }
    logger.debug(
      "delete",
      `[FETCH_SUCCESS] Found Item ID: ${itemId}. Preparing for backup within transaction.`,
      user,
      logDetails
    );

    const backupData = {
      originalId: itemToBackup._id,
      originalModel: "Item",
      data: itemToBackup.toObject(),
      deletedBy: userId,
      deletedAt: new Date(),
      originalCreatedAt: itemToBackup.createdAt,
      originalUpdatedAt: itemToBackup.updatedAt,
      // backupReason: "User-initiated deletion via API",
    };

    const newBackupEntry = new UniversalBackup(backupData);

    logger.debug(
      "delete",
      `[PRE_BACKUP_SAVE] Attempting to save backup for Item ID: ${itemToBackup._id} to UniversalBackup within transaction.`,
      user,
      { ...logDetails, originalId: itemToBackup._id }
    );
    await newBackupEntry.save({ session });
    logger.info(
      "delete",
      `[BACKUP_SUCCESS] Item successfully backed up to UniversalBackup. Backup ID: ${newBackupEntry._id}.`,
      user,
      {
        ...logDetails,
        originalId: itemToBackup._id,
        backupId: newBackupEntry._id,
        backupModel: "UniversalBackup",
      }
    );

    logger.debug(
      "delete",
      `[PRE_ORIGINAL_DELETE] Attempting to delete original Item ID: ${itemToBackup._id} within transaction.`,
      user,
      { ...logDetails, originalId: itemToBackup._id }
    );
    const deleteResult = await Item.findByIdAndDelete(itemId, { session });
    if (!deleteResult) {
      await session.abortTransaction();
      logger.error(
        "delete",
        `[DELETE_FAILED_UNEXPECTEDLY] Item ${itemId} found but failed to delete. Transaction aborted.`,
        user,
        logDetails
      );
      return res.status(500).json({
        message: "Failed to delete item after backup. Operation rolled back.",
      });
    }
    logger.info(
      "delete",
      `[ORIGINAL_DELETE_SUCCESS] Original Item successfully deleted.`,
      user,
      { ...logDetails, originalId: itemToBackup._id }
    );

    logger.debug(
      "delete",
      `[UPDATE_PURCHASES_ATTEMPT] Unlinking deleted Item ID: ${itemId} from Purchase records within transaction.`,
      user,
      { ...logDetails, targetModel: "Purchase" }
    );
    const purchaseUpdateResult = await Purchase.updateMany(
      { "items.itemId": itemId },
      {
        $set: {
          "items.$.itemId": null,
          "items.$.description": `${itemToBackup.name} (Deleted)`,
        },
      },
      { session }
    );
    logger.info(
      "delete",
      `[UPDATE_PURCHASES_SUCCESS] Purchase records updated. Matched: ${purchaseUpdateResult.matchedCount}, Modified: ${purchaseUpdateResult.modifiedCount}.`,
      user,
      { ...logDetails, targetModel: "Purchase" }
    );

    await session.commitTransaction();
    res.status(200).json({
      message:
        "Item deleted, backed up, and related records updated successfully.",
      originalId: itemToBackup._id,
      backupId: newBackupEntry._id,
    });
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
      logger.warn(
        "delete",
        `[ROLLBACK_TRANSACTION] Transaction rolled back due to error during Item deletion process for ID: ${itemId}.`,
        user,
        { ...logDetails, errorMessage: error.message, stack: error.stack }
      );
    }
    logger.error(
      "delete",
      `[DELETE_ERROR] Error during Item deletion process for ID: ${itemId}.`,
      error,
      user,
      logDetails
    );
    res.status(500).json({
      message:
        "Server error during the deletion process. Please check server logs.",
    });
  } finally {
    if (session && session.endSession) {
      session.endSession();
    }
  }
};

exports.getItemPurchaseHistory = async (req, res) => {
  try {
    const user = req.user || null;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid item ID format" });
    }

    const itemExists = await Item.exists({ _id: id });
    if (!itemExists) {
      logger.warn(
        "item",
        `Item not found when fetching purchase history: ${id}`,
        user
      );
      return res.status(404).json({ message: "Item not found" });
    }

    const purchases = await Purchase.find(
      {
        "items.itemId": new mongoose.Types.ObjectId(id),
      },
      {
        date: 1,
        companyName: 1,
        gstNumber: 1,
        invoiceNumber: 1,
        "items.$": 1,
        createdBy: 1,
        "items.pricePerBaseUnit": 1,
      }
    )
      .populate("createdBy", "firstname lastname")
      .sort({ date: -1 })
      .limit(50);

    const formattedPurchases = purchases.map((purchase) => {
      const itemData = purchase.items[0];
      const createdByName = purchase.createdBy
        ? `${purchase.createdBy.firstname || ""} ${
            purchase.createdBy.lastname || ""
          }`.trim()
        : "System";

      return {
        _id: purchase._id,
        date: purchase.date,
        companyName: purchase.companyName,
        gstNumber: purchase.gstNumber,
        invoiceNumber: purchase.invoiceNumber,
        quantity: itemData?.quantity || 0,
        price: itemData?.price || 0,
        pricePerBaseUnit: itemData?.pricePerBaseUnit || 0, // Add this
        gstRate: itemData?.gstRate || 0,
        amount: (itemData?.price || 0) * (itemData?.quantity || 0),
        totalWithGst:
          (itemData?.price || 0) *
          (itemData?.quantity || 0) *
          (1 + (itemData?.gstRate || 0) / 100),
        createdByName: createdByName,
      };
    });

    res.json(formattedPurchases);
  } catch (error) {
    logger.error(
      "item",
      `Failed to fetch purchase history for item ID: ${req.params.id}`,
      error,
      user
    );
    res.status(500).json({
      message: "Server error while fetching purchase history",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

exports.getRestockSummary = async (req, res) => {
  const user = req.user || null;
  // const lowGlobalThreshold = parseInt(req.query.lowGlobalThreshold, 10) || 3; // This param is not used per new logic

  try {
    logger.debug("item", "Fetching restock summary", user);

    // Restock: quantity <= 0
    const restockNeededCount = await Item.countDocuments({
      quantity: { $lte: 0 },
      status: "approved",
    });

    // Low stock: quantity > 0 AND quantity <= item.lowStockThreshold
    const lowStockWarningCount = await Item.countDocuments({
      quantity: { $gt: 0 }, // quantity must be greater than 0
      $expr: { $lte: ["$quantity", "$lowStockThreshold"] }, // and quantity <= item's own lowStockThreshold
      status: "approved",
    });

    res.json({
      restockNeededCount: restockNeededCount,
      lowStockWarningCount: lowStockWarningCount,
    });
  } catch (error) {
    logger.error("item", "Error fetching restock summary", error, user, {
      // lowGlobalThreshold, // Removed as it's not used
      errorMessage: error.message,
      stack: error.stack,
    });
    res.status(500).json({
      message: "Server error while fetching restock summary",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "An unexpected error occurred.",
    });
  }
};

exports.clearItemLogs = async (req, res) => {
  const { itemId } = req.params;
  const user = req.user;

  // This is a destructive action, so we restrict it to super-admin
  if (user.role !== "super-admin") {
    logger.warn(
      "item-log-clear",
      `Unauthorized attempt to clear logs for item ${itemId} by user ${user.email}.`,
      user
    );
    return res
      .status(403)
      .json({
        message:
          "Forbidden: You do not have permission to perform this action.",
      });
  }

  try {
    const item = await Item.findById(itemId);
    if (!item) {
      logger.warn(
        "item-log-clear",
        `Item not found for log clearing: ${itemId}`,
        user
      );
      return res.status(404).json({ message: "Item not found." });
    }

    // Clear the log arrays
    item.inventoryLog = [];
    item.excelImportHistory = [];

    await item.save();

    logger.info(
      "item-log-clear",
      `All inventory and excel logs for item ${itemId} (${item.name}) cleared by ${user.email}.`,
      user
    );
    res
      .status(200)
      .json({ message: "All item logs have been cleared successfully." });
  } catch (error) {
    logger.error(
      "item-log-clear",
      `Error clearing logs for item ${itemId}`,
      error,
      user
    );
    res.status(500).json({ message: "Server error while clearing item logs." });
  }
};

exports.getItemTicketUsageHistory = async (req, res) => {
  const user = req.user || null;
  const { id: itemId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(itemId)) {
    logger.warn("item_ticket_usage", `Invalid item ID format: ${itemId}`, user);
    return res.status(400).json({ message: "Invalid item ID format" });
  }

  try {
    const item = await Item.findById(itemId).lean();
    if (!item) {
      logger.warn("item_ticket_usage", `Item not found: ${itemId}`, user);
      return res.status(404).json({ message: "Item not found" });
    }

    logger.debug(
      "item_ticket_usage",
      `Fetching ticket usage history for item: ${item.name} (ID: ${itemId})`,
      user
    );

    const queryConditions = {
      "goods.description": item.name,
      ...(item.hsnCode && { "goods.hsnSacCode": item.hsnCode }),
    };

    const ticketsContainingItem = await Ticket.find(queryConditions)
      .populate("createdBy", "firstname lastname")
      .populate("currentAssignee", "firstname lastname email")
      .select(
        "ticketNumber goods createdAt createdBy currentAssignee statusHistory"
      )
      .sort({ createdAt: -1 })
      .lean();

    const ticketUsageHistory = [];

    for (const ticket of ticketsContainingItem) {
      const relevantGood = ticket.goods.find(
        (g) =>
          g.description === item.name &&
          (item.hsnCode ? g.hsnSacCode === item.hsnCode : true)
      );

      if (relevantGood && relevantGood.quantity > 0) {
        ticketUsageHistory.push({
          date: ticket.createdAt,
          type: "Ticket Deduction (Initial)",
          user: ticket.createdBy
            ? `${ticket.createdBy.firstname || ""} ${
                ticket.createdBy.lastname || ""
              }`.trim()
            : "System",
          details: `Used ${relevantGood.quantity} unit(s) in Ticket: ${
            ticket.ticketNumber
          } (Created/Items Added). Assigned to: ${
            ticket.currentAssignee
              ? `${ticket.currentAssignee.firstname} ${ticket.currentAssignee.lastname}`
              : "N/A"
          }`,
          quantityChange: -parseFloat(relevantGood.quantity) || 0,
          ticketId: ticket._id,
          ticketNumber: ticket.ticketNumber,
        });
      }
    }

    logger.info(
      "item_ticket_usage",
      `Successfully fetched ${ticketUsageHistory.length} ticket usage entries for item: ${item.name}`,
      user
    );
    res.json(ticketUsageHistory);
  } catch (error) {
    logger.error(
      "item_ticket_usage",
      `Error fetching ticket usage history for item ID: ${itemId}`,
      error,
      user
    );
    res.status(500).json({
      message: "Server error while fetching item ticket usage history",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
