const mongoose = require("mongoose");
const { Item, Purchase } = require("../models/itemlist");
const UniversalBackup = require("../models/universalBackup");
const logger = require("../utils/logger");
const multer = require("multer");
const exceljs = require("exceljs");
const asyncHandler = require("express-async-handler");
const Ticket = require("../models/opentickets");

// Constants
const MAX_CUSTOM_UNITS_TO_EXPORT = 3;
const DEFAULT_LOW_STOCK_THRESHOLD = 5;
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
const handleErrorResponse = (res, error, context, user) => {
  const errorMessage = `Error in ${context}: ${error.message}`;
  logger.error(context, errorMessage, error, user);
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
};

// Controller methods
exports.getAllItems = asyncHandler(async (req, res) => {
  const user = req.user || null;
  const {
    page = 1,
    limit = 10,
    sortKey = "name",
    sortDirection = "asc",
    searchTerm,
    category,
    quantityThreshold,
    status,
    filter,
    lowThreshold,
  } = req.query;

  try {
    const query = { status: "approved" };

    if (searchTerm) {
      query.$or = [
        { name: { $regex: searchTerm, $options: "i" } },
        { hsnCode: { $regex: searchTerm, $options: "i" } },
      ];
    }
    if (category && category !== "All" && category !== "undefined") query.category = category;

    if (quantityThreshold !== undefined && quantityThreshold !== null && quantityThreshold !== "All" && quantityThreshold !== "null") {
      query.quantity = { $lte: parseInt(quantityThreshold, 10) };
    } else if (quantityThreshold === "0") {
      query.quantity = { $lte: 0 };
    }

    if (status && status !== "undefined") query.status = status;

    if (filter === "stock_alerts" && lowThreshold !== undefined && lowThreshold !== "undefined") {
      const thresholdValue = parseInt(lowThreshold, 10);
      if (Number.isFinite(thresholdValue)) {
        query.quantity = { $lt: thresholdValue };
      } else {
        logger.warn("item", `Invalid lowThreshold value received for stock_alerts: ${lowThreshold}`, user);
      }
    }

    const [totalItems, items] = await Promise.all([
      Item.countDocuments(query),
      Item.find(query)
        .populate("createdBy reviewedBy", "firstname lastname email")
        .sort({ [sortKey]: sortDirection === "desc" ? -1 : 1 })
        .skip((page - 1) * limit)
        .limit(limit)
    ]);

    logger.debug("item", "Items fetched successfully", user, {
      count: items.length,
      totalItems,
      currentPage: page,
      totalPages: Math.ceil(totalItems / limit),
    });

    res.json({
      data: items,
      totalItems,
      currentPage: page,
      totalPages: Math.ceil(totalItems / limit),
    });
  } catch (error) {
    handleErrorResponse(res, error, "fetching items", user);
  }
});

exports.exportItemsToExcel = asyncHandler(async (req, res) => {
  const user = req.user || null;
  logger.info("excel_export", "Starting Excel export process", { userId: user?._id });

  try {
    const items = await Item.find({ status: "approved" })
      .sort({ category: 1, name: 1 })
      .lean();

    if (!items || items.length === 0) {
      logger.info("excel_export", "No items found to export", { userId: user?._id });
      return res.status(404).json({ message: "No approved items found to export." });
    }

    const workbook = new exceljs.Workbook();
    const worksheet = workbook.addWorksheet("Items");

    // Configure worksheet columns
    worksheet.columns = [
      { header: "Category", key: "category", width: 25 },
      { header: "Name", key: "name", width: 40 },
      { header: "Quantity", key: "quantity", width: 15 },
      { header: "HSN Code", key: "hsnCode", width: 15 },
      { header: "GST Rate", key: "gstRate", width: 12 },
      { header: "Max Discount %", key: "maxDiscountPercentage", width: 18 },
      { header: "Low Stock Threshold", key: "lowStockThreshold", width: 20 },
      { header: "Base Unit", key: "baseUnit", width: 15 },
      { header: "Selling Price (per Base Unit)", key: "sellingPriceBaseUnit", width: 25 },
      { header: "Buying Price (per Base Unit)", key: "buyingPriceBaseUnit", width: 25 },
      ...Array.from({ length: MAX_CUSTOM_UNITS_TO_EXPORT }).flatMap((_, i) => [
        { header: `Custom Unit ${i + 1} Name`, key: `customUnit${i + 1}Name`, width: 20 },
        { header: `Custom Unit ${i + 1} Conversion Factor`, key: `customUnit${i + 1}ConversionFactor`, width: 25 },
      ]),
      { header: "Image", key: "image", width: 15 },
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
    let imageMergeStartRow = -1;
    let lastImageBase64 = null;

    for (const item of items) {
      if (item.category !== currentCategory) {
        // Finalize previous category's image merge
        if (imageMergeStartRow !== -1 && currentRow > imageMergeStartRow) {
          const imageColIndex = worksheet.columns.findIndex(col => col.key === "image");
          const imageColLetter = String.fromCharCode("A".charCodeAt(0) + imageColIndex);
          worksheet.mergeCells(`${imageColLetter}${imageMergeStartRow}:${imageColLetter}${currentRow - 1}`);
        }

        // Reset for new category
        imageMergeStartRow = -1;
        lastImageBase64 = null;
        currentCategory = item.category;

        // Add category header row
        const lastColumnLetter = String.fromCharCode("A".charCodeAt(0) + worksheet.columns.length - 1);
        worksheet.mergeCells(`A${currentRow}:${lastColumnLetter}${currentRow}`);
        
        const categoryCell = worksheet.getCell(`A${currentRow}`);
        categoryCell.value = `Category: ${currentCategory || "Other"}`;
        categoryCell.font = { bold: true, size: 12, color: { argb: "FF000000" } };
        categoryCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E1F2" } };
        categoryCell.alignment = { vertical: "middle", horizontal: "left" };
        currentRow++;
      }

      // Prepare row data
      const nonBaseUnits = item.units?.filter(u => !u.isBaseUnit) || [];
      const rowData = {
        category: "",
        name: item.name,
        quantity: item.quantity,
        baseUnit: item.baseUnit || "N/A",
        sellingPriceBaseUnit: item.sellingPrice || 0,
        buyingPriceBaseUnit: item.buyingPrice || 0,
        hsnCode: item.hsnCode,
        gstRate: item.gstRate,
        maxDiscountPercentage: item.maxDiscountPercentage,
        lowStockThreshold: item.lowStockThreshold,
        image: "",
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

      // Handle image placement
      if (item.image) {
        const imageColIndex = worksheet.columns.findIndex(col => col.key === "image");
        const imageColLetter = String.fromCharCode("A".charCodeAt(0) + imageColIndex);

        if (item.image !== lastImageBase64) {
          // Finalize previous image merge
          if (imageMergeStartRow !== -1 && currentRow - 1 >= imageMergeStartRow) {
            worksheet.mergeCells(`${imageColLetter}${imageMergeStartRow}:${imageColLetter}${currentRow - 1}`);
          }

          // Start new image sequence
          imageMergeStartRow = currentRow;
          lastImageBase64 = item.image;
          
          const imageId = workbook.addImage({
            base64: item.image,
            extension: item.image.split(";")[0].split("/")[1],
          });
          
          worksheet.addImage(imageId, {
            tl: { col: imageColIndex, row: currentRow - 1 },
            ext: { width: 60, height: 60 },
          });
        }
        worksheet.getRow(currentRow).height = 65;
      }

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

      // Center align numeric columns
      ["quantity", "gstRate", "maxDiscountPercentage", "lowStockThreshold"].forEach(key => {
        addedRow.getCell(key).alignment = { vertical: "middle", horizontal: "center" };
      });

      ["sellingPriceBaseUnit", "buyingPriceBaseUnit"].forEach(key => {
        addedRow.getCell(key).alignment = { vertical: "middle", horizontal: "right" };
      });

      for (let j = 0; j < MAX_CUSTOM_UNITS_TO_EXPORT; j++) {
        addedRow.getCell(`customUnit${j + 1}ConversionFactor`).alignment = {
          vertical: "middle",
          horizontal: "center",
        };
      }

      currentRow++;
    }

    // Finalize any pending image merge
    if (imageMergeStartRow !== -1 && currentRow > imageMergeStartRow) {
      const imageColIndex = worksheet.columns.findIndex(col => col.key === "image");
      const imageColLetter = String.fromCharCode("A".charCodeAt(0) + imageColIndex);
      worksheet.mergeCells(`${imageColLetter}${imageMergeStartRow}:${imageColLetter}${currentRow - 1}`);
    }

    const excelBuffer = await workbook.xlsx.writeBuffer();

    res.setHeader("Content-Disposition", 'attachment; filename="items_export.xlsx"');
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    
    logger.info("excel_export", "Excel file generated and sent for download", {
      userId: user?._id,
      itemCount: items.length
    });
    
    res.send(excelBuffer);
  } catch (error) {
    handleErrorResponse(res, error, "Excel export process", user);
  }
});

// Import functions
async function parseExcelBufferForUpdate(fileBuffer) {
  try {
    const workbook = new exceljs.Workbook();
    await workbook.xlsx.load(fileBuffer);
    const worksheet = workbook.getWorksheet(1);

    if (!worksheet) {
      throw new Error("No worksheet found in the Excel file.");
    }

    const itemsToUpsert = [];
    const parsingErrors = [];
    let currentCategory = "Other";

    // Collect all images first
    const imageMap = new Map();
    worksheet.getImages().forEach((image) => {
      const row = image.range.tl.row + 1;
      const excelImage = workbook.getImage(image.imageId);
      if (excelImage) {
        const base64Image = `data:image/${excelImage.extension || "png"};base64,${excelImage.buffer.toString("base64")}`;
        imageMap.set(row, base64Image);
      }
    });

    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header

      const firstCell = row.getCell("A");
      if (firstCell.isMerged && firstCell.value?.startsWith?.("Category:")) {
        currentCategory = firstCell.value.replace("Category: ", "").trim();
        return;
      }

      const name = row.getCell("B").value;
      if (!name) {
        if (row.values.length > 1) {
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
        lowStockThreshold: parseInt(row.getCell("G").value, 10) || DEFAULT_LOW_STOCK_THRESHOLD,
        baseUnit: String(row.getCell("H").value || "Nos").trim(),
        sellingPriceBaseUnit: parseFloat(row.getCell("I").value) || 0,
        buyingPriceBaseUnit: parseFloat(row.getCell("J").value) || 0,
        category: currentCategory,
        image: imageMap.get(rowNumber) || "",
      };

      // Add custom units
      for (let i = 1; i <= MAX_CUSTOM_UNITS_TO_EXPORT; i++) {
        const unitNameKey = `customUnit${i}Name`;
        const conversionFactorKey = `customUnit${i}ConversionFactor`;
        if (row.getCell(10 + i * 2).value && row.getCell(11 + i * 2).value) {
          item[unitNameKey] = String(row.getCell(10 + i * 2).value).trim();
          item[conversionFactorKey] = parseFloat(row.getCell(11 + i * 2).value);
        }
      }

      if (isNaN(item.sellingPriceBaseUnit)) {
        parsingErrors.push({
          row: rowNumber,
          message: `Skipped: Invalid Selling Price for item "${item.name}" in row ${rowNumber}.`,
        });
        return;
      }

      itemsToUpsert.push(item);
    });

    return { itemsToUpsert, parsingErrors };
  } catch (error) {
    logger.error("excel_importer", `Error parsing Excel buffer: ${error.message}`, error);
    return {
      itemsToUpsert: [],
      parsingErrors: [{ row: "general", message: `Fatal error during Excel parsing: ${error.message}` }],
    };
  }
}

async function syncItemsWithDatabase(req, excelItems, user, logContextPrefix) {
  const session = await mongoose.startSession();
  const importUserId = user?._id || null;
  const importFileName = req?.file?.originalname || "unknown_excel_file.xlsx";

  let itemsCreated = 0;
  let itemsUpdated = 0;
  let itemsDeleted = 0;
  const operationResults = [];
  const databaseProcessingErrors = [];

  try {
    await session.withTransaction(async () => {
      logger.info(logContextPrefix, "Starting database sync with Excel data within transaction.", {
        userId: importUserId,
        itemCountExcel: excelItems.length,
        sessionId: session.id
      });

      // Fetch existing items and create a map
      const existingDbItems = await Item.find().session(session).lean();
      const dbItemsMap = new Map(existingDbItems.map(item => [item.name.toLowerCase(), item]));
      const excelItemNamesLowerCase = new Set(excelItems.map(item => item.name.toLowerCase()));

      // Process items for upsert
      const itemUpsertOps = [];
      for (const excelItemData of excelItems) {
        const normalizedExcelItemName = excelItemData.name.toLowerCase();
        const existingItem = dbItemsMap.get(normalizedExcelItemName);

        // Prepare units array
        const unitsPayload = [
          {
            name: excelItemData.baseUnit || "Nos",
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

        // Create payload for item
        const payload = {
          name: excelItemData.name,
          quantity: excelItemData.quantity !== undefined ? parseFloat(excelItemData.quantity) || 0 : existingItem?.quantity || 0,
          baseUnit: excelItemData.baseUnit || "Nos",
          sellingPrice: parseFloat(excelItemData.sellingPriceBaseUnit) || 0,
          buyingPrice: parseFloat(excelItemData.buyingPriceBaseUnit) || 0,
          profitMarginPercentage: excelItemData.profitMarginPercentage || DEFAULT_PROFIT_MARGIN,
          units: unitsPayload,
          category: excelItemData.category || "Other",
          gstRate: excelItemData.gstRate || 0,
          hsnCode: excelItemData.hsnCode || "",
          maxDiscountPercentage: excelItemData.maxDiscountPercentage || 0,
          lowStockThreshold: excelItemData.lowStockThreshold || DEFAULT_LOW_STOCK_THRESHOLD,
          image: excelItemData.image !== undefined ? excelItemData.image : existingItem?.image || "",
          status: excelItemData.status || (existingItem ? existingItem.status : importUserId && user?.role === "user" ? "pending_review" : "approved"),
          createdBy: existingItem ? existingItem.createdBy : importUserId,
          needsRestock: (excelItemData.quantity || existingItem?.quantity || 0) < (excelItemData.lowStockThreshold || existingItem?.lowStockThreshold || DEFAULT_LOW_STOCK_THRESHOLD),
        };

        if (payload.status === "approved" && (!existingItem || existingItem.status !== "approved")) {
          payload.reviewedBy = importUserId;
          payload.reviewedAt = new Date();
        }

        if (existingItem) {
          // Check for changes and prepare update operation
          const changes = [];
          let itemActuallyModified = false;

          // Compare simple fields
          Object.keys(payload).forEach(key => {
            if (key === "units" || key === "needsRestock") return;
            if (String(existingItem[key]) !== String(payload[key])) {
              changes.push({ field: key, oldValue: existingItem[key], newValue: payload[key] });
              itemActuallyModified = true;
            }
          });

          // Compare units array
          const existingUnitsSorted = [...(existingItem.units || [])].sort((a, b) => a.name.localeCompare(b.name));
          const newUnitsSorted = [...unitsPayload].sort((a, b) => a.name.localeCompare(b.name));
          
          if (JSON.stringify(existingUnitsSorted) !== JSON.stringify(newUnitsSorted)) {
            changes.push({ field: "units", oldValue: existingItem.units, newValue: unitsPayload });
            itemActuallyModified = true;
          }

          if (itemActuallyModified) {
            const currentHistory = existingItem.excelImportHistory || [];
            currentHistory.push({
              action: "updated",
              importedBy: importUserId,
              importedAt: new Date(),
              fileName: importFileName,
              changes: changes,
            });

            itemUpsertOps.push({
              updateOne: {
                filter: { _id: existingItem._id },
                update: { $set: { ...payload, excelImportHistory: currentHistory } },
              },
            });
          }
        } else {
          // New item
          payload.excelImportHistory = [{
            action: "created",
            importedBy: importUserId,
            importedAt: new Date(),
            fileName: importFileName,
            snapshot: { ...payload },
          }];

          itemUpsertOps.push({
            insertOne: { document: payload },
          });
        }
      }

      // Process items for deletion (those in DB but not in Excel)
      const itemsToBeDeletedFromDb = existingDbItems.filter(
        dbItem => !excelItemNamesLowerCase.has(dbItem.name.toLowerCase())
      );

      const backupInsertOps = itemsToBeDeletedFromDb.map(itemToDelete => ({
        insertOne: {
          document: {
            originalId: itemToDelete._id,
            originalModel: "Item",
            data: itemToDelete,
            deletedBy: importUserId,
            deletedAt: new Date(),
            originalCreatedAt: itemToDelete.createdAt,
            originalUpdatedAt: itemToDelete.updatedAt,
          },
        },
      }));

      const itemDeleteOps = itemsToBeDeletedFromDb.map(itemToDelete => ({
        deleteOne: { filter: { _id: itemToDelete._id } },
      }));

      // Execute operations in bulk
      if (backupInsertOps.length > 0) {
        const backupResult = await UniversalBackup.bulkWrite(backupInsertOps, { session });
        if (backupResult.hasWriteErrors()) {
          backupResult.getWriteErrors().forEach(err => {
            const failedItemId = backupInsertOps[err.index]?.insertOne?.document?.originalId;
            logger.error(logContextPrefix, `UniversalBackup failed for item ID: ${failedItemId}`, {
              error: err.errmsg,
              userId: importUserId
            });
            databaseProcessingErrors.push({
              name: `Backup for item ${failedItemId}`,
              status: "backup_error",
              message: err.errmsg,
            });
          });
        }
      }

      if (itemUpsertOps.length > 0) {
        const upsertResult = await Item.bulkWrite(itemUpsertOps, { session });
        itemsCreated = upsertResult.insertedCount || 0;
        itemsUpdated = upsertResult.modifiedCount || 0;

        if (upsertResult.hasWriteErrors()) {
          upsertResult.getWriteErrors().forEach(err => {
            const opDescription = itemUpsertOps[err.index]?.insertOne
              ? `Create item "${itemUpsertOps[err.index].insertOne.document.name}"`
              : `Update item (filter: ${JSON.stringify(itemUpsertOps[err.index]?.updateOne?.filter)})`;
            
            logger.error(logContextPrefix, `DB Bulk Write Error during upsert: ${opDescription}`, {
              error: err.errmsg,
              userId: importUserId
            });
            
            databaseProcessingErrors.push({
              name: opDescription,
              status: "error",
              message: err.errmsg,
              details: err.op,
            });
          });
        }
      }

      if (itemDeleteOps.length > 0) {
        const deleteResult = await Item.bulkWrite(itemDeleteOps, { session });
        itemsDeleted = deleteResult.deletedCount || 0;

        if (deleteResult.hasWriteErrors()) {
          deleteResult.getWriteErrors().forEach(err => {
            logger.error(logContextPrefix, `DB Bulk Write Error during delete`, {
              error: err.errmsg,
              userId: importUserId
            });
            databaseProcessingErrors.push({
              name: "Delete operation",
              status: "error",
              message: err.errmsg,
              details: err.op,
            });
          });
        }
      }

      // Update purchases to remove references to deleted items
      if (itemsDeleted > 0) {
        await Purchase.updateMany(
          { "items.itemId": { $in: itemsToBeDeletedFromDb.map(i => i._id) } },
          { $set: { "items.$[elem].itemId": null } },
          { arrayFilters: [{ "elem.itemId": { $in: itemsToBeDeletedFromDb.map(i => i._id) } }], session }
        );
      }

      logger.info(logContextPrefix, "Database sync with Excel data completed", {
        userId: importUserId,
        itemsCreated,
        itemsUpdated,
        itemsDeleted,
        errors: databaseProcessingErrors.length
      });
    });

    return {
      itemsCreated,
      itemsUpdated,
      itemsDeleted,
      operationResults,
      databaseProcessingErrors,
    };
  } catch (error) {
    logger.error(logContextPrefix, `Error during syncItemsWithDatabase: ${error.message}`, {
      error,
      userId: importUserId
    });
    throw error;
  } finally {
    session.endSession();
  }
}

exports.importItemsFromUploadedExcel = asyncHandler(async (req, res) => {
  const user = req.user || null;
  logger.info("excel_upload_import", "Starting Excel import from uploaded file", { userId: user?._id });

  if (!req.file) {
    logger.warn("excel_upload_import", "No file uploaded.", { userId: user?._id });
    return res.status(400).json({ message: "No Excel file uploaded." });
  }

  try {
    const { itemsToUpsert, parsingErrors } = await parseExcelBufferForUpdate(req.file.buffer);

    if (!itemsToUpsert || itemsToUpsert.length === 0) {
      logger.info("excel_upload_import", "No items found in uploaded Excel to process", { userId: user?._id });
      return res.status(200).json({
        message: "No valid items found in the uploaded Excel to process or file is empty.",
        itemsCreated: 0,
        itemsUpdated: 0,
        itemsDeleted: 0,
        parsingErrors,
      });
    }

    const result = await syncItemsWithDatabase(req, itemsToUpsert, user, "excel_upload_import");

    res.status(200).json({
      message: "Uploaded Excel data processed.",
      itemsCreated: result.itemsCreated,
      itemsUpdated: result.itemsUpdated,
      itemsDeleted: result.itemsDeleted,
      parsingErrors,
      databaseProcessingDetails: result.operationResults,
      databaseProcessingErrors: result.databaseProcessingErrors,
    });
  } catch (error) {
    handleErrorResponse(res, error, "Excel import from upload", user);
  }
});

exports.importItemsFromExcelViaAPI = asyncHandler(async (req, res) => {
  const user = req.user || null;
  logger.info("excel_import_api", "Starting Excel import process from server file", { userId: user?._id });

  try {
    const excelFilePath = require("path").resolve(__dirname, "..", "itemlist.xlsx");
    const fileBuffer = require("fs").readFileSync(excelFilePath);

    const { itemsToUpsert, parsingErrors } = await parseExcelBufferForUpdate(fileBuffer);

    if (!itemsToUpsert || itemsToUpsert.length === 0) {
      logger.info("excel_import_api", "No items found in Excel to process", { userId: user?._id });
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
    logger.warn("item", "API: createCategory - Invalid or missing categoryName", user);
    return res.status(400).json({ message: "Category name is required." });
  }

  const trimmedCategoryName = categoryName.trim();

  try {
    const existingCategory = await Item.findOne({ category: trimmedCategoryName });
    if (existingCategory) {
      logger.info("item", `API: createCategory - Category "${trimmedCategoryName}" already exists.`, user);
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
    const item = await Item.findById(id)
      .populate("createdBy reviewedBy", "firstname lastname email")
      .populate({
        path: "inventoryLog.userReference",
        select: "firstname lastname email",
      })
      .populate({
        path: "inventoryLog.ticketReference",
        select: "ticketNumber",
      })
      .populate({
        path: "excelImportHistory.importedBy",
        select: "firstname lastname email",
      });

    if (!item) {
      logger.warn("item", `Item not found when fetching details: ${id}`, user);
      return res.status(404).json({ message: "Item not found" });
    }

    res.json(item);
  } catch (error) {
    handleErrorResponse(res, error, `fetching item details for ID: ${id}`, user);
  }
});

exports.createItem = asyncHandler(async (req, res) => {
  const user = req.user;
  if (!user) {
    logger.warn("item", "Create item attempt without authenticated user.", null);
    return res.status(401).json({ message: "Authentication required." });
  }

  try {
    validateItemData(req.body);

    const quantity = parseFloat(req.body.quantity) || 0;
    const lowStockThreshold = req.body.lowStockThreshold ? parseInt(req.body.lowStockThreshold, 10) : DEFAULT_LOW_STOCK_THRESHOLD;
    const sellingPrice = parseFloat(req.body.sellingPrice) || 0;
    const buyingPrice = parseFloat(req.body.buyingPrice) || 0;
    const profitMarginPercentage = parseFloat(req.body.profitMarginPercentage) || DEFAULT_PROFIT_MARGIN;

    const newItemData = {
      name: req.body.name,
      quantity: quantity,
      baseUnit: req.body.baseUnit || "Nos",
      sellingPrice: sellingPrice,
      buyingPrice: buyingPrice,
      profitMarginPercentage: profitMarginPercentage,
      units: req.body.units,
      gstRate: req.body.gstRate || 0,
      hsnCode: req.body.hsnCode || "",
      category: req.body.category || "Other",
      maxDiscountPercentage: req.body.maxDiscountPercentage ? parseFloat(req.body.maxDiscountPercentage) : 0,
      lowStockThreshold: lowStockThreshold,
      createdBy: user._id,
      image: req.body.image || "",
      needsRestock: quantity < lowStockThreshold,
      status: user.role === "user" ? "pending_review" : "approved",
    };

    if (newItemData.status === "approved") {
      newItemData.reviewedBy = user._id;
      newItemData.reviewedAt = new Date();
    }

    const newItem = new Item(newItemData);
    const savedItem = await newItem.save();

    logger.info("item", `Item created successfully by ${user.email}`, user, {
      itemId: savedItem._id,
      itemName: savedItem.name,
      status: savedItem.status,
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

    handleErrorResponse(res, error, "creating item", req.user);
  }
});

exports.updateItem = asyncHandler(async (req, res) => {
  const user = req.user;
  if (!user) {
    logger.warn("item", "Update item attempt without authenticated user.", null);
    return res.status(401).json({ message: "Authentication required." });
  }

  const itemId = req.params.id;
  if (!mongoose.Types.ObjectId.isValid(itemId)) {
    return res.status(400).json({ message: "Invalid item ID format" });
  }

  try {
    const existingItem = await Item.findById(itemId);
    if (!existingItem) {
      logger.warn("item", `Item not found for update: ${itemId}`, user);
      return res.status(404).json({ message: "Item not found" });
    }

    validateItemData(req.body);

    const quantity = req.body.quantity !== undefined ? parseFloat(req.body.quantity) || 0 : existingItem.quantity;
    const lowStockThreshold = req.body.lowStockThreshold !== undefined && req.body.lowStockThreshold !== null
      ? parseInt(String(req.body.lowStockThreshold), 10)
      : existingItem.lowStockThreshold || DEFAULT_LOW_STOCK_THRESHOLD;
    
    const sellingPrice = req.body.sellingPrice !== undefined ? parseFloat(req.body.sellingPrice) : existingItem.sellingPrice;
    const buyingPrice = req.body.buyingPrice !== undefined ? parseFloat(req.body.buyingPrice) : existingItem.buyingPrice;

    const updatePayload = {
      name: req.body.name,
      quantity: quantity,
      baseUnit: req.body.baseUnit || existingItem.baseUnit,
      sellingPrice: sellingPrice,
      buyingPrice: buyingPrice,
      profitMarginPercentage: req.body.profitMarginPercentage || DEFAULT_PROFIT_MARGIN,
      units: req.body.units || existingItem.units,
      gstRate: req.body.gstRate || 0,
      hsnCode: req.body.hsnCode || "",
      category: req.body.category || "Other",
      maxDiscountPercentage: req.body.maxDiscountPercentage ? parseFloat(req.body.maxDiscountPercentage) : 0,
      lowStockThreshold: lowStockThreshold,
      needsRestock: quantity < lowStockThreshold,
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
    logger.warn("item", `Unauthorized attempt to approve item ${req.params.id}`, user);
    return res.status(403).json({ message: "Forbidden: Only admins can approve items." });
  }

  const itemId = req.params.id;
  if (!mongoose.Types.ObjectId.isValid(itemId)) {
    return res.status(400).json({ message: "Invalid item ID format" });
  }

  try {
    const itemToApprove = await Item.findById(itemId);
    if (!itemToApprove) {
      logger.warn("item", `Item not found for approval: ${itemId}`, user);
      return res.status(404).json({ message: "Item not found." });
    }

    if (itemToApprove.status === "approved") {
      logger.info("item", `Item ${itemId} is already approved.`, user);
      return res.status(200).json(itemToApprove);
    }

    itemToApprove.status = "approved";
    itemToApprove.reviewedBy = user._id;
    itemToApprove.reviewedAt = new Date();

    const approvedItem = await itemToApprove.save();
    logger.info("item", `Item ${itemId} approved successfully by ${user.email}.`, user);

    res.json(approvedItem);
  } catch (error) {
    handleErrorResponse(res, error, `approving item ID: ${itemId}`, user);
  }
});

exports.deleteItem = asyncHandler(async (req, res) => {
  const itemId = req.params.id;
  const user = req.user || null;
  const session = await mongoose.startSession();

  if (!mongoose.Types.ObjectId.isValid(itemId)) {
    return res.status(400).json({ message: "Invalid item ID format" });
  }

  try {
    await session.withTransaction(async () => {
      logger.info("delete", `[DELETE_INITIATED] Item ID: ${itemId}.`, user);

      const itemToBackup = await Item.findById(itemId).session(session);
      if (!itemToBackup) {
        logger.warn("delete", `[NOT_FOUND] Item not found for deletion: ${itemId}`, user);
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

      logger.info("delete", `[DELETE_SUCCESS] Item ${itemId} deleted successfully.`, user);
      res.status(200).json({
        message: "Item deleted and backed up successfully.",
        originalId: itemToBackup._id,
      });
    });
  } catch (error) {
    logger.error("delete", `[DELETE_ERROR] Error deleting item ${itemId}`, error, user);
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
    logger.warn("item_ticket_usage", `Invalid item ID format: ${id}`, user);
    return res.status(400).json({ message: "Invalid item ID format" });
  }

  try {
    const itemExists = await Item.exists({ _id: id });
    if (!itemExists) {
      logger.warn("item_ticket_usage", `Item not found: ${id}`, user);
      return res.status(404).json({ message: "Item not found" });
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
    logger.warn("item-log-clear", `Unauthorized attempt to clear logs for item ${itemId}`, user);
    return res.status(403).json({ message: "Forbidden: You do not have permission to perform this action." });
  }

  try {
    const item = await Item.findById(itemId);
    if (!item) {
      logger.warn("item-log-clear", `Item not found: ${itemId}`, user);
      return res.status(404).json({ message: "Item not found." });
    }

    item.inventoryLog = [];
    item.excelImportHistory = [];
    await item.save();

    logger.info("item-log-clear", `Logs cleared for item ${itemId}`, user);
    res.status(200).json({ message: "All item logs have been cleared successfully." });
  } catch (error) {
    handleErrorResponse(res, error, `clearing logs for item ${itemId}`, user);
  }
});

exports.getItemTicketUsageHistory = asyncHandler(async (req, res) => {
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

    const ticketsContainingItem = await Ticket.find({
      "goods.description": item.name,
      ...(item.hsnCode && { "goods.hsnSacCode": item.hsnCode }),
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
          (item.hsnCode ? g.hsnSacCode === item.hsnCode : true)
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