const xlsx = require('xlsx');
const logger = require('./logger'); // Assuming you have a logger utility

async function parseExcelBufferForUpdate(fileBuffer) {
  const itemsToUpsert = [];
  const parsingErrors = [];

  try {
    const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    const rawData = xlsx.utils.sheet_to_json(sheet, { defval: '' });

    const validUnits = ['Nos', 'Mtr', 'PKT', 'Pair', 'Set', 'Bottle', 'KG'];

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      const rowNum = i + 2; // For user-friendly error reporting

      // Normalize keys for consistent access
      const normalizedRow = {};
      for (const key in row) {
        normalizedRow[key.toLowerCase().replace(/\s+/g, '')] = row[key];
      }

      const name = String(normalizedRow['name'] || '').trim();
      const quantity = parseFloat(normalizedRow['quantity'] || 0);
      const sellingPrice = parseFloat(normalizedRow['sellingprice'] || normalizedRow['price'] || 0);
      const buyingPrice = parseFloat(normalizedRow['buyingprice'] || 0);
      let unit = String(normalizedRow['unit'] || 'Nos').trim();
      const category = String(normalizedRow['category'] || 'Other').trim();
      const subcategory = String(normalizedRow['subcategory'] || 'General').trim();
      const hsnCode = String(normalizedRow['hsncode'] || '').trim();
      const gstRate = parseFloat(normalizedRow['gstrate'] || 0);
      const maxDiscountPercentage = parseFloat(normalizedRow['maxdiscountpercentage'] || 0);
      const lowStockThreshold = parseInt(normalizedRow['lowstockthreshold'] || 5, 10);

      if (!name) {
        parsingErrors.push({ row: rowNum, message: `Skipped: Item name is missing.` });
        continue;
      }

      if (isNaN(sellingPrice)) {
        parsingErrors.push({
          row: rowNum,
          message: `Skipped: Invalid Selling Price for item "${name}". Value found: ${normalizedRow['sellingprice'] || normalizedRow['price']}`,
        });
        continue;
      }

      if (isNaN(quantity)) {
        parsingErrors.push({
          row: rowNum,
          message: `Warning: Invalid quantity for item "${name}". Quantity found: ${normalizedRow['quantity']}. Using 0.`,
        });
      }

      if (!validUnits.includes(unit)) {
        parsingErrors.push({
          row: rowNum,
          message: `Warning: Invalid unit "${unit}" for item "${name}". Defaulting to "Nos".`,
        });
        unit = 'Nos';
      }

      itemsToUpsert.push({
        name,
        quantity: isNaN(quantity) ? 0 : quantity,
        sellingPrice,
        buyingPrice: isNaN(buyingPrice) ? 0 : buyingPrice,
        unit,
        category,
        subcategory,
        hsnCode,
        gstRate: isNaN(gstRate) ? 0 : gstRate,
        maxDiscountPercentage: isNaN(maxDiscountPercentage) ? 0 : maxDiscountPercentage,
        lowStockThreshold: isNaN(lowStockThreshold) ? 5 : lowStockThreshold,
        image: '', // Image processing not handled in this function
      });
    }

    return { itemsToUpsert, parsingErrors };
  } catch (error) {
    logger.error('excel_importer', `Error parsing Excel buffer: ${error.message}`, error);
    return {
      itemsToUpsert: [],
      parsingErrors: [{ row: 'general', message: `Fatal error parsing Excel: ${error.message}` }],
    };
  }
}

module.exports = { parseExcelBufferForUpdate };