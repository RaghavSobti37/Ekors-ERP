const { Item, Purchase } = require('../models/itemlist');
const ItemBackup = require('../models/itemBackup'); // Import backup model
const mongoose = require('mongoose');
const logger = require('../utils/logger'); // Import logger
// const { parseExcelDataForUpdate } = require('../utils/excelImporter'); // Old utility
const { parseExcelBufferForUpdate } = require('../utils/excelImporter'); // New utility for uploaded files
const path = require('path');
const multer = require('multer');
const xlsx = require('xlsx'); // For export

// Get all items
exports.getAllItems = async (req, res) => {
  const user = req.user || null;
  try {
    logger.debug('item', "Fetching all items", user);
    const items = await Item.find().sort({ name: 1 });
    logger.debug('item', "Items fetched successfully", user, { count: items.length });
    // logger.info('item', `Fetched all items`, user, { count: items.length }); // Can be noisy
    res.json(items);
  } catch (error) {
    logger.error('item', "Error fetching items", error, user);
    res.status(500).json({ 
      message: 'Server error while fetching items',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Configure multer for memory storage (to get file buffer)
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
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});
exports.uploadMiddleware = upload.single('excelFile'); // 'excelFile' is the field name in FormData

exports.exportItemsToExcel = async (req, res) => {
  const user = req.user || null;
  logger.info('excel_export', 'API: Starting Excel export process', { userId: user?._id });
  try {
    const items = await Item.find().lean(); // .lean() for faster plain JS objects

    if (!items || items.length === 0) {
      logger.info('excel_export', 'No items found to export', { userId: user?._id });
      return res.status(404).json({ message: 'No items found to export.' });
    }

    const dataForSheet = items.map(item => ({
      'Name': item.name,
      'Quantity': item.quantity,
      'Selling Price': item.sellingPrice, // Changed from Price
      'Buying Price': item.buyingPrice,   // Added Buying Price
      'Unit': item.unit,
      'Category': item.category,
      'Subcategory': item.subcategory,
      'HSN Code': item.hsnCode,
      'GST Rate': item.gstRate,
      'Max Discount Percentage': item.maxDiscountPercentage,
      'Low Stock Threshold': item.lowStockThreshold,
      // 'Image': item.image, // Not including image in this export
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
        itemsDeleted: 0, // Added for consistency
        parsingErrors,
      });
    }

    const { itemsCreated, itemsUpdated, itemsDeleted, operationResults, databaseProcessingErrors } = await syncItemsWithDatabase(req, itemsToUpsert, user, 'excel_upload_import');

    logger.info('excel_upload_import', 'API: Excel import from upload process completed', { itemsCreated, itemsUpdated, itemsDeleted, errors: databaseProcessingErrors.length, userId: user?._id });
    res.status(200).json({ 
        message: 'Uploaded Excel data processed.', 
        itemsCreated, 
        itemsUpdated, 
        itemsDeleted, // Added for consistency
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

  try {
    logger.info(logContextPrefix, 'Starting database sync with Excel data.', {userId: importUserId}, { itemCountExcel: excelItems.length });

    const existingDbItems = await Item.find().lean(); 
    const dbItemsMap = new Map(existingDbItems.map(item => [item.name.toLowerCase(), item])); 
    const excelItemNamesLowerCase = new Set(excelItems.map(item => item.name.toLowerCase())); 

    logger.debug(logContextPrefix, `Fetched ${existingDbItems.length} existing items from DB.`, {userId: importUserId});

    for (const excelItemData of excelItems) {
      const normalizedExcelItemName = excelItemData.name.toLowerCase();
      const existingItem = dbItemsMap.get(normalizedExcelItemName);

      const payload = {
        name: excelItemData.name, 
        quantity: excelItemData.quantity || 0,
        sellingPrice: excelItemData.sellingPrice || excelItemData.price || 0, 
        buyingPrice: excelItemData.buyingPrice || 0, 
        unit: excelItemData.unit || 'Nos',
        category: excelItemData.category || 'Other',
        subcategory: excelItemData.subcategory || 'General',
        gstRate: excelItemData.gstRate || 0,
        hsnCode: excelItemData.hsnCode || '',
        maxDiscountPercentage: excelItemData.maxDiscountPercentage || 0,
        lowStockThreshold: excelItemData.lowStockThreshold || 5,
        // Fields to be preserved or updated from existing item if not in excel
        image: excelItemData.image !== undefined ? excelItemData.image : (existingItem?.image || ''),
        discountAvailable: excelItemData.discountAvailable !== undefined ? excelItemData.discountAvailable : (existingItem?.discountAvailable || false),
        needsRestock: excelItemData.needsRestock !== undefined ? excelItemData.needsRestock : (existingItem?.needsRestock || false),
        lastPurchaseDate: excelItemData.lastPurchaseDate !== undefined ? excelItemData.lastPurchaseDate : (existingItem?.lastPurchaseDate || null),
        lastPurchasePrice: excelItemData.lastPurchasePrice !== undefined ? excelItemData.lastPurchasePrice : (existingItem?.lastPurchasePrice || null),
      };

      if (existingItem) {
        const currentHistory = existingItem.excelImportHistory || [];
        const changes = [];
        let itemActuallyModified = false;

        Object.keys(payload).forEach(key => {
          if (payload.hasOwnProperty(key)) { // Ensure key is own property of payload
            // Compare stringified values to handle type differences simply, or use deep equality for complex cases
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
      } else {
        payload.excelImportHistory = [{
          action: 'created',
          importedBy: importUserId,
          importedAt: new Date(),
          fileName: importFileName,
          snapshot: { ...payload } 
        }];

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
        const backupData = {
          ...itemToDelete, 
          originalId: itemToDelete._id,
          deletedBy: importUserId,
          deletedAt: new Date(),
          originalCreatedAt: itemToDelete.createdAt,
          originalUpdatedAt: itemToDelete.updatedAt,
          backupReason: "Deleted during Excel synchronization"
        };
        delete backupData._id; 
        
        backupInsertOps.push({
            insertOne: {
                document: backupData
            }
        });
        itemDeleteOps.push({
            deleteOne: {
                filter: { _id: itemToDelete._id }
            }
        });
        logger.debug(logContextPrefix, `Item "${itemToDelete.name}" (ID: ${itemToDelete._id}) marked for BACKUP and DELETION.`, {userId: importUserId});
      }
    } else {
        logger.info(logContextPrefix, "No items from DB are marked for deletion (all DB items present in Excel or DB is empty).", {userId: importUserId});
    }

    if (backupInsertOps.length > 0) {
        logger.info(logContextPrefix, `Attempting to bulk insert ${backupInsertOps.length} item backups.`, {userId: importUserId});
        try {
            const backupResult = await ItemBackup.bulkWrite(backupInsertOps, { ordered: false });
            logger.info(logContextPrefix, `Item backups bulk operation completed. Inserted: ${backupResult.insertedCount}.`, {userId: importUserId}, { backupResult: { inserted: backupResult.insertedCount, errors: backupResult.hasWriteErrors() ? backupResult.getWriteErrors().length : 0 } });
            
            if (backupResult.hasWriteErrors()) {
                const writeErrors = backupResult.getWriteErrors();
                logger.warn(logContextPrefix, `${writeErrors.length} errors occurred during item backup. These items will not be deleted.`, {userId: importUserId});
                writeErrors.forEach(err => {
                    const failedBackupOp = backupInsertOps[err.index]?.insertOne?.document;
                    const originalItemId = failedBackupOp?.originalId;
                    logger.error(logContextPrefix, `Backup failed for item (original name: ${failedBackupOp?.name}, original ID: ${originalItemId}). Original item will NOT be deleted.`, {userId: importUserId}, { error: err.errmsg, opDetails: failedBackupOp });
                    databaseProcessingErrors.push({ name: `Backup for ${failedBackupOp?.name || originalItemId}`, status: 'backup_error', message: err.errmsg });
                    
                    const deleteOpIndex = itemDeleteOps.findIndex(op => op.deleteOne.filter._id.toString() === originalItemId.toString());
                    if (deleteOpIndex > -1) {
                        itemDeleteOps.splice(deleteOpIndex, 1);
                        logger.warn(logContextPrefix, `Removed item "${failedBackupOp?.name}" (ID: ${originalItemId}) from deletion queue due to backup failure.`, {userId: importUserId});
                    }
                });
            }
        } catch (backupBulkError) {
            logger.error(logContextPrefix, 'CRITICAL error during ItemBackup.bulkWrite. ALL delete operations for this sync will be cancelled.', {userId: importUserId}, { error: backupBulkError.message, stack: backupBulkError.stack });
            databaseProcessingErrors.push({ name: 'Bulk Backup Operation', status: 'critical_error', message: `Backup bulkWrite failed: ${backupBulkError.message}. No items were deleted.` });
            itemDeleteOps.length = 0; 
            logger.warn(logContextPrefix, 'All item delete operations cancelled due to critical failure in bulk backup.', {userId: importUserId});
        }
    }

    if (itemUpsertOps.length > 0) {
      logger.info(logContextPrefix, `Attempting to bulk create/update ${itemUpsertOps.length} items.`, {userId: importUserId});
      const upsertResult = await Item.bulkWrite(itemUpsertOps, { ordered: false });
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

    if (itemDeleteOps.length > 0) {
        logger.info(logContextPrefix, `Attempting to bulk delete ${itemDeleteOps.length} items (whose backups were processed).`, {userId: importUserId});
        const deleteResult = await Item.bulkWrite(itemDeleteOps, { ordered: false });
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
    
    logger.info(logContextPrefix, 'Database sync with Excel data finished.', {userId: importUserId}, { itemsCreated, itemsUpdated, itemsDeleted });

  } catch (error) {
    logger.error(logContextPrefix, `CRITICAL error during syncItemsWithDatabase: ${error.message}`, {userId: importUserId}, { error, stack: error.stack });
    databaseProcessingErrors.push({ name: 'General Sync Error', status: 'critical_error', message: error.message });
  }

  return { itemsCreated, itemsUpdated, itemsDeleted, operationResults, databaseProcessingErrors };
}

exports.importItemsFromExcelViaAPI = async (req, res) => {
  const user = req.user || null;
  logger.info('excel_import_api', 'API: Starting Excel import process', { userId: user?._id });

  try {
    const excelFilePath = path.resolve(__dirname, '..', 'itemlist.xlsx'); 
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
        itemsDeleted: 0, // Added for consistency
        parsingErrors,
      });
    }
    
    // Pass req to syncItemsWithDatabase for filename access
    const { itemsCreated, itemsUpdated, itemsDeleted, operationResults, databaseProcessingErrors } = await syncItemsWithDatabase(req, itemsToUpsert, user, 'excel_import_api');


    logger.info('excel_import_api', 'API: Excel import process completed', { itemsCreated, itemsUpdated, itemsDeleted, errors: databaseProcessingErrors.length, userId: user?._id });
    res.status(200).json({ 
        message: 'Excel data processed.', 
        itemsCreated, 
        itemsUpdated, 
        itemsDeleted, // Added for consistency
        parsingErrors, 
        databaseProcessingDetails: operationResults, 
        databaseProcessingErrors 
    });

  } catch (error) {
    logger.error('excel_import_api', 'API: Unhandled error during Excel import process', { error: error.message, stack: error.stack, userId: user?._id });
    res.status(500).json({ message: 'Server error during Excel processing.', error: error.message });
  }
};

// Get item categories
exports.getCategories = async (req, res) => {
  const user = req.user || null;
  try {
    logger.debug('item', "Attempting to fetch categories", user);
    const items = await Item.find({}, 'category subcategory');
    
    const categoriesMap = new Map();
    
    items.forEach(item => {
      const category = item.category || 'Other'; 
      
      if (!categoriesMap.has(category)) {
        categoriesMap.set(category, new Set());
      }
      
      if (item.subcategory) {
        categoriesMap.get(category).add(item.subcategory);
      } else {
        categoriesMap.get(category).add('General');
      }
    });
    
    const categories = Array.from(categoriesMap).map(([category, subcategories]) => ({
      category,
      subcategories: Array.from(subcategories)
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

// Create new category
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

    const existingItem = await Item.findOne({ category: trimmedCategoryName });

    if (existingItem) {
      logger.info('item', `API: createCategory - Category "${trimmedCategoryName}" already exists`, user, logDetails);
      return res.status(409).json({ message: `Category "${trimmedCategoryName}" already exists.` });
    }

    const dummyItem = new Item({
      name: `_Dummy Item for Category: ${trimmedCategoryName}_`, 
      category: trimmedCategoryName,
      subcategory: 'General', 
      sellingPrice: 0, 
      unit: 'Nos',
      quantity: 0,
      gstRate: 0,
      hsnCode: '',
      maxDiscountPercentage: 0,
      lowStockThreshold: 0,
    });

    await dummyItem.save();
    logger.info('item', `API: createCategory - Category "${trimmedCategoryName}" created successfully via dummy item`, user, { ...logDetails, dummyItemId: dummyItem._id });

    res.status(201).json({ message: 'Category added successfully.', category: trimmedCategoryName });

  } catch (error) {
    logger.error('item', `API: createCategory - Error creating category "${trimmedCategoryName}"`, error, user, logDetails);
    res.status(500).json({
      message: 'Server error while adding category',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Create new subcategory for a given category
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

    const existingItem = await Item.findOne({ category: trimmedCategoryName, subcategory: trimmedSubcategoryName });

    if (existingItem) {
      logger.info('item', `API: createSubcategory - Subcategory "${trimmedSubcategoryName}" already exists under category "${trimmedCategoryName}"`, user, logDetails);
      return res.status(409).json({ message: `Subcategory "${trimmedSubcategoryName}" already exists under category "${trimmedCategoryName}".` });
    }

    const dummyItem = new Item({
      name: `_Dummy Item for Subcategory: ${trimmedSubcategoryName} in ${trimmedCategoryName}_`, 
      category: trimmedCategoryName,
      subcategory: trimmedSubcategoryName,
      sellingPrice: 0, 
      unit: 'Nos',
      quantity: 0,
      gstRate: 0,
      hsnCode: '',
      maxDiscountPercentage: 0,
      lowStockThreshold: 0,
    });

    await dummyItem.save();
    logger.info('item', `API: createSubcategory - Subcategory "${trimmedSubcategoryName}" added to category "${trimmedCategoryName}" successfully via dummy item`, user, { ...logDetails, dummyItemId: dummyItem._id });

    res.status(201).json({ message: 'Subcategory added successfully.', category: trimmedCategoryName, subcategory: trimmedSubcategoryName });

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
    const item = await Item.findById(id);
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

// Create new item
exports.createItem = async (req, res) => {
  try {
    const user = req.user || null;
    const newItem = new Item({
      name: req.body.name,
      quantity: parseFloat(req.body.quantity) || 0,
      sellingPrice: parseFloat(req.body.sellingPrice) || 0, 
      buyingPrice: parseFloat(req.body.buyingPrice) || 0,   
      gstRate: req.body.gstRate || 0,
      hsnCode: req.body.hsnCode || '',
      unit: req.body.unit || 'Nos',
      category: req.body.category || 'Other',
      subcategory: req.body.subcategory || 'General',
      maxDiscountPercentage: req.body.maxDiscountPercentage ? parseFloat(req.body.maxDiscountPercentage) : 0,
      lowStockThreshold: req.body.lowStockThreshold ? parseInt(req.body.lowStockThreshold, 10) : 5 
    });

    const savedItem = await newItem.save();
    logger.info('item', `Item created successfully`, user, { itemId: savedItem._id, itemName: savedItem.name });
    res.status(201).json(savedItem);
  } catch (error) {
    logger.error('item', `Failed to create item`, error, req.user, { requestBody: req.body });
    res.status(400).json({ 
      message: error.message.includes('validation') ? 
        'Validation failed: ' + error.message : 
        'Error creating item'
    });
  }
};

// Update item
exports.updateItem = async (req, res) => {
  try {
    const user = req.user || null;
    const updatedItem = await Item.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          name: req.body.name,
          quantity: req.body.quantity || 0,
          sellingPrice: req.body.sellingPrice || 0, 
          buyingPrice: req.body.buyingPrice || 0,   
          gstRate: req.body.gstRate || 0,
          hsnCode: req.body.hsnCode || '',
          unit: req.body.unit || 'Nos',
          category: req.body.category || 'Other',
          subcategory: req.body.subcategory || 'General',
          maxDiscountPercentage: req.body.maxDiscountPercentage ? parseFloat(req.body.maxDiscountPercentage) : 0,
          lowStockThreshold: req.body.lowStockThreshold ? parseInt(req.body.lowStockThreshold, 10) : 5 
        }
      },
      { new: true, runValidators: true }
    );
    
    if (!updatedItem) {
      logger.warn('item', `Item not found for update: ${req.params.id}`, user, { itemId: req.params.id, requestBody: req.body });
      return res.status(404).json({ message: 'Item not found' });
    }
    
    logger.info('item', `Item updated successfully`, user, { itemId: updatedItem._id, itemName: updatedItem.name });
    res.json(updatedItem);
  } catch (error) {
    logger.error('item', `Error updating item ID: ${req.params.id}`, error, user, { requestBody: req.body });
    res.status(400).json({ 
      message: error.message.includes('validation') ? 
        'Validation failed: ' + error.message : 
        'Error updating item'
    });
  }
};

// Delete item
exports.deleteItem = async (req, res) => {
  const itemId = req.params.id;
  const userId = req.user ? req.user._id : null;
  const user = req.user || null; // For logger consistency
  const session = await mongoose.startSession();
  const logDetails = { userId, itemId, model: 'Item', operation: 'delete', sessionId: session.id };

  logger.info('delete', `[DELETE_INITIATED] Item ID: ${itemId}. Transaction started.`, user, logDetails);

  try {
    session.startTransaction();
    logger.debug('delete', `[FETCH_ATTEMPT] Finding Item ID: ${itemId} for backup and deletion within transaction.`, user, logDetails);
    const itemToBackup = await Item.findById(itemId).session(session);
    
    if (!itemToBackup) {
      await session.abortTransaction(); 
      session.endSession();
      logger.warn('delete', `[NOT_FOUND] Item not found for deletion. Transaction aborted.`, user, logDetails);
      return res.status(404).json({ message: 'Item not found' });
    }
    logger.debug('delete', `[FETCH_SUCCESS] Found Item ID: ${itemId}. Preparing for backup within transaction.`, user, logDetails);

    const backupData = itemToBackup.toObject();
    const newBackupEntry = new ItemBackup({
      ...backupData,
      originalId: itemToBackup._id,
      deletedBy: userId,
      deletedAt: new Date(),
      originalCreatedAt: itemToBackup.createdAt,
      originalUpdatedAt: itemToBackup.updatedAt,
      backupReason: "User-initiated deletion via API"
    });

    logger.debug('delete', `[PRE_BACKUP_SAVE] Attempting to save backup for Item ID: ${itemToBackup._id} within transaction.`, user, { ...logDetails, originalId: itemToBackup._id });
    await newBackupEntry.save({ session }); 
    logger.info('delete', `[BACKUP_SUCCESS] Item successfully backed up. Backup ID: ${newBackupEntry._id}.`, user, { ...logDetails, originalId: itemToBackup._id, backupId: newBackupEntry._id, backupModel: 'ItemBackup' });

    logger.debug('delete', `[PRE_ORIGINAL_DELETE] Attempting to delete original Item ID: ${itemToBackup._id} within transaction.`, user, { ...logDetails, originalId: itemToBackup._id });
    await Item.findByIdAndDelete(itemId, { session });
    logger.info('delete', `[ORIGINAL_DELETE_SUCCESS] Original Item successfully deleted.`, user, { ...logDetails, originalId: itemToBackup._id });

    logger.debug('delete', `[UPDATE_PURCHASES_ATTEMPT] Updating Purchase records referencing deleted Item ID: ${itemId} within transaction.`, user, { ...logDetails, targetModel: 'Purchase' });
    await Purchase.updateMany(
      { 'items.itemId': itemId },
      { $set: { 'items.$.itemId': null } }
    ).session(session); 
    logger.info('delete', `[UPDATE_PURCHASES_SUCCESS] Purchase records updated for Item ID: ${itemId}.`, user, { ...logDetails, targetModel: 'Purchase' });

    await session.commitTransaction();
    res.status(200).json({
      message: 'Item deleted, backed up, and purchase references updated successfully.',
      originalId: itemToBackup._id,
      backupId: newBackupEntry._id
    });

  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
      logger.warn('delete', `[ROLLBACK_TRANSACTION] Transaction rolled back due to error during Item deletion process for ID: ${itemId}.`, user, { ...logDetails, errorMessage: error.message });
    }
    logger.error('delete', `[DELETE_ERROR] Error during Item deletion process for ID: ${itemId}.`, error, user, logDetails);
    res.status(500).json({ message: 'Server error during the deletion process. Please check server logs.' });
  } finally {
    session.endSession();
  }
};

// Get purchase history for specific item
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
      'items.$': 1 
    }).sort({ date: -1 }).limit(50); 

    const formattedPurchases = purchases.map(purchase => {
      const itemData = purchase.items[0]; 
      
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
                      (1 + (itemData?.gstRate || 0) / 100)
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

// New controller function for restock summary
exports.getRestockSummary = async (req, res) => {
  const user = req.user || null;
  const lowGlobalThreshold = parseInt(req.query.lowGlobalThreshold, 10) || 3;

  try {
    logger.debug('item', "Fetching restock summary", user);
    const itemsActuallyNeedingRestock = await Item.find({
      $or: [
        { needsRestock: true },
        { quantity: { $lte: 0 } }
      ]
    }).select('name lowStockThreshold quantity needsRestock'); 
    const restockNeededCount = itemsActuallyNeedingRestock.length;

    const lowStockWarningCount = await Item.countDocuments({
      quantity: { $lt: lowGlobalThreshold }
    });

    res.json({
      restockNeededCount: restockNeededCount, 
      lowStockWarningCount: lowStockWarningCount,
      items: itemsActuallyNeedingRestock 
    });
  } catch (error) {
    logger.error('item', "Error fetching restock summary", error, user, { lowGlobalThreshold });
    res.status(500).json({ message: 'Server error while fetching restock summary' });
  }
};
