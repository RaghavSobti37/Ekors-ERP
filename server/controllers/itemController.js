const mongoose = require("mongoose");
const { Item, Purchase } = require("../models/itemlist");
const UniversalBackup = require("../models/universalBackup");
const logger = require("../logger"); // Use unified logger
const multer = require("multer");
const exceljs = require("exceljs");
const asyncHandler = require("express-async-handler");
const Ticket = require("../models/opentickets");
const { getInitialItemPayload, normalizeItemPayload, STANDARD_UNITS } = require("../utils/payloadServer");

// Constants
const MAX_CUSTOM_UNITS_TO_EXPORT = 1;
const DEFAULT_PROFIT_MARGIN = 20;

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      file.mimetype === "application/vnd.ms-excel"
    ) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only .xlsx and .xls files are allowed."), false);
    }
  },
  limits: { fileSize: 20 * 1024 * 1024 },
});

exports.uploadMiddleware = upload.single("excelFile");

// Helper functions
const handleErrorResponse = (res, error, context, user, req = null) => {
  const errorMessage = `Error in ${context}: ${error.message}`;
  logger.log({
    user,
    page: "Item",
    action: context,
    api: req?.originalUrl,
    req,
    message: errorMessage,
    details: { error: error.message, stack: error.stack },
    level: "error"
  });
  res.status(500).json({
    message: `Server error during ${context}`,
    error: process.env.NODE_ENV === "development" ? error.message : undefined,
  });
};

const validateItemData = (itemData) => {
  if (!itemData.name || typeof itemData.name !== 'string' || itemData.name.trim() === "") {
    throw new Error("Item name is required");
  }

  const sellingPrice = parseFloat(itemData.sellingPrice) || 0;
  const buyingPrice = parseFloat(itemData.buyingPrice) || 0;

  if (buyingPrice > sellingPrice && sellingPrice !== 0) {
    throw new Error("Buying price cannot be greater than selling price");
  }

  if (!Array.isArray(itemData.units) || !itemData.units.some(u => u && u.isBaseUnit)) {
    throw new Error("A base unit must be selected");
  }

  // Validate units structure
  if (Array.isArray(itemData.units)) {
    const baseUnits = itemData.units.filter(u => u && u.isBaseUnit);
    if (baseUnits.length !== 1) {
      throw new Error("Exactly one base unit must be selected");
    }
    // Defensive: Only check includes if STANDARD_UNITS is defined and baseUnits[0].name is a string
    if (typeof baseUnits[0].name === 'string' && Array.isArray(STANDARD_UNITS) && STANDARD_UNITS.includes(baseUnits[0].name)) {
      // ok
    } else if (typeof baseUnits[0].name === 'string' && Array.isArray(STANDARD_UNITS) && !STANDARD_UNITS.includes(baseUnits[0].name)) {
      throw new Error("Base unit must be a standard unit");
    }
    for (const unit of itemData.units) {
      if (!unit || typeof unit.name !== 'string' || unit.name.trim() === "") {
        throw new Error("All units must have a name");
      }
      if (unit.conversionFactor === undefined || unit.conversionFactor === null || isNaN(Number(unit.conversionFactor))) {
        throw new Error("All units must have a valid conversion factor");
      }
    }
  }
};

exports.getAllItems = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, search = "", status, sortKey, sortDirection } = req.query;
  const query = {};

  // Add search filter
  if (search && search.trim() !== "") {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { category: { $regex: search, $options: "i" } },
      { hsnCode: { $regex: search, $options: "i" } }
    ];
  }

  if (status) query.status = status;

  // Sorting
  let sort = {};
  if (sortKey && sortDirection) {
    sort[sortKey] = sortDirection === "ascending" ? 1 : -1;
  } else {
    sort.createdAt = -1;
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [data, totalItems] = await Promise.all([
    Item.find(query).sort(sort).skip(skip).limit(parseInt(limit)),
    Item.countDocuments(query)
  ]);

  res.json({ data, totalItems });
});


exports.exportItemsToExcel = asyncHandler(async (req, res) => {
  const user = req.user || null;

  try {
    const items = await Item.find({ status: "approved" })
      .sort({ category: 1, name: 1 })
      .lean();

    if (!items || items.length === 0) {
      return res.status(404).json({ message: "No approved items found to export." });
    }

    const workbook = new exceljs.Workbook();
    const worksheet = workbook.addWorksheet("Items");

    // Configure worksheet columns (remove image column)
    worksheet.columns = [
      { header: "Category", key: "category", width: 25 },
      { header: "Name", key: "name", width: 40 },
      { header: "Quantity", key: "quantity", width: 15 },
      { header: "HSN Code", key: "hsnCode", width: 15 },
      { header: "Base Unit", key: "baseUnit", width: 15 },
      { header: "Selling Price (per Base Unit)", key: "sellingPrice", width: 25 },
      { header: "Buying Price (per Base Unit)", key: "buyingPrice", width: 25 },
      { header: "GST (%)", key: "gstRate", width: 12 }, // <-- Added GST column
      ...Array.from({ length: MAX_CUSTOM_UNITS_TO_EXPORT }).flatMap((_, i) => [
        { header: `Custom Unit ${i + 1} Name`, key: `customUnit${i + 1}Name`, width: 20 },
        { header: `Custom Unit ${i + 1} Conversion Factor`, key: `customUnit${i + 1}ConversionFactor`, width: 25 },
      ]),
    ];

    // Apply header styling
    worksheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4472C4" } };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
    });

    let currentRow = 2;
    let currentCategory = null;

    for (const item of items) {
      if (item.category !== currentCategory) {
        // Add category header row
        const lastColumnLetter = String.fromCharCode("A".charCodeAt(0) + worksheet.columns.length - 1);
        worksheet.mergeCells(`A${currentRow}:${lastColumnLetter}${currentRow}`);

        const categoryCell = worksheet.getCell(`A${currentRow}`);
        categoryCell.value = `Category: ${item.category || "Other"}`;
        categoryCell.font = { bold: true, size: 12, color: { argb: "FF000000" } };
        categoryCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E1F2" } };
        categoryCell.alignment = { vertical: "middle", horizontal: "left" };
        currentCategory = item.category;
        currentRow++;
      }

      // Prepare row data with defaults
      const nonBaseUnits = item.units?.filter(u => !u.isBaseUnit) || [];
      const hsnCode = item.hsnCode && item.hsnCode !== "0" && item.hsnCode !== 0 ? item.hsnCode : "hsn123";
      const sellingPrice = item.sellingPrice && item.sellingPrice !== 0 ? item.sellingPrice : 100;
      const buyingPrice = item.buyingPrice && item.buyingPrice !== 0 ? item.buyingPrice : 10;

      const rowData = {
        category: item.category,
        name: item.name,
        quantity: item.quantity,
        hsnCode,
        baseUnit: item.baseUnit || "N/A",
        sellingPrice,
        buyingPrice,
        gstRate: item.gstRate, // <-- Add GST value
      };

      // Add custom units
      for (let i = 0; i < MAX_CUSTOM_UNITS_TO_EXPORT; i++) {
        if (nonBaseUnits[i]) {
          rowData[`customUnit${i + 1}Name`] = nonBaseUnits[i].name;
          rowData[`customUnit${i + 1}ConversionFactor`] = nonBaseUnits[i].conversionFactor;
        } else {
          rowData[`customUnit${i + 1}Name`] = "";
          rowData[`customUnit${i + 1}ConversionFactor`] = "";
        }
      }

      worksheet.addRow(rowData);
      const addedRow = worksheet.getRow(currentRow);

      // Set row height for all rows (no images now, but keep for consistency)
      addedRow.height = 30;

      // Apply cell styling
      addedRow.eachCell((cell) => {
        cell.alignment = { vertical: "middle", horizontal: "left" };
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });

      // Helper to get column index by key
      const getColIndex = (worksheet, key) => {
        return worksheet.columns.findIndex(col => col.key === key) + 1;
      };

      // Center align numeric columns
      ["quantity", "gstRate", "maxDiscountPercentage"].forEach(key => {
        const colIdx = getColIndex(worksheet, key);
        if (colIdx > 0) {
          addedRow.getCell(colIdx).alignment = { vertical: "middle", horizontal: "center" };
        }
      });

      ["sellingPrice", "buyingPrice"].forEach(key => {
        const colIdx = getColIndex(worksheet, key);
        if (colIdx > 0) {
          addedRow.getCell(colIdx).alignment = { vertical: "middle", horizontal: "right" };
        }
      });

      for (let j = 0; j < MAX_CUSTOM_UNITS_TO_EXPORT; j++) {
        const cellKey = `customUnit${j + 1}ConversionFactor`;
        const colIdx = getColIndex(worksheet, cellKey);
        if (colIdx > 0) {
          addedRow.getCell(colIdx).alignment = {
            vertical: "middle",
            horizontal: "center",
          };
        }
      }

      currentRow++;
    }

    const excelBuffer = await workbook.xlsx.writeBuffer();

    res.setHeader("Content-Disposition", 'attachment; filename="items_export.xlsx"');
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(excelBuffer);
  } catch (error) {
    handleErrorResponse(res, error, "Excel export process", user);
  }
});

// --- Excel Importer logic ---
async function parseExcelBufferForUpdate(fileBuffer, logger) {
  const itemsToUpsert = [];
  const parsingErrors = [];

  try {
    const workbook = new exceljs.Workbook();
    await workbook.xlsx.load(fileBuffer);
    const worksheet = workbook.getWorksheet(1);

    if (!worksheet) {
      parsingErrors.push({ row: 'general', message: 'No worksheet found in Excel file.' });
      return { itemsToUpsert, parsingErrors };
    }

    // Find the GST column index by header
    let gstColIdx = null;
    worksheet.getRow(1).eachCell((cell, colNumber) => {
      if (typeof cell.value === 'string' && cell.value.toLowerCase().includes('gst')) {
        gstColIdx = colNumber;
      }
    });

    worksheet.eachRow({ skipHeader: true }, (row, rowNumber) => {
      try {
        // Use header row to map columns robustly
        const headerMap = {};
        worksheet.getRow(1).eachCell((cell, colNumber) => {
          if (cell.value && typeof cell.value === 'string') {
            headerMap[cell.value.trim().toLowerCase()] = colNumber;
          }
        });
        // Defensive: get values by header name or fallback to index
        const getCellByHeader = (header, fallbackIdx) => {
          const idx = headerMap[header.toLowerCase()];
          return row.getCell(idx || fallbackIdx).value;
        };
        const name = getCellByHeader('name', 2);
        if (!name || typeof name !== 'string' || name.trim() === '') return; // skip invalid rows
        const baseUnit = getCellByHeader('base unit', 5) || 'nos';
        const item = {
          category: getCellByHeader('category', 1) || '',
          name,
          quantity: getCellByHeader('quantity', 3) || 0,
          hsnCode: getCellByHeader('hsn code', 4) || '',
          baseUnit,
          sellingPrice: getCellByHeader('selling price (per base unit)', 6) || 0,
          buyingPrice: getCellByHeader('buying price (per base unit)', 7) || 0,
          gstRate: getCellByHeader('gst (%)', 8) || 0,
          units: [
            { name: baseUnit, isBaseUnit: true, conversionFactor: 1 },
            // Optionally add custom units if present
            getCellByHeader('custom unit 1 name', 9) ? {
              name: getCellByHeader('custom unit 1 name', 9),
              isBaseUnit: false,
              conversionFactor: parseFloat(getCellByHeader('custom unit 1 conversion factor', 10)) || 1
            } : null
          ].filter(Boolean),
        };
        itemsToUpsert.push(item);
      } catch (err) {
        parsingErrors.push({ row: rowNumber, message: err.message });
      }
    });

    return { itemsToUpsert, parsingErrors };
  } catch (error) {
    if (logger) {
      logger.log({
        page: "Item Import",
        action: "Excel Import Parse Error",
        message: error.message,
        level: "error"
      });
    }
    return {
      itemsToUpsert: [],
      parsingErrors: [{ row: 'general', message: `Fatal error parsing Excel: ${error.message}` }],
    };
  }
}
// --- End Excel Importer logic ---
exports.importItemsFromUploadedExcel = asyncHandler(async (req, res) => {
  logger.log({
    user: req.user,
    page: "Item",
    action: "Excel Import",
   
    req,
    message: "Excel import started",
    level: "info"
  });

  if (!req.file || !req.file.buffer) {
    logger.log({
      user: req.user,
      page: "Item",
      action: "Excel Import",
     
      req,
      message: "No file uploaded",
      level: "warn"
    });
    return res.status(400).json({ message: "No file uploaded." });
  }

  const { itemsToUpsert, parsingErrors } = await parseExcelBufferForUpdate(req.file.buffer, logger);

  logger.log({
    user: req.user,
    page: "Item",
    action: "Excel Import",
   
    req,
    message: `Parsed items: ${itemsToUpsert.length}, Errors: ${parsingErrors.length}`,
    details: { parsingErrors },
    level: "info"
  });

  if (!itemsToUpsert.length) {
    logger.log({
      user: req.user,
      page: "Item",
      action: "Excel Import",
     
      req,
      message: "No valid items found in Excel",
      details: { parsingErrors },
      level: "warn"
    });
    return res.status(400).json({ message: "No valid items found in Excel.", parsingErrors });
  }

  // --- Optimized Bulk Import ---
  const bulkOps = itemsToUpsert.map(item => {
    // Ensure required fields for new items
    return {
      updateOne: {
        filter: { name: item.name },
        update: {
          $set: {
            ...item,
            updatedAt: new Date(),
          },
          $setOnInsert: {
            createdAt: new Date(),
            status: "approved", // or your default
          }
        },
        upsert: true
      }
    };
  });

  let bulkResult = { upsertedCount: 0, modifiedCount: 0 };
  let upsertErrors = [];
  try {
    if (bulkOps.length > 0) {
      const result = await Item.bulkWrite(bulkOps, { ordered: false });
      bulkResult = result;
    }
  } catch (err) {
    // Collect errors for reporting
    upsertErrors.push({ error: err.message });
    logger.log({
      user: req.user,
      page: "Item",
      action: "Excel Import",
     
      req,
      message: `Bulk import error`,
      details: { error: err.message },
      level: "error"
    });
  }

  // Calculate created and updated counts
  const created = bulkResult.upsertedCount || 0;
  const updated = (bulkResult.modifiedCount || 0);

  logger.log({
    user: req.user,
    page: "Item",
    action: "Excel Import",
   
    req,
    message: `Import finished. Created: ${created}, Updated: ${updated}, Errors: ${upsertErrors.length}`,
    details: { created, updated, upsertErrors },
    level: "info"
  });

  res.json({
    message: "Items imported successfully.",
    created,
    updated,
    deleted: 0,
    parsingErrors,
    upsertErrors,
  });
});

exports.importItemsFromExcelViaAPI = asyncHandler(async (req, res) => {
  const user = req.user || null;
 
  try {
    const excelFilePath = require("path").resolve(__dirname, "..", "itemlist.xlsx");
    const fileBuffer = require("fs").readFileSync(excelFilePath);

    const { itemsToUpsert, parsingErrors } = await parseExcelBufferForUpdate(fileBuffer);

    if (!itemsToUpsert || itemsToUpsert.length === 0) {
     
      return res.status(200).json({
        message: "No valid items found in Excel to process or file is empty.",
        itemsCreated: 0,
        itemsUpdated: 0,
        itemsDeleted: 0,
        parsingErrors,
      });
    }

    const result = await syncItemsWithDatabase(req, itemsToUpsert, user, "excel_import_api");

    res.status(200).json({
      message: "Excel data processed.",
      itemsCreated: result.itemsCreated,
      itemsUpdated: result.itemsUpdated,
      itemsDeleted: result.itemsDeleted,
      parsingErrors,
      databaseProcessingDetails: result.operationResults,
      databaseProcessingErrors: result.databaseProcessingErrors,
    });
  } catch (error) {
    handleErrorResponse(res, error, "Excel import process", user);
  }
});

// Legacy getCategories endpoint removed. Use getAllCategories instead.
// exports.getCategories = asyncHandler(async (req, res) => {
//   const user = req.user || null;
//   try {
//     // Remove sorting by category
//     const categories = await Item.aggregate([
//       { $match: { status: "approved" } },
//       { $group: { _id: "$category" } },
//       { $project: { category: "$_id", _id: 0 } },
//     ]);

//     res.json(categories);
//   } catch (error) {
//     handleErrorResponse(res, error, "fetching categories", user);
//   }
// });

exports.createCategory = asyncHandler(async (req, res) => {
  const user = req.user || null;
  const { categoryName } = req.body;

  if (!categoryName?.trim()) {

    return res.status(400).json({ message: "Category name is required." });
  }

  const trimmedCategoryName = categoryName.trim();

  try {
    const existingCategory = await Item.findOne({ category: trimmedCategoryName });
    if (existingCategory) {
     
      return res.status(409).json({ message: `Category "${trimmedCategoryName}" already exists.` });
    }

    res.status(201).json({
      message: `Category "${trimmedCategoryName}" is available. It will be formally created when an item is saved with it.`,
      category: trimmedCategoryName,
    });
  } catch (error) {
    handleErrorResponse(res, error, "adding category", user);
  }
});

exports.getItemById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = req.user || null;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid item ID format" });
  }

  try {
    // Support ?populate=field1,field2,field3
    let query = Item.findById(id);
    const populateParam = req.query.populate;
    if (populateParam) {
      const fields = populateParam.split(",").map(f => f.trim());
      fields.forEach(field => {
        // Nested population for logs
        if (field === "inventoryLog.userReference") {
          query = query.populate({
            path: "inventoryLog.userReference",
            select: "firstname lastname email"
          });
        } else if (field === "inventoryLog.ticketReference") {
          query = query.populate({
            path: "inventoryLog.ticketReference",
            select: "ticketNumber"
          });
        } else if (field === "excelImportHistory.importedBy") {
          query = query.populate({
            path: "excelImportHistory.importedBy",
            select: "firstname lastname email"
          });
        } else if (["createdBy", "reviewedBy"].includes(field)) {
          query = query.populate(field, "firstname lastname email");
        }
      });
    } else {
      // Default population if none specified
      query = query
        .populate("createdBy reviewedBy", "firstname lastname email")
        .populate({ path: "inventoryLog.userReference", select: "firstname lastname email" })
        .populate({ path: "inventoryLog.ticketReference", select: "ticketNumber" })
        .populate({ path: "excelImportHistory.importedBy", select: "firstname lastname email" });
    }

    const item = await query.lean(); // Make sure units is not excluded in projection

    if (!item) {

      return res.status(404).json({ message: "Item not found" });
    }

    res.json(item);
  } catch (error) {
    logger.log({
      user,
      page: "Item",
      action: "Error",
     
      req,
      message: `Error fetching item details for ID: ${id}`,
      details: { error: error.message, stack: error.stack },
      level: "error"
    });
    handleErrorResponse(res, error, `fetching item details for ID: ${id}`, user);
  }
});

const normalizeUnitsToLowercaseAndBase = (units, baseUnit) => {
  baseUnit = baseUnit?.toLowerCase();
  let foundBase = false;
  const normalized = units
    .map(unit => {
      const name = unit.name.toLowerCase();
      if (name === baseUnit) {
        foundBase = true;
        return {
          ...unit,
          name,
          isBaseUnit: true,
          conversionFactor: 1,
        };
      }
      return {
        ...unit,
        name,
        isBaseUnit: false,
        conversionFactor: Number(unit.conversionFactor) || 1,
      };
    });

  // If no base unit found, add it
  if (!foundBase && baseUnit) {
    normalized.unshift({
      name: baseUnit,
      isBaseUnit: true,
      conversionFactor: 1,
    });
  }

  // Remove any duplicate units with the same name
  const unique = [];
  const seen = new Set();
  for (const u of normalized) {
    if (!seen.has(u.name)) {
      unique.push(u);
      seen.add(u.name);
    }
  }
  return unique;
};

exports.createItem = asyncHandler(async (req, res) => {
  const user = req.user;
  if (!user) {
    logger.log({
      user: null,
      page: "Item",
      action: "Create Item",
     
      req,
      message: "Create item attempt without authenticated user.",
      details: {},
      level: "warn"
    });
    return res.status(401).json({ message: "Authentication required." });
  }

  try {
    req.body.baseUnit = req.body.baseUnit?.toLowerCase();
    if (Array.isArray(req.body.units)) {
      req.body.units = normalizeUnitsToLowercaseAndBase(req.body.units, req.body.baseUnit);
    }

    validateItemData(req.body);

    // Process units - ensure exactly one base unit
    const units = req.body.units.map(unit => ({
      name: unit.name,
      isBaseUnit: !!unit.isBaseUnit,
      conversionFactor: unit.isBaseUnit ? 1 : Number(unit.conversionFactor) || 1
    }));

    const baseUnit = units.find(u => u.isBaseUnit);
    if (!baseUnit) {
      throw new Error("A base unit must be specified");
    }

    const quantity = parseFloat(req.body.quantity) || 0;

    const newItemData = {
      name: req.body.name,
      quantity: quantity,
      baseUnit: baseUnit.name,
      sellingPrice: parseFloat(req.body.sellingPrice) || 0,
      buyingPrice: parseFloat(req.body.buyingPrice) || 0,
      profitMarginPercentage: parseFloat(req.body.profitMarginPercentage) || DEFAULT_PROFIT_MARGIN,
      units: units,
      gstRate: req.body.gstRate || 0,
      hsnCode: req.body.hsnCode || "",
      category: req.body.category || "Other",
      maxDiscountPercentage: req.body.maxDiscountPercentage !== undefined ? parseFloat(req.body.maxDiscountPercentage) : existingItem?.maxDiscountPercentage || 0,
      createdBy: user._id,
      image: req.body.image || "",
      status: user.role === "user" ? "pending_review" : "approved",
    };

    if (newItemData.status === "approved") {
      newItemData.reviewedBy = user._id;
      newItemData.reviewedAt = new Date();
    }

    const newItem = new Item(newItemData);
    const savedItem = await newItem.save();

    logger.log({
      user,
      page: "Item",
      action: "Create Item",
     
      req,
      message: `Item created successfully by ${user.email}`,
      details: {
        itemId: savedItem._id,
        itemName: savedItem.name,
        status: savedItem.status,
      },
      level: "info"
    });

    res.status(201).json(savedItem);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        message: "An item with this name already exists. Please use a unique name.",
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

    handleErrorResponse(res, error, "creating item", req.user, req);
  }
});

exports.updateItem = asyncHandler(async (req, res) => {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ message: "Authentication required." });
  }

  const itemId = req.params.id;
  if (!mongoose.Types.ObjectId.isValid(itemId)) {
    return res.status(400).json({ message: "Invalid item ID format" });
  }

  // Defensive normalization for all fields
  req.body = normalizeItemPayload(req.body);

  // Defensive: ensure units is always an array of objects with name
  req.body.units = req.body.units.filter(u => u && typeof u.name === 'string');

  // Defensive: ensure only one base unit
  if (req.body.units.length > 0) {
    let baseUnitFound = false;
    req.body.units = req.body.units.map(u => {
      if (u.name.toLowerCase() === req.body.baseUnit) {
        if (!baseUnitFound) {
          baseUnitFound = true;
          return { ...u, isBaseUnit: true, conversionFactor: 1 };
        } else {
          return { ...u, isBaseUnit: false };
        }
      }
      return { ...u, isBaseUnit: false };
    });
    if (!baseUnitFound && req.body.baseUnit) {
      req.body.units.unshift({ name: req.body.baseUnit, isBaseUnit: true, conversionFactor: 1 });
    }
  }

  try {
    validateItemData(req.body);

    const existingItem = await Item.findById(itemId);
    if (!existingItem) {
      return res.status(404).json({ message: "Item not found" });
    }

    // Process units - ensure exactly one base unit
    const units = req.body.units.map(unit => ({
      name: unit.name,
      isBaseUnit: !!unit.isBaseUnit,
      conversionFactor: unit.isBaseUnit ? 1 : Number(unit.conversionFactor) || 1
    }));

    const baseUnit = units.find(u => u.isBaseUnit);
    if (!baseUnit) {
      return res.status(400).json({ message: "A base unit must be selected." });
    }

    const quantity = req.body.quantity !== undefined ? req.body.quantity : existingItem.quantity;

    const updatePayload = {
      name: req.body.name,
      quantity: quantity,
      baseUnit: baseUnit.name,
      sellingPrice: req.body.sellingPrice !== undefined ? req.body.sellingPrice : existingItem.sellingPrice,
      buyingPrice: req.body.buyingPrice !== undefined ? req.body.buyingPrice : existingItem.buyingPrice,
      profitMarginPercentage: req.body.profitMarginPercentage,
      units: units,
      gstRate: req.body.gstRate,
      hsnCode: req.body.hsnCode,
      category: req.body.category,
      maxDiscountPercentage: req.body.maxDiscountPercentage !== undefined
        ? req.body.maxDiscountPercentage
        : existingItem.maxDiscountPercentage,
      ...(req.body.image !== undefined && { image: req.body.image }),
    };

    // Handle status update logic
    if (req.body.status && (user.role === "admin" || user.role === "super-admin")) {
      if (["pending_review", "approved"].includes(req.body.status)) {
        updatePayload.status = req.body.status;
        if (req.body.status === "approved" && existingItem.status !== "approved") {
          updatePayload.reviewedBy = user._id;
          updatePayload.reviewedAt = new Date();
        }
      }
    } else if ((user.role === "admin" || user.role === "super-admin") && existingItem.status === "pending_review") {
      // If admin edits a pending item, it gets approved
      updatePayload.status = "approved";
      updatePayload.reviewedBy = user._id;
      updatePayload.reviewedAt = new Date();
    }

    // Prepare inventory log entries
    const inventoryLogEntries = [];
    const changedFieldsDetails = [];

    // Check for quantity change
    if (existingItem.quantity !== quantity) {
      inventoryLogEntries.push({
        type: "Manual Quantity Adjustment",
        date: new Date(),
        quantityChange: quantity - existingItem.quantity,
        details: `Quantity directly edited from ${existingItem.quantity} to ${quantity} by ${user.firstname || user.email}.`,
        userReference: user._id,
      });
    }

    // Check for other field changes
    for (const key in updatePayload) {
      if (key === "quantity" || key === "needsRestock" || key === "status" || key === "reviewedBy" || key === "reviewedAt") continue;

      let existingValue = existingItem[key];
      let newValue = updatePayload[key];

      if (typeof existingValue === "number" || !isNaN(parseFloat(existingValue))) {
        existingValue = parseFloat(existingValue) || 0;
      }
      if (typeof newValue === "number" || !isNaN(parseFloat(newValue))) {
        newValue = parseFloat(newValue) || 0;
      }

      if (String(existingValue) !== String(newValue)) {
        changedFieldsDetails.push(`${key}: '${existingValue}' to '${newValue}'`);
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
    ).populate("createdBy reviewedBy", "firstname lastname email");

    if (!updatedItem) {
      return res.status(404).json({ message: "Item not found during update execution" });
    }

    res.json(updatedItem);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        message: "An item with this name already exists. Please use a unique name.",
      });
    }
    handleErrorResponse(res, error, `updating item ID: ${itemId}`, user);
  }
});
exports.approveItem = asyncHandler(async (req, res) => {
  const user = req.user;
  if (!user || (user.role !== "admin" && user.role !== "super-admin")) {

    return res.status(403).json({ message: "Forbidden: Only admins can approve items." });
  }

  const itemId = req.params.id;
  if (!mongoose.Types.ObjectId.isValid(itemId)) {
    return res.status(400).json({ message: "Invalid item ID format" });
  }

  try {
    const itemToApprove = await Item.findById(itemId);
    if (!itemToApprove) {

      return res.status(404).json({ message: "Item not found." });
    }

    if (itemToApprove.status === "approved") {
     
      return res.status(200).json(itemToApprove);
    }

    itemToApprove.status = "approved";
    itemToApprove.reviewedBy = user._id;
    itemToApprove.reviewedAt = new Date();

    const approvedItem = await itemToApprove.save();
   

    res.json(approvedItem);
  } catch (error) {
    handleErrorResponse(res, error, `approving item ID: ${itemId}`, user);
  }
});

exports.deleteItem = asyncHandler(async (req, res) => {
  const itemId = req.params.id;
  const user = req.user;
  const session = await mongoose.startSession();

  if (!mongoose.Types.ObjectId.isValid(itemId)) {
    return res.status(400).json({ message: "Invalid item ID format" });
  }

  try {
    await session.withTransaction(async () => {
      

      const itemToBackup = await Item.findById(itemId).session(session);
      if (!itemToBackup) {

        return res.status(404).json({ message: "Item not found" });
      }

      // Create backup
      const backupData = {
        originalId: itemToBackup._id,
        originalModel: "Item",
        data: itemToBackup.toObject(),
        deletedBy: user?._id,
        deletedAt: new Date(),
        originalCreatedAt: itemToBackup.createdAt,
        originalUpdatedAt: itemToBackup.updatedAt,
      };

      await UniversalBackup.create([backupData], { session });

      // Delete the item
      const deleteResult = await Item.findByIdAndDelete(itemId, { session });
      if (!deleteResult) {
        throw new Error("Failed to delete item after backup");
      }

      // Update related purchases
      await Purchase.updateMany(
        { "items.itemId": itemId },
        {
          $set: {
            "items.$.itemId": null,
            "items.$.description": `${itemToBackup.name} (Deleted)`,
          },
        },
        { session }
      );

   
      res.status(200).json({
        message: "Item deleted and backed up successfully.",
        originalId: itemToBackup._id,
      });
    });
  } catch (error) {
    logger.log({
      user,
      page: "Item",
      action: "Error",
     
      req,
      message: `Error deleting item ${itemId}: ${error.message}`,
      details: { error: error.message, stack: error.stack },
      level: "error"
    });
    res.status(500).json({
      message: "Server error during the deletion process.",
    });
  } finally {
    session.endSession();
  }
});

exports.getItemPurchaseHistory = asyncHandler(async (req, res) => {
  const user = req.user || null;
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {

  }

  try {
    const itemExists = await Item.exists({ _id: id });
    if (!itemExists) {

    }

    const purchases = await Purchase.find(
      { "items.itemId": new mongoose.Types.ObjectId(id) },
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

    const formattedPurchases = purchases.map(purchase => {
      const itemData = purchase.items[0];
      const createdByName = purchase.createdBy
        ? `${purchase.createdBy.firstname || ""} ${purchase.createdBy.lastname || ""}`.trim()
        : "System";

      return {
        _id: purchase._id,
        date: purchase.date,
        companyName: purchase.companyName,
        gstNumber: purchase.gstNumber,
        invoiceNumber: purchase.invoiceNumber,
        quantity: itemData?.quantity || 0,
        price: itemData?.price || 0,
        pricePerBaseUnit: itemData?.pricePerBaseUnit || 0,
        gstRate: itemData?.gstRate || 0,
        amount: (itemData?.price || 0) * (itemData?.quantity || 0),
        totalWithGst: (itemData?.price || 0) * (itemData?.quantity || 0) * (1 + (itemData?.gstRate || 0) / 100),
        createdByName: createdByName,
      };
    });

    res.json(formattedPurchases);
  } catch (error) {
    logger.log({
      user,
      page: "Item",
      action: "Error",
     
      req,
      message: `Error fetching all purchases`,
      details: { error: error.message, stack: error.stack },
      level: "error"
    });
    handleErrorResponse(res, error, `fetching purchase history for item ID: ${id}`, user);
  }
});

exports.getRestockSummary = asyncHandler(async (req, res) => {
  const user = req.user || null;

  try {
    // Only restock needed logic is active
    const restockItems = await Item.find({
      quantity: { $lte: 0 },
      status: "approved",
    }).select("_id name category quantity baseUnit");
    const restockNeededCount = restockItems.length;

    // const lowStockWarningCount = await Item.countDocuments({
    //   quantity: { $gt: 0 },
    //   $expr: { $lte: ["$quantity", "$lowStockThreshold"] },
    //   status: "approved",
    // });

    res.json({
      restockNeededCount,
      restockItems: restockItems, // List of items needing restock
      // lowStockWarningCount,
    });
  } catch (error) {
    handleErrorResponse(res, error, "fetching restock summary", user);
  }
});

exports.clearItemLogs = asyncHandler(async (req, res) => {
  const { itemId } = req.params;
  const user = req.user;

  if (user.role !== "super-admin") {
   
    return res.status(403).json({ message: "Forbidden: You do not have permission to perform this action." });
  }

  try {
    const item = await Item.findById(itemId);
    if (!item) {

    }

    item.inventoryLog = [];
    item.excelImportHistory = [];
    await item.save();

  
  } catch (error) {
    handleErrorResponse(res, error, `clearing logs for item ${itemId}`, user);
  }
});

exports.getItemTicketUsageHistory = asyncHandler(async (req, res) => {
  const user = req.user || null;
  const { id: itemId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(itemId)) {

  }

  try {
    const item = await Item.findById(itemId).lean();
    if (!item) {

    }

    const ticketsContainingItem = await Ticket.find({
      "goods.description": item.name,
      ...(item.hsnCode && { "goods.hsnCode": item.hsnCode }),
    })
      .populate("createdBy", "firstname lastname")
      .populate("currentAssignee", "firstname lastname email")
      .select("ticketNumber goods createdAt createdBy currentAssignee statusHistory")
      .sort({ createdAt: -1 })
      .lean();

    const ticketUsageHistory = ticketsContainingItem
      .map(ticket => {
        const relevantGood = ticket.goods.find(g => 
          g.description === item.name && 
          (item.hsnCode ? g.hsnCode === item.hsnCode : true)
        );

        if (!relevantGood || relevantGood.quantity <= 0) return null;

        return {
          date: ticket.createdAt,
          type: "Ticket Deduction (Initial)",
          user: ticket.createdBy
            ? `${ticket.createdBy.firstname || ""} ${ticket.createdBy.lastname || ""}`.trim()
            : "System",
          details: `Used ${relevantGood.quantity} unit(s) in Ticket: ${ticket.ticketNumber} (Created/Items Added). Assigned to: ${
            ticket.currentAssignee
              ? `${ticket.currentAssignee.firstname} ${ticket.currentAssignee.lastname}`
              : "N/A"
          }`,
          quantityChange: -parseFloat(relevantGood.quantity) || 0,
          ticketId: ticket._id,
          ticketNumber: ticket.ticketNumber,
        };
      })
      .filter(Boolean);

    res.json(ticketUsageHistory);
  } catch (error) {
    handleErrorResponse(res, error, `fetching ticket usage history for item ID: ${itemId}`, user);
  }
});

exports.getAllCategories = asyncHandler(async (req, res) => {
  try {
    const categories = await Item.getAllCategories();
    res.json({ categories });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch categories', error: error.message });
  }
});