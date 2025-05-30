const { Item, Purchase } = require('../models/itemlist');
const ItemBackup = require('../models/itemBackup'); // Import backup model
const mongoose = require('mongoose');
const logger = require('../utils/logger'); // Import logger
// const { parseExcelDataForUpdate } = require('../utils/excelImporter'); // Old utility
const { parseExcelBufferForUpdate } = require('../utils/excelImporter'); // New utility for uploaded files
const path = require('path');
const multer = require('multer');
const xlsx = require('xlsx'); // For export

const debug = (message, data = null) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEBUG] ${message}`, data);
  }
};

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
    debug("Error fetching items", error);
    console.error('Error fetching items:', error);
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
      'Price': item.price,
      'Unit': item.unit,
      'Category': item.category,
      'Subcategory': item.subcategory,
      'HSN Code': item.hsnCode,
      'GST Rate': item.gstRate,
      'Max Discount Percentage': item.maxDiscountPercentage,
      // 'Image': item.image, // Not including image in this export as per simplified flow
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
        parsingErrors,
      });
    }

    // Re-use the upsert logic from the previous Excel import function
    // const { itemsCreated, itemsUpdated, itemsDeleted, operationResults, databaseProcessingErrors } = await processUpsert(itemsToUpsert, user, 'excel_upload_import'); // Old call

    const { itemsCreated, itemsUpdated, itemsDeleted, operationResults, databaseProcessingErrors } = await syncItemsWithDatabase(itemsToUpsert, user, 'excel_upload_import');

    logger.info('excel_upload_import', 'API: Excel import from upload process completed', { itemsCreated, itemsUpdated, errors: databaseProcessingErrors.length, userId: user?._id });
    res.status(200).json({ message: 'Uploaded Excel data processed.', itemsCreated, itemsUpdated, parsingErrors, databaseProcessingDetails: operationResults, databaseProcessingErrors });

  } catch (error) {
    if (error instanceof multer.MulterError) {
        logger.error('excel_upload_import', 'API: Multer error during file upload', { error: error.message, stack: error.stack, userId: user?._id });
        return res.status(400).json({ message: `File upload error: ${error.message}` });
    }
    logger.error('excel_upload_import', 'API: Unhandled error during Excel import from upload', { error: error.message, stack: error.stack, userId: user?._id });
    res.status(500).json({ message: 'Server error during Excel processing.', error: error.message });
  }
};

async function syncItemsWithDatabase(excelItems, user, logContextPrefix) {
  let itemsCreated = 0;
  let itemsUpdated = 0;
  let itemsDeleted = 0;
  const operationResults = []; // This will store summary of bulk operations
  const databaseProcessingErrors = [];
  
  // For Item collection: inserts and updates
  const itemUpsertOps = []; 
  // For ItemBackup collection: inserts
  const backupInsertOps = [];
  // For Item collection: deletes (only if backup is successful or not errored out)
  const itemDeleteOps = [];

  const userId = user?._id || null; // For backup record

  try {
    logger.info(logContextPrefix, 'Starting database sync with Excel data.', user, { itemCountExcel: excelItems.length });

    // 1. Fetch all existing items from DB
    const existingDbItems = await Item.find().lean(); // .lean() for performance
    const dbItemsMap = new Map(existingDbItems.map(item => [item.name.toLowerCase(), item])); // For quick lookup by name
    const excelItemNamesLowerCase = new Set(excelItems.map(item => item.name.toLowerCase())); // For quick check of items in Excel

    logger.debug(logContextPrefix, `Fetched ${existingDbItems.length} existing items from DB.`, user);

    // 2. Process Excel items: Identify items to create or update
    for (const excelItemData of excelItems) {
      const normalizedExcelItemName = excelItemData.name.toLowerCase();
      const existingItem = dbItemsMap.get(normalizedExcelItemName);

      // Construct payload, ensuring all relevant fields from Item schema are considered
      const payload = {
        name: excelItemData.name, // Preserve original casing from Excel for name
        quantity: excelItemData.quantity || 0,
        price: excelItemData.price || 0,
        unit: excelItemData.unit || 'Nos',
        category: excelItemData.category || 'Other',
        subcategory: excelItemData.subcategory || 'General',
        gstRate: excelItemData.gstRate || 0,
        hsnCode: excelItemData.hsnCode || '',
        maxDiscountPercentage: excelItemData.maxDiscountPercentage || 0,
        image: excelItemData.image || '', // Will be '' from parser
        // Preserve fields not typically in a simple Excel import, or set defaults
        discountAvailable: excelItemData.discountAvailable !== undefined ? excelItemData.discountAvailable : (existingItem?.discountAvailable || false),
        lastPurchaseDate: excelItemData.lastPurchaseDate || existingItem?.lastPurchaseDate || null,
        lastPurchasePrice: excelItemData.lastPurchasePrice || existingItem?.lastPurchasePrice || null,
      };

      if (existingItem) {
        // Item exists in DB, so update it
        if (payload.image === '' && existingItem.image) { // Preserve existing image
          payload.image = existingItem.image;
        }
        itemUpsertOps.push({
          updateOne: {
            filter: { _id: existingItem._id },
            update: { $set: payload },
          }
        });
        logger.debug(logContextPrefix, `Item "${excelItemData.name}" marked for UPDATE.`, user, { itemId: existingItem._id });
      } else {
        // Item does not exist in DB, so create it
        itemUpsertOps.push({
          insertOne: {
            document: payload
          }
        });
        logger.debug(logContextPrefix, `Item "${excelItemData.name}" marked for CREATE.`, user);
      }
    }

    // 3. Identify items to delete and prepare backups
    const itemsToBeDeletedFromDb = [];
    for (const dbItem of existingDbItems) {
      if (!excelItemNamesLowerCase.has(dbItem.name.toLowerCase())) {
        itemsToBeDeletedFromDb.push(dbItem);
      }
    }

    if (itemsToBeDeletedFromDb.length > 0) {
      logger.info(logContextPrefix, `${itemsToBeDeletedFromDb.length} items identified for DELETION. Preparing backups.`, user);
      for (const itemToDelete of itemsToBeDeletedFromDb) {
        const backupData = {
          ...itemToDelete, // Spread all fields from the item model
          originalId: itemToDelete._id,
          deletedBy: userId,
          deletedAt: new Date(),
          originalCreatedAt: itemToDelete.createdAt,
          originalUpdatedAt: itemToDelete.updatedAt,
          backupReason: "Deleted during Excel synchronization"
        };
        delete backupData._id; // Remove _id from backupData as ItemBackup will generate its own
        
        backupInsertOps.push({
            insertOne: {
                document: backupData
            }
        });
        // Initially, prepare all for deletion. We will filter out if backup fails.
        itemDeleteOps.push({
            deleteOne: {
                filter: { _id: itemToDelete._id }
            }
        });
        logger.debug(logContextPrefix, `Item "${itemToDelete.name}" (ID: ${itemToDelete._id}) marked for BACKUP and DELETION.`, user);
      }
    } else {
        logger.info(logContextPrefix, "No items from DB are marked for deletion (all DB items present in Excel or DB is empty).", user);
    }

    // 4. Execute backup operations first (if any)
    if (backupInsertOps.length > 0) {
        logger.info(logContextPrefix, `Attempting to bulk insert ${backupInsertOps.length} item backups.`, user);
        try {
            const backupResult = await ItemBackup.bulkWrite(backupInsertOps, { ordered: false });
            logger.info(logContextPrefix, `Item backups bulk operation completed. Inserted: ${backupResult.insertedCount}.`, user, { backupResult: { inserted: backupResult.insertedCount, errors: backupResult.hasWriteErrors() ? backupResult.getWriteErrors().length : 0 } });
            
            if (backupResult.hasWriteErrors()) {
                const writeErrors = backupResult.getWriteErrors();
                logger.warn(logContextPrefix, `${writeErrors.length} errors occurred during item backup. These items will not be deleted.`, user);
                writeErrors.forEach(err => {
                    const failedBackupOp = backupInsertOps[err.index]?.insertOne?.document;
                    const originalItemId = failedBackupOp?.originalId;
                    logger.error(logContextPrefix, `Backup failed for item (original name: ${failedBackupOp?.name}, original ID: ${originalItemId}). Original item will NOT be deleted.`, user, { error: err.errmsg, opDetails: failedBackupOp });
                    databaseProcessingErrors.push({ name: `Backup for ${failedBackupOp?.name || originalItemId}`, status: 'backup_error', message: err.errmsg });
                    
                    // Remove corresponding delete operation if backup failed for this specific item
                    const deleteOpIndex = itemDeleteOps.findIndex(op => op.deleteOne.filter._id.toString() === originalItemId.toString());
                    if (deleteOpIndex > -1) {
                        itemDeleteOps.splice(deleteOpIndex, 1);
                        logger.warn(logContextPrefix, `Removed item "${failedBackupOp?.name}" (ID: ${originalItemId}) from deletion queue due to backup failure.`, user);
                    }
                });
            }
        } catch (backupBulkError) {
            logger.error(logContextPrefix, 'CRITICAL error during ItemBackup.bulkWrite. ALL delete operations for this sync will be cancelled.', user, { error: backupBulkError.message, stack: backupBulkError.stack });
            databaseProcessingErrors.push({ name: 'Bulk Backup Operation', status: 'critical_error', message: `Backup bulkWrite failed: ${backupBulkError.message}. No items were deleted.` });
            itemDeleteOps.length = 0; // Clear ALL delete operations if the entire bulk backup call fails
            logger.warn(logContextPrefix, 'All item delete operations cancelled due to critical failure in bulk backup.', user);
        }
    }

    // 5. Execute Item Create/Update operations (if any)
    if (itemUpsertOps.length > 0) {
      logger.info(logContextPrefix, `Attempting to bulk create/update ${itemUpsertOps.length} items.`, user);
      const upsertResult = await Item.bulkWrite(itemUpsertOps, { ordered: false });
      itemsCreated = upsertResult.insertedCount || 0;
      itemsUpdated = upsertResult.modifiedCount || 0;
      
      logger.info(logContextPrefix, `Item create/update bulk operation completed. Created: ${itemsCreated}, Updated: ${itemsUpdated}.`, user, { upsertResult: { inserted: itemsCreated, modified: itemsUpdated, errors: upsertResult.hasWriteErrors() ? upsertResult.getWriteErrors().length : 0 } });
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
          logger.error(logContextPrefix, `DB Bulk Write Error during upsert: ${opDescription}`, user, { error: err.errmsg, op: err.op });
          databaseProcessingErrors.push({ name: opDescription, status: 'error', message: err.errmsg, details: err.op });
        });
      }
    } else {
      logger.info(logContextPrefix, 'No items to create or update from Excel.', user);
    }

    // 6. Execute Item Delete operations (if any and backups were successful or handled)
    if (itemDeleteOps.length > 0) {
        logger.info(logContextPrefix, `Attempting to bulk delete ${itemDeleteOps.length} items (whose backups were processed).`, user);
        const deleteResult = await Item.bulkWrite(itemDeleteOps, { ordered: false });
        itemsDeleted = deleteResult.deletedCount || 0;
        logger.info(logContextPrefix, `Item delete bulk operation completed. Deleted: ${itemsDeleted}.`, user, { deleteResult: { deleted: itemsDeleted, errors: deleteResult.hasWriteErrors() ? deleteResult.getWriteErrors().length : 0 } });
        operationResults.push({
            type: 'delete',
            deleted: itemsDeleted,
            hasErrors: deleteResult.hasWriteErrors(),
            errors: deleteResult.hasWriteErrors() ? deleteResult.getWriteErrors() : []
        });
        if (deleteResult.hasWriteErrors()) {
            deleteResult.getWriteErrors().forEach(err => {
                const opDescription = `Delete item (filter: ${JSON.stringify(itemDeleteOps[err.index]?.deleteOne?.filter)})`;
                logger.error(logContextPrefix, `DB Bulk Write Error during delete: ${opDescription}`, user, { error: err.errmsg, op: err.op });
                databaseProcessingErrors.push({ name: opDescription, status: 'error', message: err.errmsg, details: err.op });
            });
        }
    } else {
        logger.info(logContextPrefix, 'No items to delete, or all deletions were cancelled due to backup issues.', user);
    }
    
    logger.info(logContextPrefix, 'Database sync with Excel data finished.', user, { itemsCreated, itemsUpdated, itemsDeleted });

  } catch (error) {
    logger.error(logContextPrefix, `CRITICAL error during syncItemsWithDatabase: ${error.message}`, user, { error, stack: error.stack });
    databaseProcessingErrors.push({ name: 'General Sync Error', status: 'critical_error', message: error.message });
  }

  return { itemsCreated, itemsUpdated, itemsDeleted, operationResults, databaseProcessingErrors };
}

// Helper function for upsert logic, refactored from importItemsFromExcelViaAPI
/* // This function is now replaced by syncItemsWithDatabase for Excel import.
async function processUpsert(itemsToUpsert, user, logContextPrefix) { 
  let itemsCreated = 0;
  let itemsUpdated = 0;
  const operationResults = [];
  const databaseProcessingErrors = [];

  for (const itemData of itemsToUpsert) {
    try {
      const query = { name: itemData.name }; // Using name as the unique identifier
      
      const updatePayload = {
        name: itemData.name,
        quantity: itemData.quantity || 0,
        price: itemData.price || 0,
        unit: itemData.unit || 'Nos',
        category: itemData.category || 'Other',
        subcategory: itemData.subcategory || 'General',
        gstRate: itemData.gstRate || 0,
        hsnCode: itemData.hsnCode || '',
        maxDiscountPercentage: itemData.maxDiscountPercentage || 0,
        image: itemData.image || '', // Will be '' from parser
      };

      const existingItem = await Item.findOne(query);

      if (existingItem) {
        // Preserve existing image if Excel doesn't provide one (which it won't in this flow)
        if (updatePayload.image === '' && existingItem.image) {
          updatePayload.image = existingItem.image;
        }
        await Item.updateOne(query, { $set: updatePayload }, { runValidators: true });
        itemsUpdated++;
        operationResults.push({ name: itemData.name, status: 'updated', id: existingItem._id });
        logger.debug(logContextPrefix, `API: Item updated: ${itemData.name}`, { itemId: existingItem._id, userId: user?._id });
      } else {
        const newItem = new Item(updatePayload);
        await newItem.save();
        itemsCreated++;
        operationResults.push({ name: itemData.name, status: 'created', id: newItem._id });
        logger.debug(logContextPrefix, `API: Item created: ${itemData.name}`, { itemId: newItem._id, userId: user?._id });
      }
    } catch (dbError) {
      logger.error(logContextPrefix, `API: DB Error processing item: ${itemData.name}`, { error: dbError.message, itemData, userId: user?._id });
      databaseProcessingErrors.push({ name: itemData.name, status: 'error', message: dbError.message });
    }
  }
  return { itemsCreated, itemsUpdated, operationResults, databaseProcessingErrors };
}*/

// This function is for the old flow of reading itemlist.xlsx from server root.
// It can be removed if the new upload flow is the sole method.
exports.importItemsFromExcelViaAPI = async (req, res) => {
  const user = req.user || null;
  logger.info('excel_import_api', 'API: Starting Excel import process', { userId: user?._id });

  try {
    // Assuming itemlist.xlsx is in the root of the server directory
    const excelFilePath = path.resolve(__dirname, '..', 'itemlist.xlsx'); 
    logger.debug('excel_import_api', `Attempting to read Excel file from: ${excelFilePath}`, { userId: user?._id });

    if (!require('fs').existsSync(excelFilePath)) {
      logger.error('excel_import_api', 'Excel file not found at specified path.', { path: excelFilePath, userId: user?._id });
      return res.status(404).json({ message: 'Excel file (itemlist.xlsx) not found on server.' });
    }

    // This would need to use a parser that reads from a path, e.g. the original parseExcelDataForUpdate
    const { itemsToUpsert, parsingErrors } = await parseExcelBufferForUpdate(require('fs').readFileSync(excelFilePath)); // Example if using buffer parser

    if (parsingErrors && parsingErrors.length > 0) {
      logger.warn('excel_import_api', 'API: Errors/Warnings during Excel parsing', { parsingErrorsCount: parsingErrors.length, parsingErrors, userId: user?._id });
    }

    if (!itemsToUpsert || itemsToUpsert.length === 0) {
      logger.info('excel_import_api', 'API: No items found in Excel to process', { userId: user?._id });
      return res.status(200).json({
        message: 'No valid items found in Excel to process or file is empty.',
        itemsCreated: 0,
        itemsUpdated: 0,
        parsingErrors,
      });
    }

    // Use the refactored upsert logic
    // const { itemsCreated, itemsUpdated, itemsDeleted, operationResults, databaseProcessingErrors } = await processUpsert(itemsToUpsert, user, 'excel_import_api'); // Old call

    const { itemsCreated, itemsUpdated, itemsDeleted, operationResults, databaseProcessingErrors } = await syncItemsWithDatabase(itemsToUpsert, user, 'excel_import_api');

    logger.info('excel_import_api', 'API: Excel import process completed', { itemsCreated, itemsUpdated, errors: databaseProcessingErrors.length, userId: user?._id });
    res.status(200).json({ message: 'Excel data processed.', itemsCreated, itemsUpdated, parsingErrors, databaseProcessingDetails: operationResults, databaseProcessingErrors });

  } catch (error) {
    logger.error('excel_import_api', 'API: Unhandled error during Excel import process', { error: error.message, stack: error.stack, userId: user?._id });
    res.status(500).json({ message: 'Server error during Excel processing.', error: error.message });
  }
};

// Get item categories
exports.getCategories = async (req, res) => {
  const user = req.user || null;
    try {
    debug("Attempting to fetch categories");
    
    // Simplified approach to get unique categories and subcategories
    const items = await Item.find({}, 'category subcategory');
    
    // Create a map to track categories and their subcategories
    const categoriesMap = new Map();
    
    items.forEach(item => {
      const category = item.category || 'Other'; // Handle null/undefined categories
      
      if (!categoriesMap.has(category)) {
        categoriesMap.set(category, new Set());
      }
      
      if (item.subcategory) {
        categoriesMap.get(category).add(item.subcategory);
      } else {
        categoriesMap.get(category).add('General');
      }
    });
    
    // Convert map to array format suitable for frontend
    const categories = Array.from(categoriesMap).map(([category, subcategories]) => ({
      category,
      subcategories: Array.from(subcategories)
    }));
    
    logger.debug('item', "Categories fetched successfully", user, categories);
    res.json(categories);
    
  } catch (error) {
    debug("Categories fetch failed", error);
    console.error("Error in getCategories:", error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching categories',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

  
exports.getItemById = async (req, res) => {
  const { id } = req.params;
  const user = req.user || null;

  // Check if id is a valid ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid item ID format' });
  }

  try {
    const item = await Item.findById(id);
    // logger.debug('item', `Fetched item by ID: ${id}`, user); // Debug level
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }
    logger.info('item', `Fetched item by ID: ${id}`, user, { itemId: id, itemName: item.name });
    res.json(item);
  } catch (error) {
    console.error('Error fetching item details:', error);
    res.status(500).json({ message: 'Server error while fetching item' });
  }
};

// Create new item
exports.createItem = async (req, res) => {
  try {
    const user = req.user || null;
    const newItem = new Item({
      name: req.body.name,
      quantity: req.body.quantity || 0,
      price: req.body.price || 0,
      gstRate: req.body.gstRate || 0,
      hsnCode: req.body.hsnCode || '',
      unit: req.body.unit || 'Nos',
      category: req.body.category || 'Other',
      subcategory: req.body.subcategory || 'General',
      maxDiscountPercentage: req.body.maxDiscountPercentage ? parseFloat(req.body.maxDiscountPercentage) : 0
    });

    const savedItem = await newItem.save();
    logger.info('item', `Item created successfully`, user, { itemId: savedItem._id, itemName: savedItem.name });
    res.status(201).json(savedItem);
  } catch (error) {
    console.error('Error creating item:', error);
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
          price: req.body.price || 0,
          gstRate: req.body.gstRate || 0,
          hsnCode: req.body.hsnCode || '',
          unit: req.body.unit || 'Nos',
          category: req.body.category || 'Other',
          subcategory: req.body.subcategory || 'General',
          maxDiscountPercentage: req.body.maxDiscountPercentage ? parseFloat(req.body.maxDiscountPercentage) : 0
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
    console.error('Error updating item:', error);
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
  const user = req.user || null;
  const session = await mongoose.startSession();
  const logDetails = { userId, itemId, model: 'Item', operation: 'delete', sessionId: session.id };

  logger.info('delete', `[DELETE_INITIATED] Item ID: ${itemId}. Transaction started.`, user, logDetails);

  try {
    session.startTransaction();
    logger.debug('delete', `[FETCH_ATTEMPT] Finding Item ID: ${itemId} for backup and deletion within transaction.`, user, logDetails);
    const itemToBackup = await Item.findById(itemId).session(session);
    
    if (!itemToBackup) {
      await session.abortTransaction(); // Ensure transaction is aborted on not found
      session.endSession();
      logger.warn(`[NOT_FOUND] Item not found for deletion. Transaction aborted.`, logDetails);
      return res.status(404).json({ message: 'Item not found' });
    }
    logger.debug(`[FETCH_SUCCESS] Found Item ID: ${itemId}. Preparing for backup within transaction.`, logDetails);

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
    await newBackupEntry.save({ session }); // Save backup within the transaction
    logger.info('delete', `[BACKUP_SUCCESS] Item successfully backed up. Backup ID: ${newBackupEntry._id}.`, user, { ...logDetails, originalId: itemToBackup._id, backupId: newBackupEntry._id, backupModel: 'ItemBackup' });

    logger.debug('delete', `[PRE_ORIGINAL_DELETE] Attempting to delete original Item ID: ${itemToBackup._id} within transaction.`, user, { ...logDetails, originalId: itemToBackup._id });
    await Item.findByIdAndDelete(itemId, { session });
    logger.info('delete', `[ORIGINAL_DELETE_SUCCESS] Original Item successfully deleted.`, user, { ...logDetails, originalId: itemToBackup._id });

    // Update any purchase records that reference this item
    // This part remains, ensuring data integrity for purchases
    logger.debug(`[UPDATE_PURCHASES_ATTEMPT] Updating Purchase records referencing deleted Item ID: ${itemId} within transaction.`, { ...logDetails, targetModel: 'Purchase' });
    await Purchase.updateMany(
      { 'items.itemId': itemId },
      { $set: { 'items.$.itemId': null } }
    ).session(session); // Ensure this is also in the transaction
    logger.info(`[UPDATE_PURCHASES_SUCCESS] Purchase records updated for Item ID: ${itemId}.`, { ...logDetails, targetModel: 'Purchase' });

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
    logger.error(`[DELETE_ERROR] Error during Item deletion process for ID: ${itemId}.`, error, logDetails);
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
    
    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid item ID format' });
    }

    // First check if item exists
    const itemExists = await Item.exists({ _id: id });
    if (!itemExists) {
      logger.warn('item', `Item not found when fetching purchase history: ${id}`, user);
      return res.status(404).json({ message: 'Item not found' });
    }

    // Get purchases where this item is referenced - with projection for better performance
    const purchases = await Purchase.find({ 
      'items.itemId': new mongoose.Types.ObjectId(id) 
    }, {
      date: 1,
      companyName: 1,
      gstNumber: 1,
      invoiceNumber: 1,
      'items.$': 1 // MongoDB positional operator to get only matching items
    }).sort({ date: -1 }).limit(50); // Add limit for performance

    // logger.debug('item', `Fetched purchase history for item ID: ${id}`, user, { purchaseCount: purchases.length }); // Debug level
    // Format response
    const formattedPurchases = purchases.map(purchase => {
      const itemData = purchase.items[0]; // Using the positional projection above
      
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
    logger.error('item', `Failed to fetch purchase history for item ID: ${id}`, error, user);
    console.error('Error fetching purchase history:', error);
    res.status(500).json({ 
      message: 'Server error while fetching purchase history',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// New controller function for restock summary
exports.getRestockSummary = async (req, res) => {
  const user = req.user || null;
  try {
    logger.debug('item', "Fetching restock summary", user);
    const itemsToRestock = await Item.find({ needsRestock: true }).select('name restockAmount lowStockThreshold quantity');
    res.json({
      count: itemsToRestock.length,
      items: itemsToRestock // Sending items might be useful for a detailed view later
    });
  } catch (error) {
    logger.error('item', "Error fetching restock summary", error, user);
    res.status(500).json({ message: 'Server error while fetching restock summary' });
  }
};