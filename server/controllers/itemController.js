const mongoose = require("mongoose");
const { Item, Purchase } = require("../models/itemlist");
const UniversalBackup = require("../models/universalBackup");
const logger = require("../logger"); // Use unified logger
const multer = require("multer");
const exceljs = require("exceljs");
const asyncHandler = require("express-async-handler");
const Ticket = require("../models/opentickets");

// Constants
const MAX_CUSTOM_UNITS_TO_EXPORT = 1;
const DEFAULT_PROFIT_MARGIN = 20;

const STANDARD_UNITS = [
  'nos', 'pkt', 'pcs', 'kgs', 'mtr', 'sets', 'kwp', 'ltr', 'bottle', 'each', 'bag',  'set'
];

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
  if (!itemData.name) {
    throw new Error("Item name is required");
  }

  const sellingPrice = parseFloat(itemData.sellingPrice) || 0;
  const buyingPrice = parseFloat(itemData.buyingPrice) || 0;

  if (buyingPrice > sellingPrice && sellingPrice !== 0) {
    throw new Error("Buying price cannot be greater than selling price");
  }

  if (!itemData.units || !itemData.units.some(u => u.isBaseUnit)) {
    throw new Error("A base unit must be selected");
  }

  // Validate units structure
  if (itemData.units) {
    const baseUnits = itemData.units.filter(u => u.isBaseUnit);
    if (baseUnits.length !== 1) {
      throw new Error("Exactly one base unit must be specified");
    }
    
    if (!STANDARD_UNITS.includes(baseUnits[0].name)) {
      throw new Error(`Base unit must be one of: ${STANDARD_UNITS.join(', ')}`);
    }

    for (const unit of itemData.units) {
      if (!STANDARD_UNITS.includes(unit.name)) {
        throw new Error(`Invalid unit name: ${unit.name}. Must be one of: ${STANDARD_UNITS.join(', ')}`);
      }
      
      if (unit.isBaseUnit && unit.conversionFactor !== 1) {
        throw new Error("Base unit must have conversion factor of 1");
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
      throw new Error("No worksheet found in the Excel file.");
    }

    worksheet.eachRow({ skipHeader: true }, (row, rowNumber) => {
      // Skip category header rows
      const firstCell = row.getCell(1).value;
      if (typeof firstCell === "string" && firstCell.startsWith("Category:")) return;

      // Read columns by their correct index
      const category = row.getCell(1).value || "Other";
      const name = row.getCell(2).value;
      const quantity = row.getCell(3).value;
      const hsnCode = row.getCell(4).value || "hsn123";
      // E: GST Rate (optional, not used in item below)
      // F: Max Discount (optional, not used in item below)
      const baseUnit = row.getCell(5).value; // Correct: 5th column is Base Unit
      const sellingPrice = row.getCell(6).value || 100;
      const buyingPrice = row.getCell(7).value || 10;
      const customUnit1Name = row.getCell(8).value;
      const customUnit1ConversionFactor = row.getCell(9).value;

      if (!name) return; // skip empty rows

      // Always use the correct base unit column
      const units = [
        { name: String(baseUnit || 'Nos').trim(), isBaseUnit: true, conversionFactor: 1 }
      ];

      if (customUnit1Name && customUnit1ConversionFactor) {
        units.push({
          name: String(customUnit1Name).trim(),
          isBaseUnit: false,
          conversionFactor: parseFloat(customUnit1ConversionFactor),
        });
      }

      const item = {
        name: String(name).trim(),
        quantity: parseFloat(quantity) || 0,
        baseUnit: String(baseUnit || 'Nos').trim(),
        sellingPrice: parseFloat(sellingPrice) || 100,
        buyingPrice: parseFloat(buyingPrice) || 10,
        units,
        category: category || "Other",
        hsnCode: String(hsnCode || 'hsn123').trim(),
        // gstRate, maxDiscountPercentage, etc. can be added if needed
      };

      itemsToUpsert.push(item);
    });

    return { itemsToUpsert, parsingErrors };

  } catch (error) {
    if (logger) {
      logger.log({
        user: null,
        page: "Item",
        action: "Excel Import",
        api: "parseExcelBufferForUpdate",
        message: `Error parsing Excel file: ${error.message}`,
        details: { error: error.stack },
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
    api: req.originalUrl,
    req,
    message: "Excel import started",
    level: "info"
  });

  if (!req.file || !req.file.buffer) {
    logger.log({
      user: req.user,
      page: "Item",
      action: "Excel Import",
      api: req.originalUrl,
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
    api: req.originalUrl,
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
      api: req.originalUrl,
      req,
      message: "No valid items found in Excel",
      details: { parsingErrors },
      level: "warn"
    });
    return res.status(400).json({ message: "No valid items found in Excel.", parsingErrors });
  }

  let upserted = 0;
  let created = 0;
  let updated = 0;
  let upsertErrors = [];

  for (const item of itemsToUpsert) {
    try {
      const existing = await Item.findOne({ name: item.name });
      if (existing) {
        await Item.updateOne(
          { _id: existing._id },
          {
            $set: {
              ...item,
              updatedAt: new Date(),
            }
          }
        );
        updated++;
      } else {
        await Item.create(item);
        created++;
      }
      upserted++;
    } catch (err) {
      upsertErrors.push({ name: item.name, error: err.message });
      logger.log({
        user: req.user,
        page: "Item",
        action: "Excel Import",
        api: req.originalUrl,
        req,
        message: `Failed to upsert item: ${item.name}`,
        details: { error: err.message },
        level: "error"
      });
    }
  }

  // Optionally, handle deletions (items in DB but not in Excel)
  // Uncomment if you want to delete missing items:
  /*
  const excelNames = itemsToUpsert.map(i => i.name);
  const deleteResult = await Item.deleteMany({ name: { $nin: excelNames } });
  const deleted = deleteResult.deletedCount || 0;
  */
  const deleted = 0; // Set to actual deleted count if you implement deletion

  logger.log({
    user: req.user,
    page: "Item",
    action: "Excel Import",
    api: req.originalUrl,
    req,
    message: `Import finished. Created: ${created}, Updated: ${updated}, Deleted: ${deleted}, Errors: ${upsertErrors.length}`,
    details: { created, updated, deleted, upsertErrors },
    level: "info"
  });

  res.json({
    message: "Items imported successfully.",
    created,
    updated,
    deleted,
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

exports.getCategories = asyncHandler(async (req, res) => {
  const user = req.user || null;
  try {
    const categories = await Item.aggregate([
      { $match: { status: "approved" } },
      { $group: { _id: "$category" } },
      { $project: { category: "$_id", _id: 0 } },
      { $sort: { category: 1 } },
    ]);

    res.json(categories);
  } catch (error) {
    handleErrorResponse(res, error, "fetching categories", user);
  }
});

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

    const item = await query.lean();

    if (!item) {

      return res.status(404).json({ message: "Item not found" });
    }

    res.json(item);
  } catch (error) {
    logger.log({
      user,
      page: "Item",
      action: "Error",
      api: req.originalUrl,
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
      api: req.originalUrl,
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
      api: req.originalUrl,
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

  // Add this debug log:
  console.log("DEBUG: updateItem req.body.units received:", req.body.units);

  try {
    req.body.baseUnit = req.body.baseUnit?.toLowerCase();
    if (Array.isArray(req.body.units)) {
      req.body.units = normalizeUnitsToLowercaseAndBase(req.body.units, req.body.baseUnit);
    }

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
      throw new Error("A base unit must be specified");
    }

    const quantity = req.body.quantity !== undefined ? parseFloat(req.body.quantity) || 0 : existingItem.quantity;
    
    const updatePayload = {
      name: req.body.name,
      quantity: quantity,
      baseUnit: baseUnit.name,
      sellingPrice: req.body.sellingPrice !== undefined ? parseFloat(req.body.sellingPrice) : existingItem.sellingPrice,
      buyingPrice: req.body.buyingPrice !== undefined ? parseFloat(req.body.buyingPrice) : existingItem.buyingPrice,
      profitMarginPercentage: req.body.profitMarginPercentage || DEFAULT_PROFIT_MARGIN,
      units: units,
      gstRate: req.body.gstRate || 0,
      hsnCode: req.body.hsnCode || "",
      category: req.body.category || "Other",
      maxDiscountPercentage: req.body.maxDiscountPercentage !== undefined
        ? parseFloat(req.body.maxDiscountPercentage)
        : existingItem.maxDiscountPercentage, // <-- FIXED
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
      api: req.originalUrl,
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
      api: req.originalUrl,
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
    const [restockNeededCount, lowStockWarningCount] = await Promise.all([
      Item.countDocuments({
        quantity: { $lte: 0 },
        status: "approved",
      }),
      Item.countDocuments({
        quantity: { $gt: 0 },
        $expr: { $lte: ["$quantity", "$lowStockThreshold"] },
        status: "approved",
      }),
    ]);

    res.json({
      restockNeededCount,
      lowStockWarningCount,
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