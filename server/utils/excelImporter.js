const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');
const logger = require('./logger'); // Assuming you have a logger utility
async function parseExcelBufferForUpdate(fileBuffer) {
  const itemsToUpsert = [];
  const parsingErrors = [];
  try {
    const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    const rawData = xlsx.utils.sheet_to_json(sheet, {
      defval: '',
      // header: 1, // Not needed if first row is actual headers for sheet_to_json
    });

    const validUnits = ['Nos', 'Mtr', 'PKT', 'Pair', 'Set', 'Bottle', 'KG'];

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      const rowNum = i + 2; // For user-friendly error reporting (1 for header, 1 for 0-index)

      // Normalize header names (e.g., "Unit Price" to "price")
      // Assumes headers in Excel match these keys or their lowercase versions.
      const name = String(row['Name'] || row['name'] || '').trim();
      const quantity = parseFloat(row['Quantity'] || row['quantity'] || 0);
      const price = parseFloat(row['Price'] || row['price'] || 0);
      let unit = String(row['Unit'] || row['unit'] || 'Nos').trim();
      const category = String(row['Category'] || row['category'] || 'Other').trim();
      const subcategory = String(row['Subcategory'] || row['subcategory'] || 'General').trim();
      const hsnCode = String(row['HSN Code'] || row['hsnCode'] || '').trim();
      const gstRate = parseFloat(row['GST Rate'] || row['gstRate'] || 0);
      const maxDiscountPercentage = parseFloat(row['Max Discount Percentage'] || row['maxDiscountPercentage'] || 0);
      // const image = String(row['Image'] || row['image'] || '').trim(); // User said no images for this flow

      if (!name) {
        parsingErrors.push({ row: rowNum, message: `Skipped: Item name is missing.` });
        continue;
      }
      if (isNaN(price)) {
        parsingErrors.push({ row: rowNum, message: `Skipped: Invalid price for item "${name}". Price found: ${row['Price'] || row['price']}` });
        continue;
      }
      if (isNaN(quantity)) {
        parsingErrors.push({ row: rowNum, message: `Warning: Invalid quantity for item "${name}". Quantity found: ${row['Quantity'] || row['quantity']}. Using 0.` });
        // quantity will be NaN from parseFloat if invalid, or default 0. DB schema should handle.
      }

      if (!validUnits.includes(unit)) {
        parsingErrors.push({ row: rowNum, message: `Warning: Invalid unit "${unit}" for item "${name}". Defaulting to "Nos".` });
        unit = 'Nos';
      }

      itemsToUpsert.push({
        name,
        quantity: isNaN(quantity) ? 0 : quantity, // Ensure quantity is a number
        price,
        unit,
        category,
        subcategory,
        hsnCode,
        gstRate: isNaN(gstRate) ? 0 : gstRate,
        maxDiscountPercentage: isNaN(maxDiscountPercentage) ? 0 : maxDiscountPercentage,
        image: '', // No image processing in this flow
      });
    }
    return { itemsToUpsert, parsingErrors };
  } catch (error) {
    logger.error('excel_importer', `Error parsing Excel buffer: ${error.message}`, error);
    return { itemsToUpsert: [], parsingErrors: [{ row: 'general', message: `Fatal error parsing Excel: ${error.message}` }] };
  }
}

module.exports = { parseExcelBufferForUpdate };