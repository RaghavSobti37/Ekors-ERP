const { Item, Purchase } = require('../models/itemlist');
const UniversalBackup = require('../models/universalBackup'); // Changed from ItemBackup
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const { parseExcelBufferForUpdate } = require('../utils/excelImporter');
const path = require('path');
const multer = require('multer');
const xlsx = require('xlsx');
const Ticket = require('../models/opentickets');

// Get all items - Updated for server-side pagination, sorting, and filtering
exports.getAllItems = async (req, res) => {
  const user = req.user || null;
  const {
    page = 1,
    limit = 10, // Default limit for items page
    sortKey = 'name',
    sortDirection = 'asc',
    searchTerm,
    category,
    subcategory,
    quantityThreshold,
    status, // e.g., 'approved', 'pending_review'
    filter, // Special filter like 'stock_alerts'
    lowThreshold // Used with 'stock_alerts'
  } = req.query;

  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const skip = (pageNum - 1) * limitNum;

  try {
    let query = {};

    if (searchTerm) {
      query.$or = [
        { name: { $regex: searchTerm, $options: 'i' } },
        { hsnCode: { $regex: searchTerm, $options: 'i' } },
      ];
    }
   if (category && category !== 'All' && category !== 'undefined') query.category = category;
    if (subcategory && subcategory !== 'All' && subcategory !== 'undefined') query.subcategory = subcategory;
    
    if (quantityThreshold !== undefined && quantityThreshold !== null && quantityThreshold !== 'All' && quantityThreshold !== 'null') {
      query.quantity = { $lte: parseInt(quantityThreshold, 10) };
    }
    
    if (status && status !== 'undefined') query.status = status;

    if (filter === 'stock_alerts' && lowThreshold !== undefined && lowThreshold !== 'undefined') {
      // This overrides other quantity filters if stock_alerts is active
      query.quantity = { $lt: parseInt(lowThreshold, 10) };
    }


    const totalItems = await Item.countDocuments(query);
    const items = await Item.find(query)
      .populate('createdBy', 'firstname lastname email')
      .populate('reviewedBy', 'firstname lastname email')
      .sort({ [sortKey]: sortDirection === 'desc' ? -1 : 1 })
      .skip(skip)
      .limit(limitNum);

    logger.debug('item', "Items fetched successfully", user, {
      count: items.length,
      totalItems,
      currentPage: pageNum,
      totalPages: Math.ceil(totalItems / limitNum)
    });
    res.json({
      data: items,
      totalItems,
      currentPage: pageNum,
      totalPages: Math.ceil(totalItems / limitNum),
    });
  } catch (error) {
    logger.error('item', "Error fetching items", error, user);
    res.status(500).json({
      message: 'Server error while fetching items',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || file.mimetype === 'application/vnd.ms-excel') {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only .xlsx and .xls files are allowed.'), false);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});
exports.uploadMiddleware = upload.single('excelFile');

exports.exportItemsToExcel = async (req, res) => {
  const user = req.user || null;
  logger.info('excel_export', 'API: Starting Excel export process', { userId: user?._id });
  try {
    // Fetch all items, not just paginated, for export
    const items = await Item.find().lean();

    if (!items || items.length === 0) {
      logger.info('excel_export', 'No items found to export', { userId: user?._id });
      return res.status(404).json({ message: 'No items found to export.' });
    }

    const dataForSheet = items.map(item => ({
      'Name': item.name,
      'Quantity': item.quantity,
      'Selling Price': item.sellingPrice,
      'Buying Price': item.buyingPrice,
      'Unit': item.unit,
      'Category': item.category,
      'Subcategory': item.subcategory,
      'HSN Code': item.hsnCode,
      'GST Rate': item.gstRate,
      'Max Discount Percentage': item.maxDiscountPercentage,
      'Low Stock Threshold': item.lowStockThreshold,
      'Status': item.status, // Added status
    }));

    const worksheet = xlsx.utils.json_to_sheet(dataForSheet);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Items');

    const excelBuffer = xlsx.write(workbook, { bookType: 'xlsx', type: 'buffer' });

    res.setHeader('Content-Disposition', 'attachment; filename="items_export.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    logger.info('excel_export', 'API: Excel file generated and sent for download', { userId: user?._id, itemCount: items.length });
    res.send(excelBuffer);

  } catch (error) {
    logger.error('excel_export', 'API: Error during Excel export process', { error: error.message, stack: error.stack, userId: user?._id });
    res.status(500).json({ message: 'Server error during Excel export.', error: error.message });
  }
};

exports.importItemsFromUploadedExcel = async (req, res) => {
  const user = req.user || null;
  logger.info('excel_upload_import', 'API: Starting Excel import from uploaded file', { userId: user?._id });

  if (!req.file) {
    logger.warn('excel_upload_import', 'API: No file uploaded.', { userId: user?._id });
    return res.status(400).json({ message: 'No Excel file uploaded.' });
  }

  try {
    const fileBuffer = req.file.buffer;
    const { itemsToUpsert, parsingErrors } = await parseExcelBufferForUpdate(fileBuffer);

    if (parsingErrors && parsingErrors.length > 0) {
      logger.warn('excel_upload_import', 'API: Errors/Warnings during Excel parsing', { parsingErrorsCount: parsingErrors.length, parsingErrors, userId: user?._id });
    }

    if (!itemsToUpsert || itemsToUpsert.length === 0) {
      logger.info('excel_upload_import', 'API: No items found in uploaded Excel to process', { userId: user?._id });
      return res.status(200).json({
        message: 'No valid items found in the uploaded Excel to process or file is empty.',
        itemsCreated: 0,
        itemsUpdated: 0,
        itemsDeleted: 0,
        parsingErrors,
      });
    }

    const { itemsCreated, itemsUpdated, itemsDeleted, operationResults, databaseProcessingErrors } = await syncItemsWithDatabase(req, itemsToUpsert, user, 'excel_upload_import');

    logger.info('excel_upload_import', 'API: Excel import from upload process completed', { itemsCreated, itemsUpdated, itemsDeleted, errors: databaseProcessingErrors.length, userId: user?._id });
    res.status(200).json({
        message: 'Uploaded Excel data processed.',
        itemsCreated,
        itemsUpdated,
        itemsDeleted,
        parsingErrors,
        databaseProcessingDetails: operationResults,
        databaseProcessingErrors
    });

  } catch (error) {
    if (error instanceof multer.MulterError) {
        logger.error('excel_upload_import', 'API: Multer error during file upload', { error: error.message, stack: error.stack, userId: user?._id });
        return res.status(400).json({ message: `File upload error: ${error.message}` });
    }
    logger.error('excel_upload_import', 'API: Unhandled error during Excel import from upload', { error: error.message, stack: error.stack, userId: user?._id });
    res.status(500).json({ message: 'Server error during Excel processing.', error: error.message });
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
  const importFileName = req?.file?.originalname || 'unknown_excel_file.xlsx';

  const session = await mongoose.startSession(); // Start session for transaction

  try {
    session.startTransaction();
    logger.info(logContextPrefix, 'Starting database sync with Excel data within transaction.', {userId: importUserId}, { itemCountExcel: excelItems.length, sessionId: session.id });

    const existingDbItems = await Item.find().session(session).lean();
    const dbItemsMap = new Map(existingDbItems.map(item => [item.name.toLowerCase(), item]));
    const excelItemNamesLowerCase = new Set(excelItems.map(item => item.name.toLowerCase()));

    logger.debug(logContextPrefix, `Fetched ${existingDbItems.length} existing items from DB.`, {userId: importUserId});

    for (const excelItemData of excelItems) {
      const normalizedExcelItemName = excelItemData.name.toLowerCase();
      const existingItem = dbItemsMap.get(normalizedExcelItemName);

      const quantityForPayload = excelItemData.quantity !== undefined
        ? (parseFloat(excelItemData.quantity) || 0)
        : (existingItem ? existingItem.quantity : 0);

      const payload = {
        name: excelItemData.name,
        quantity: quantityForPayload,
        sellingPrice: excelItemData.sellingPrice || excelItemData.price || 0,
        buyingPrice: excelItemData.buyingPrice || 0,
        unit: excelItemData.unit || 'Nos',
        category: excelItemData.category || 'Other',
        subcategory: excelItemData.subcategory || 'General',
        gstRate: excelItemData.gstRate || 0,
        hsnCode: excelItemData.hsnCode || '',
        maxDiscountPercentage: excelItemData.maxDiscountPercentage || 0,
        lowStockThreshold: excelItemData.lowStockThreshold || 5,
        image: excelItemData.image !== undefined ? excelItemData.image : (existingItem?.image || ''),
        discountAvailable: excelItemData.discountAvailable !== undefined ? excelItemData.discountAvailable : (existingItem?.discountAvailable || false),
        lastPurchaseDate: excelItemData.lastPurchaseDate !== undefined ? excelItemData.lastPurchaseDate : (existingItem?.lastPurchaseDate || null),
        lastPurchasePrice: excelItemData.lastPurchasePrice !== undefined ? excelItemData.lastPurchasePrice : (existingItem?.lastPurchasePrice || null),
        status: excelItemData.status || (existingItem ? existingItem.status : (importUserId && user?.role === 'user' ? 'pending_review' : 'approved')), // Handle status from Excel or default
        createdBy: existingItem ? existingItem.createdBy : importUserId, // Preserve original creator or set new
      };
      
      if (payload.status === 'approved' && (!existingItem || existingItem.status !== 'approved')) {
        payload.reviewedBy = importUserId;
        payload.reviewedAt = new Date();
      }

      payload.needsRestock = payload.quantity < 0;


      if (existingItem) {
        const currentHistory = existingItem.excelImportHistory || [];
        const changes = [];
        let itemActuallyModified = false;

        Object.keys(payload).forEach(key => {
          if (payload.hasOwnProperty(key)) {
            if (String(existingItem[key]) !== String(payload[key])) {
              changes.push({
                field: key,
                oldValue: existingItem[key],
                newValue: payload[key],
              });
              itemActuallyModified = true;
            }
          }
        });

        if (itemActuallyModified) {
          currentHistory.push({
            action: 'updated',
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
            }
          });
          logger.debug(logContextPrefix, `Item "${excelItemData.name}" marked for UPDATE with history.`, {userId: importUserId}, { itemId: existingItem._id });
        } else {
           logger.debug(logContextPrefix, `Item "${excelItemData.name}" has no changes from Excel. Skipping update.`, {userId: importUserId}, { itemId: existingItem._id });
        }
      } else { // New item
        payload.excelImportHistory = [{
          action: 'created',
          importedBy: importUserId,
          importedAt: new Date(),
          fileName: importFileName,
          snapshot: { ...payload } // Snapshot of initial state
        }];
        // If created by a 'user' role via Excel, it should be pending_review unless Excel specifies 'approved'
        if (importUserId && user?.role === 'user' && payload.status !== 'approved') {
            payload.status = 'pending_review';
        } else if (payload.status === 'approved') { // If Excel says approved, or admin creates
            payload.reviewedBy = importUserId;
            payload.reviewedAt = new Date();
        }
        payload.createdBy = importUserId; // Set creator for new items

        itemUpsertOps.push({
          insertOne: {
            document: payload
          }
        });
        logger.debug(logContextPrefix, `Item "${excelItemData.name}" marked for CREATE with history.`, {userId: importUserId});
      }
    }

    const itemsToBeDeletedFromDb = [];
    for (const dbItem of existingDbItems) {
      if (!excelItemNamesLowerCase.has(dbItem.name.toLowerCase())) {
        itemsToBeDeletedFromDb.push(dbItem);
      }
    }

    if (itemsToBeDeletedFromDb.length > 0) {
      logger.info(logContextPrefix, `${itemsToBeDeletedFromDb.length} items identified for DELETION. Preparing backups.`, {userId: importUserId});
      for (const itemToDelete of itemsToBeDeletedFromDb) {
        const backupDocData = itemToDelete; // Already a plain object from .lean()
        
        backupInsertOps.push({
            insertOne: {
                document: {
                  originalId: itemToDelete._id,
                  originalModel: 'Item',
                  data: backupDocData,
                  deletedBy: importUserId,
                  deletedAt: new Date(),
                  backupReason: "Deleted during Excel synchronization",
                  originalCreatedAt: itemToDelete.createdAt,
                  originalUpdatedAt: itemToDelete.updatedAt
                }
            }
        });
        itemDeleteOps.push({
            deleteOne: {
                filter: { _id: itemToDelete._id }
            }
        });
        logger.debug(logContextPrefix, `Item "${itemToDelete.name}" (ID: ${itemToDelete._id}) marked for BACKUP (UniversalBackup) and DELETION.`, {userId: importUserId});
      }
    } else {
        logger.info(logContextPrefix, "No items from DB are marked for deletion (all DB items present in Excel or DB is empty).", {userId: importUserId});
    }

    if (backupInsertOps.length > 0) {
        logger.info(logContextPrefix, `Attempting to bulk insert ${backupInsertOps.length} item backups to UniversalBackup.`, {userId: importUserId});
        try {
            const backupResult = await UniversalBackup.bulkWrite(backupInsertOps, { session, ordered: false });
            logger.info(logContextPrefix, `UniversalBackup item backups bulk operation completed. Inserted: ${backupResult.insertedCount}.`, {userId: importUserId}, { backupResult: { inserted: backupResult.insertedCount, errors: backupResult.hasWriteErrors() ? backupResult.getWriteErrors().length : 0 } });

            if (backupResult.hasWriteErrors()) {
                const writeErrors = backupResult.getWriteErrors();
                logger.warn(logContextPrefix, `${writeErrors.length} errors occurred during UniversalBackup item backup. These items will not be deleted.`, {userId: importUserId});
                writeErrors.forEach(err => {
                    const failedBackupOp = backupInsertOps[err.index]?.insertOne?.document;
                    const originalItemId = failedBackupOp?.originalId;
                    logger.error(logContextPrefix, `UniversalBackup failed for item (original name: ${failedBackupOp?.data?.name}, original ID: ${originalItemId}). Original item will NOT be deleted.`, {userId: importUserId}, { error: err.errmsg, opDetails: failedBackupOp });
                    databaseProcessingErrors.push({ name: `Backup for ${failedBackupOp?.data?.name || originalItemId}`, status: 'backup_error', message: err.errmsg });

                    const deleteOpIndex = itemDeleteOps.findIndex(op => op.deleteOne.filter._id.toString() === originalItemId.toString());
                    if (deleteOpIndex > -1) {
                        itemDeleteOps.splice(deleteOpIndex, 1);
                        logger.warn(logContextPrefix, `Removed item "${failedBackupOp?.data?.name}" (ID: ${originalItemId}) from deletion queue due to backup failure.`, {userId: importUserId});
                    }
                });
            }
        } catch (backupBulkError) {
            logger.error(logContextPrefix, 'CRITICAL error during UniversalBackup.bulkWrite. ALL delete operations for this sync will be cancelled.', {userId: importUserId}, { error: backupBulkError.message, stack: backupBulkError.stack });
            databaseProcessingErrors.push({ name: 'Bulk Backup Operation', status: 'critical_error', message: `UniversalBackup bulkWrite failed: ${backupBulkError.message}. No items were deleted.` });
            itemDeleteOps.length = 0; // Cancel all deletions
            logger.warn(logContextPrefix, 'All item delete operations cancelled due to critical failure in bulk backup.', {userId: importUserId});
        }
    }

    if (itemUpsertOps.length > 0) {
      logger.info(logContextPrefix, `Attempting to bulk create/update ${itemUpsertOps.length} items.`, {userId: importUserId});
      const upsertResult = await Item.bulkWrite(itemUpsertOps, { session, ordered: false });
      itemsCreated = upsertResult.insertedCount || 0;
      itemsUpdated = upsertResult.modifiedCount || 0;

      logger.info(logContextPrefix, `Item create/update bulk operation completed. Created: ${itemsCreated}, Updated: ${itemsUpdated}.`, {userId: importUserId}, { upsertResult: { inserted: itemsCreated, modified: itemsUpdated, errors: upsertResult.hasWriteErrors() ? upsertResult.getWriteErrors().length : 0 } });
      operationResults.push({
        type: 'upsert',
        created: itemsCreated,
        updated: itemsUpdated,
        hasErrors: upsertResult.hasWriteErrors(),
        errors: upsertResult.hasWriteErrors() ? upsertResult.getWriteErrors() : []
      });
      if (upsertResult.hasWriteErrors()) {
        upsertResult.getWriteErrors().forEach(err => {
          const opDescription = itemUpsertOps[err.index]?.insertOne ? `Create item "${itemUpsertOps[err.index].insertOne.document.name}"` : `Update item (filter: ${JSON.stringify(itemUpsertOps[err.index]?.updateOne?.filter)})`;
          logger.error(logContextPrefix, `DB Bulk Write Error during upsert: ${opDescription}`, {userId: importUserId}, { error: err.errmsg, op: err.op });
          databaseProcessingErrors.push({ name: opDescription, status: 'error', message: err.errmsg, details: err.op });
        });
      }
    } else {
      logger.info(logContextPrefix, 'No items to create or update from Excel.', {userId: importUserId});
    }

    if (itemDeleteOps.length > 0) { // These are items whose backups were successful (or not needed if no deletions)
        logger.info(logContextPrefix, `Attempting to bulk delete ${itemDeleteOps.length} items (whose backups were processed).`, {userId: importUserId});
        const deleteResult = await Item.bulkWrite(itemDeleteOps, { session, ordered: false });
        itemsDeleted = deleteResult.deletedCount || 0;
        logger.info(logContextPrefix, `Item delete bulk operation completed. Deleted: ${itemsDeleted}.`, {userId: importUserId}, { deleteResult: { deleted: itemsDeleted, errors: deleteResult.hasWriteErrors() ? deleteResult.getWriteErrors().length : 0 } });
        operationResults.push({
            type: 'delete',
            deleted: itemsDeleted,
            hasErrors: deleteResult.hasWriteErrors(),
            errors: deleteResult.hasWriteErrors() ? deleteResult.getWriteErrors() : []
        });
        if (deleteResult.hasWriteErrors()) {
            deleteResult.getWriteErrors().forEach(err => {
                const opDescription = `Delete item (filter: ${JSON.stringify(itemDeleteOps[err.index]?.deleteOne?.filter)})`;
                logger.error(logContextPrefix, `DB Bulk Write Error during delete: ${opDescription}`, {userId: importUserId}, { error: err.errmsg, op: err.op });
                databaseProcessingErrors.push({ name: opDescription, status: 'error', message: err.errmsg, details: err.op });
            });
        }
    } else {
        logger.info(logContextPrefix, 'No items to delete, or all deletions were cancelled due to backup issues.', {userId: importUserId});
    }
    
    await session.commitTransaction();
    logger.info(logContextPrefix, 'Database sync with Excel data finished and transaction committed.', {userId: importUserId}, { itemsCreated, itemsUpdated, itemsDeleted });

  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
      logger.warn(logContextPrefix, `Transaction aborted due to error during syncItemsWithDatabase: ${error.message}`, {userId: importUserId}, { error, stack: error.stack });
    }
    logger.error(logContextPrefix, `CRITICAL error during syncItemsWithDatabase: ${error.message}`, {userId: importUserId}, { error, stack: error.stack });
    databaseProcessingErrors.push({ name: 'General Sync Error', status: 'critical_error', message: error.message });
  } finally {
    session.endSession();
  }

  return { itemsCreated, itemsUpdated, itemsDeleted, operationResults, databaseProcessingErrors };
}

exports.importItemsFromExcelViaAPI = async (req, res) => {
  const user = req.user || null;
  logger.info('excel_import_api', 'API: Starting Excel import process from server file', { userId: user?._id });

  try {
    const excelFilePath = path.resolve(__dirname, '..', 'itemlist.xlsx'); // Assuming file is in parent directory of controllers
    logger.debug('excel_import_api', `Attempting to read Excel file from: ${excelFilePath}`, { userId: user?._id });

    if (!require('fs').existsSync(excelFilePath)) {
      logger.error('excel_import_api', 'Excel file not found at specified path.', { path: excelFilePath, userId: user?._id });
      return res.status(404).json({ message: 'Excel file (itemlist.xlsx) not found on server.' });
    }

    const { itemsToUpsert, parsingErrors } = await parseExcelBufferForUpdate(require('fs').readFileSync(excelFilePath));

    if (parsingErrors && parsingErrors.length > 0) {
      logger.warn('excel_import_api', 'API: Errors/Warnings during Excel parsing', { parsingErrorsCount: parsingErrors.length, parsingErrors, userId: user?._id });
    }

    if (!itemsToUpsert || itemsToUpsert.length === 0) {
      logger.info('excel_import_api', 'API: No items found in Excel to process', { userId: user?._id });
      return res.status(200).json({
        message: 'No valid items found in Excel to process or file is empty.',
        itemsCreated: 0,
        itemsUpdated: 0,
        itemsDeleted: 0,
        parsingErrors,
      });
    }

    const { itemsCreated, itemsUpdated, itemsDeleted, operationResults, databaseProcessingErrors } = await syncItemsWithDatabase(req, itemsToUpsert, user, 'excel_import_api');


    logger.info('excel_import_api', 'API: Excel import process completed', { itemsCreated, itemsUpdated, itemsDeleted, errors: databaseProcessingErrors.length, userId: user?._id });
    res.status(200).json({
        message: 'Excel data processed.',
        itemsCreated,
        itemsUpdated,
        itemsDeleted,
        parsingErrors,
        databaseProcessingDetails: operationResults,
        databaseProcessingErrors
    });

  } catch (error) {
    logger.error('excel_import_api', 'API: Unhandled error during Excel import process', { error: error.message, stack: error.stack, userId: user?._id });
    res.status(500).json({ message: 'Server error during Excel processing.', error: error.message });
  }
};

exports.getCategories = async (req, res) => {
  const user = req.user || null;
  try {
    logger.debug('item', "Attempting to fetch categories", user);
    // Fetch distinct categories and their subcategories efficiently
    const aggregationResult = await Item.aggregate([
      { $match: { status: 'approved' } }, // Only consider approved items for category listing
      { $group: { _id: "$category", subcategories: { $addToSet: "$subcategory" } } },
      { $project: { category: "$_id", subcategories: 1, _id: 0 } },
      { $sort: { category: 1 } }
    ]);

    const categories = aggregationResult.map(catGroup => ({
      category: catGroup.category || 'Other',
      subcategories: (catGroup.subcategories || ['General']).filter(Boolean).sort() // Filter out null/empty and sort
    }));

    logger.debug('item', "Categories fetched successfully", user, { categoryCount: categories.length });
    res.json(categories);

  } catch (error) {
    logger.error('item', "Error in getCategories", error, user);
    res.status(500).json({
      success: false,
      message: 'Error fetching categories',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

exports.createCategory = async (req, res) => {
  const user = req.user || null;
  const { categoryName } = req.body;
  const logDetails = { userId: user?._id, categoryName };

  if (!categoryName || typeof categoryName !== 'string' || categoryName.trim() === '') {
    logger.warn('item', 'API: createCategory - Invalid or missing categoryName', user, logDetails);
    return res.status(400).json({ message: 'Category name is required.' });
  }

  const trimmedCategoryName = categoryName.trim();

  try {
    logger.info('item', `API: createCategory - Attempting to create category "${trimmedCategoryName}"`, user, logDetails);

    // Check if a category effectively exists (even via a dummy item)
    const existingCategory = await Item.findOne({ category: trimmedCategoryName });
    if (existingCategory) {
      logger.info('item', `API: createCategory - Category "${trimmedCategoryName}" already exists or an item with this category exists.`, user, logDetails);
      return res.status(409).json({ message: `Category "${trimmedCategoryName}" already exists.` });
    }
    
    // If no item exists with this category, we can consider it "new"
    // No need to create a dummy item if the goal is just to have it available for selection.
    // The category will "exist" once an item is saved with it.
    // If the frontend needs it immediately for a dropdown before any item is saved with it,
    // then a dummy item approach or a separate Categories collection would be needed.
    // For now, let's assume a category is "created" when an item uses it.
    // This controller might be more about validating if a category name is usable.

    logger.info('item', `API: createCategory - Category "${trimmedCategoryName}" is available for use.`, user, logDetails);
    res.status(201).json({ message: `Category "${trimmedCategoryName}" is available. It will be formally created when an item is saved with it.`, category: trimmedCategoryName });

  } catch (error) {
    logger.error('item', `API: createCategory - Error checking/creating category "${trimmedCategoryName}"`, error, user, logDetails);
    res.status(500).json({
      message: 'Server error while adding category',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

exports.createSubcategory = async (req, res) => {
  const user = req.user || null;
  const { categoryName, subcategoryName } = req.body;
  const logDetails = { userId: user?._id, categoryName, subcategoryName };

  if (!categoryName || typeof categoryName !== 'string' || categoryName.trim() === '') {
    logger.warn('item', 'API: createSubcategory - Invalid or missing categoryName', user, logDetails);
    return res.status(400).json({ message: 'Category name is required.' });
  }
  if (!subcategoryName || typeof subcategoryName !== 'string' || subcategoryName.trim() === '') {
    logger.warn('item', 'API: createSubcategory - Invalid or missing subcategoryName', user, logDetails);
    return res.status(400).json({ message: 'Subcategory name is required.' });
  }

  const trimmedCategoryName = categoryName.trim();
  const trimmedSubcategoryName = subcategoryName.trim();

  try {
    logger.info('item', `API: createSubcategory - Attempting to add subcategory "${trimmedSubcategoryName}" to category "${trimmedCategoryName}"`, user, logDetails);

    const existingSubcategory = await Item.findOne({ category: trimmedCategoryName, subcategory: trimmedSubcategoryName });
    if (existingSubcategory) {
      logger.info('item', `API: createSubcategory - Subcategory "${trimmedSubcategoryName}" already exists under category "${trimmedCategoryName}"`, user, logDetails);
      return res.status(409).json({ message: `Subcategory "${trimmedSubcategoryName}" already exists under category "${trimmedCategoryName}".` });
    }

    logger.info('item', `API: createSubcategory - Subcategory "${trimmedSubcategoryName}" under category "${trimmedCategoryName}" is available for use.`, user, logDetails);
    res.status(201).json({ message: `Subcategory "${trimmedSubcategoryName}" is available for category "${trimmedCategoryName}". It will be formally created when an item is saved with it.`, category: trimmedCategoryName, subcategory: trimmedSubcategoryName });

  } catch (error) {
    logger.error('item', `API: createSubcategory - Error adding subcategory "${trimmedSubcategoryName}" to category "${trimmedCategoryName}"`, error, user, logDetails);
    res.status(500).json({
      message: 'Server error while adding subcategory',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

exports.getItemById = async (req, res) => {
  const { id } = req.params;
  const user = req.user || null;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid item ID format' });
  }

  try {
    const item = await Item.findById(id)
      .populate('createdBy', 'firstname lastname email')
      .populate('reviewedBy', 'firstname lastname email');
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }
    logger.info('item', `Fetched item by ID: ${id}`, user, { itemId: id, itemName: item.name });
    res.json(item);
  } catch (error) {
    logger.error('item', `Error fetching item details for ID: ${id}`, error, user);
    res.status(500).json({ message: 'Server error while fetching item' });
  }
};

exports.createItem = async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      logger.warn('item', 'Create item attempt without authenticated user.', null, { requestBody: req.body });
      return res.status(401).json({ message: 'Authentication required.' });
    }

    const quantity = parseFloat(req.body.quantity) || 0;

    const newItemData = {
      name: req.body.name,
      quantity: quantity,
      sellingPrice: parseFloat(req.body.sellingPrice) || 0,
      buyingPrice: parseFloat(req.body.buyingPrice) || 0,
      gstRate: req.body.gstRate || 0,
      hsnCode: req.body.hsnCode || '',
      unit: req.body.unit || 'Nos',
      category: req.body.category || 'Other',
      subcategory: req.body.subcategory || 'General',
      maxDiscountPercentage: req.body.maxDiscountPercentage ? parseFloat(req.body.maxDiscountPercentage) : 0,
      lowStockThreshold: req.body.lowStockThreshold ? parseInt(req.body.lowStockThreshold, 10) : 5,
      createdBy: user._id,
      needsRestock: quantity < 0,
    };

    if (user.role === 'user') {
      newItemData.status = 'pending_review';
    } else { // admin or super-admin
      newItemData.status = 'approved';
      newItemData.reviewedBy = user._id;
      newItemData.reviewedAt = new Date();
    }

    const newItem = new Item(newItemData);
    const savedItem = await newItem.save();
    logger.info('item', `Item created successfully by ${user.email} with status ${savedItem.status}`, user, {
      itemId: savedItem._id,
      itemName: savedItem.name,
      status: savedItem.status
    });
    res.status(201).json(savedItem);
  } catch (error) {
    logger.error('item', `Failed to create item`, error, req.user, { requestBody: req.body, userId: req.user?._id });
    if (error.code === 11000) { // Duplicate key error
        return res.status(400).json({ message: 'An item with this name already exists. Please use a unique name.' });
    }
    res.status(400).json({
      message: error.message.includes('validation') ?
        'Validation failed: ' + error.message :
        'Error creating item'
    });
  }
};

exports.updateItem = async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      logger.warn('item', `Update item attempt without authenticated user. Item ID: ${req.params.id}`, null, { requestBody: req.body });
      return res.status(401).json({ message: 'Authentication required.' });
    }

    const itemId = req.params.id;
    const existingItem = await Item.findById(itemId);

    if (!existingItem) {
      logger.warn('item', `Item not found for update: ${itemId}`, user, { itemId, requestBody: req.body });
      return res.status(404).json({ message: 'Item not found' });
    }

    const quantity = req.body.quantity !== undefined ? (parseFloat(req.body.quantity) || 0) : existingItem.quantity;

    const updatePayload = {
      name: req.body.name,
      quantity: quantity,
      sellingPrice: req.body.sellingPrice || 0,
      buyingPrice: req.body.buyingPrice || 0,
      gstRate: req.body.gstRate || 0,
      hsnCode: req.body.hsnCode || '',
      unit: req.body.unit || 'Nos',
      category: req.body.category || 'Other',
      subcategory: req.body.subcategory || 'General',
      maxDiscountPercentage: req.body.maxDiscountPercentage ? parseFloat(req.body.maxDiscountPercentage) : 0,
      lowStockThreshold: req.body.lowStockThreshold ? parseInt(req.body.lowStockThreshold, 10) : 5,
      needsRestock: quantity < 0,
    };

    // Handle status update logic
    if (req.body.status && (user.role === 'admin' || user.role === 'super-admin')) {
        if (['pending_review', 'approved'].includes(req.body.status)) {
             updatePayload.status = req.body.status;
             if (req.body.status === 'approved' && existingItem.status !== 'approved') {
                updatePayload.reviewedBy = user._id;
                updatePayload.reviewedAt = new Date();
                logger.info('item', `Item ${itemId} status changed to 'approved' by ${user.email}.`, user, { itemId });
             }
        }
    } else if ((user.role === 'admin' || user.role === 'super-admin') && existingItem.status === 'pending_review') {
      // If admin edits a pending item, it gets approved
      updatePayload.status = 'approved';
      updatePayload.reviewedBy = user._id;
      updatePayload.reviewedAt = new Date();
      logger.info('item', `Item ${itemId} approved upon update by admin ${user.email}.`, user, { itemId });
    }


    const updatedItem = await Item.findByIdAndUpdate(
      itemId,
      { $set: updatePayload },
      { new: true, runValidators: true }
    );

    if (!updatedItem) {
      logger.warn('item', `Item not found during update execution: ${itemId}`, user, { itemId, requestBody: req.body });
      return res.status(404).json({ message: 'Item not found during update' });
    }

    logger.info('item', `Item updated successfully by ${user.email}`, user, { itemId: updatedItem._id, itemName: updatedItem.name, newStatus: updatedItem.status });
    res.json(updatedItem);
  } catch (error) {
    logger.error('item', `Error updating item ID: ${req.params.id}`, error, req.user, { requestBody: req.body, userId: req.user?._id });
    if (error.code === 11000) { // Duplicate key error for name
        return res.status(400).json({ message: 'An item with this name already exists. Please use a unique name.' });
    }
    res.status(400).json({
      message: error.message.includes('validation') ?
        'Validation failed: ' + error.message :
        'Error updating item'
    });
  }
};

exports.approveItem = async (req, res) => {
  try {
    const user = req.user;
    if (!user || (user.role !== 'admin' && user.role !== 'super-admin')) {
      logger.warn('item', `Unauthorized attempt to approve item ${req.params.id} by user ${user?.email || 'unknown'}.`, user);
      return res.status(403).json({ message: 'Forbidden: Only admins can approve items.' });
    }

    const itemId = req.params.id;
    const itemToApprove = await Item.findById(itemId);

    if (!itemToApprove) {
      logger.warn('item', `Item not found for approval: ${itemId}`, user, { itemId });
      return res.status(404).json({ message: 'Item not found.' });
    }

    if (itemToApprove.status === 'approved') {
      logger.info('item', `Item ${itemId} is already approved. No action taken by ${user.email}.`, user, { itemId });
      return res.status(200).json(itemToApprove); // Return the already approved item
    }

    itemToApprove.status = 'approved';
    itemToApprove.reviewedBy = user._id;
    itemToApprove.reviewedAt = new Date();

    const approvedItem = await itemToApprove.save();
    logger.info('item', `Item ${itemId} approved successfully by ${user.email}.`, user, { itemId: approvedItem._id, itemName: approvedItem.name });
    res.json(approvedItem);

  } catch (error) {
    logger.error('item', `Error approving item ID: ${req.params.id}`, error, req.user, { userId: req.user?._id });
    res.status(500).json({ message: 'Error approving item.' });
  }
};

exports.deleteItem = async (req, res) => {
  const itemId = req.params.id;
  const userId = req.user ? req.user._id : null;
  const user = req.user || null; // For logging context
  const session = await mongoose.startSession();
  const logDetails = { userId, itemId, model: 'Item', operation: 'delete', sessionId: session.id.toString() };

  logger.info('delete', `[DELETE_INITIATED] Item ID: ${itemId}. Transaction started.`, user, logDetails);

  try {
    session.startTransaction();
    logger.debug('delete', `[FETCH_ATTEMPT] Finding Item ID: ${itemId} for backup and deletion within transaction.`, user, logDetails);
    const itemToBackup = await Item.findById(itemId).session(session);

    if (!itemToBackup) {
      await session.abortTransaction();
      logger.warn('delete', `[NOT_FOUND] Item not found for deletion. Transaction aborted.`, user, logDetails);
      return res.status(404).json({ message: 'Item not found' });
    }
    logger.debug('delete', `[FETCH_SUCCESS] Found Item ID: ${itemId}. Preparing for backup within transaction.`, user, logDetails);

    const backupData = {
      originalId: itemToBackup._id,
      originalModel: 'Item',
      data: itemToBackup.toObject(), // Store the full item data
      deletedBy: userId,
      deletedAt: new Date(),
      originalCreatedAt: itemToBackup.createdAt,
      originalUpdatedAt: itemToBackup.updatedAt,
      backupReason: "User-initiated deletion via API"
    };
    
    const newBackupEntry = new UniversalBackup(backupData);

    logger.debug('delete', `[PRE_BACKUP_SAVE] Attempting to save backup for Item ID: ${itemToBackup._id} to UniversalBackup within transaction.`, user, { ...logDetails, originalId: itemToBackup._id });
    await newBackupEntry.save({ session });
    logger.info('delete', `[BACKUP_SUCCESS] Item successfully backed up to UniversalBackup. Backup ID: ${newBackupEntry._id}.`, user, { ...logDetails, originalId: itemToBackup._id, backupId: newBackupEntry._id, backupModel: 'UniversalBackup' });

    logger.debug('delete', `[PRE_ORIGINAL_DELETE] Attempting to delete original Item ID: ${itemToBackup._id} within transaction.`, user, { ...logDetails, originalId: itemToBackup._id });
    const deleteResult = await Item.findByIdAndDelete(itemId, { session });
    if (!deleteResult) {
        // This case should ideally not be hit if findById found it, but as a safeguard:
        await session.abortTransaction();
        logger.error('delete', `[DELETE_FAILED_UNEXPECTEDLY] Item ${itemId} found but failed to delete. Transaction aborted.`, user, logDetails);
        return res.status(500).json({ message: 'Failed to delete item after backup. Operation rolled back.' });
    }
    logger.info('delete', `[ORIGINAL_DELETE_SUCCESS] Original Item successfully deleted.`, user, { ...logDetails, originalId: itemToBackup._id });

    // Update Purchase records: Set itemId to null for the deleted item
    // This is a "soft link" break, preserving purchase history but noting the item is gone.
    logger.debug('delete', `[UPDATE_PURCHASES_ATTEMPT] Unlinking deleted Item ID: ${itemId} from Purchase records within transaction.`, user, { ...logDetails, targetModel: 'Purchase' });
    const purchaseUpdateResult = await Purchase.updateMany(
      { 'items.itemId': itemId },
      { $set: { 'items.$.itemId': null, 'items.$.description': `${itemToBackup.name} (Deleted)` } }, // Mark as deleted in description
      { session }
    );
    logger.info('delete', `[UPDATE_PURCHASES_SUCCESS] Purchase records updated. Matched: ${purchaseUpdateResult.matchedCount}, Modified: ${purchaseUpdateResult.modifiedCount}.`, user, { ...logDetails, targetModel: 'Purchase' });

    // Conceptual: Update Tickets/Quotations
    // If Tickets/Quotations store item snapshots, no direct update might be needed here.
    // If they store only itemId, this is where you'd unlink or mark as deleted.
    // For ERP, often items are soft-deleted (archived) if they have significant transaction history.
    // Example: Mark item as deleted in active tickets (status not 'Closed' or 'Cancelled')
    // const ticketUpdateResult = await Ticket.updateMany(
    //   { 'goods.itemId': itemId, status: { $nin: ['Closed', 'Cancelled'] } }, // Example: only active tickets
    //   { $set: { 'goods.$.description': `${itemToBackup.name} (Item Deleted)`, 'goods.$.itemUnavailable': true } },
    //   { session }
    // );
    // logger.info('delete', `[UPDATE_TICKETS_CONCEPTUAL] Active Ticket records potentially updated for Item ID: ${itemId}. Matched: ${ticketUpdateResult.matchedCount}, Modified: ${ticketUpdateResult.modifiedCount}.`, user, logDetails);


    await session.commitTransaction();
    res.status(200).json({
      message: 'Item deleted, backed up, and related records updated successfully.',
      originalId: itemToBackup._id,
      backupId: newBackupEntry._id
    });

  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
      logger.warn('delete', `[ROLLBACK_TRANSACTION] Transaction rolled back due to error during Item deletion process for ID: ${itemId}.`, user, { ...logDetails, errorMessage: error.message, stack: error.stack });
    }
    logger.error('delete', `[DELETE_ERROR] Error during Item deletion process for ID: ${itemId}.`, error, user, logDetails);
    res.status(500).json({ message: 'Server error during the deletion process. Please check server logs.' });
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
      return res.status(400).json({ message: 'Invalid item ID format' });
    }

    const itemExists = await Item.exists({ _id: id });
    if (!itemExists) {
      logger.warn('item', `Item not found when fetching purchase history: ${id}`, user);
      return res.status(404).json({ message: 'Item not found' });
    }

    const purchases = await Purchase.find({
      'items.itemId': new mongoose.Types.ObjectId(id)
    }, {
      date: 1,
      companyName: 1,
      gstNumber: 1,
      invoiceNumber: 1,
      'items.$': 1, // Get only the matching item from the array
      createdBy: 1 // To get createdByName
    })
    .populate('createdBy', 'firstname lastname') // Populate createdBy for the purchase document
    .sort({ date: -1 }).limit(50);

    const formattedPurchases = purchases.map(purchase => {
      const itemData = purchase.items[0]; // Should be only one due to .$
      const createdByName = purchase.createdBy ? `${purchase.createdBy.firstname || ''} ${purchase.createdBy.lastname || ''}`.trim() : 'System';

      return {
        _id: purchase._id,
        date: purchase.date,
        companyName: purchase.companyName,
        gstNumber: purchase.gstNumber,
        invoiceNumber: purchase.invoiceNumber,
        quantity: itemData?.quantity || 0,
        price: itemData?.price || 0,
        gstRate: itemData?.gstRate || 0,
        amount: (itemData?.price || 0) * (itemData?.quantity || 0),
        totalWithGst: (itemData?.price || 0) * (itemData?.quantity || 0) *
                      (1 + (itemData?.gstRate || 0) / 100),
        createdByName: createdByName
      };
    });

    res.json(formattedPurchases);
  } catch (error) {
    logger.error('item', `Failed to fetch purchase history for item ID: ${req.params.id}`, error, user);
    res.status(500).json({
      message: 'Server error while fetching purchase history',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

exports.getRestockSummary = async (req, res) => {
  const user = req.user || null;
  const lowGlobalThreshold = parseInt(req.query.lowGlobalThreshold, 10) || 3; // Default from frontend

  try {
    logger.debug('item', "Fetching restock summary", user, { lowGlobalThreshold });

    const restockNeededCount = await Item.countDocuments({
      quantity: { $lt: 0 },
      status: 'approved' // Only count approved items for restock alerts
    });

    const lowStockWarningCount = await Item.countDocuments({
      quantity: { $gte: 0, $lt: lowGlobalThreshold },
      status: 'approved' // Only count approved items for low stock warnings
    });

    res.json({
      restockNeededCount: restockNeededCount,
      lowStockWarningCount: lowStockWarningCount,
    });
  } catch (error) {
     logger.error('item', "Error fetching restock summary", error, user, { lowGlobalThreshold, errorMessage: error.message, stack: error.stack });
    res.status(500).json({ 
      message: 'Server error while fetching restock summary',
      error: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred.'
    });

  }
};

exports.getItemTicketUsageHistory = async (req, res) => {
  const user = req.user || null;
  const { id: itemId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(itemId)) {
    logger.warn('item_ticket_usage', `Invalid item ID format: ${itemId}`, user);
    return res.status(400).json({ message: 'Invalid item ID format' });
  }

  try {
    const item = await Item.findById(itemId).lean();
    if (!item) {
      logger.warn('item_ticket_usage', `Item not found: ${itemId}`, user);
      return res.status(404).json({ message: 'Item not found' });
    }

    logger.debug('item_ticket_usage', `Fetching ticket usage history for item: ${item.name} (ID: ${itemId})`, user);

    // Build query based on item's name and HSN code for robustness
    // This assumes that when an item is added to a ticket, its name and HSN are stored.
    const queryConditions = {
      "goods.description": item.name,
      // Optionally, match HSN code if available and reliable
      // "goods.hsnSacCode": item.hsnCode 
    };
    // If you store itemId directly in ticket goods, the query would be simpler:
    // const queryConditions = { "goods.itemId": new mongoose.Types.ObjectId(itemId) };


    const ticketsContainingItem = await Ticket.find(queryConditions)
      .populate('createdBy', 'firstname lastname')
      .select('ticketNumber goods createdAt createdBy')
      .sort({ createdAt: -1 }) // Sort by ticket creation date
      .lean();

    const ticketUsageHistory = [];

    for (const ticket of ticketsContainingItem) {
      // Find the specific good entry that matches the item
      // This might need refinement if multiple goods in a ticket can have the same description/HSN
      const relevantGood = ticket.goods.find(
        g => g.description === item.name // Add HSN match if needed: && g.hsnSacCode === item.hsnCode
      );

      if (relevantGood && relevantGood.quantity > 0) {
        ticketUsageHistory.push({
          date: ticket.createdAt,
          type: 'Ticket Usage',
          user: ticket.createdBy ? `${ticket.createdBy.firstname || ''} ${ticket.createdBy.lastname || ''}`.trim() : 'System',
          details: `Used ${relevantGood.quantity} unit(s) in Ticket: ${ticket.ticketNumber}`,
          quantityChange: -parseFloat(relevantGood.quantity) || 0, // Negative as it's usage
          ticketId: ticket._id,
          ticketNumber: ticket.ticketNumber,
        });
      }
    }
    
    // No need to sort again if MongoDB already sorted
    logger.info('item_ticket_usage', `Successfully fetched ${ticketUsageHistory.length} ticket usage entries for item: ${item.name}`, user);
    res.json(ticketUsageHistory);

  } catch (error) {
    logger.error('item_ticket_usage', `Error fetching ticket usage history for item ID: ${itemId}`, error, user);
    res.status(500).json({
      message: 'Server error while fetching item ticket usage history',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
