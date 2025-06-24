const exceljs = require('exceljs');
const logger = require('./logger'); // Assuming you have a logger utility

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

        const validUnits = ['Nos', 'Mtr', 'PKT', 'Pair', 'Set', 'Bottle', 'KG'];
        let currentCategory = 'Other'; // Default category

        // Collect all images first to map them by row
        const imageMap = new Map();
        worksheet.getImages().forEach(image => {
            const { tl } = image.range; // tl: top-left cell
            const row = tl.row + 1;  // 1-based row number
            const imageId = image.imageId;
            const excelImage = workbook.getImage(imageId);
            if (excelImage) {
                const base64Image = `data:image/${excelImage.extension || "png"};base64,${excelImage.buffer.toString("base64")}`;
                imageMap.set(row, base64Image);
            }
        });

        // Iterate over rows, skipping the header row
        worksheet.eachRow({ skipHeader: true }, (row, rowNumber) => {
            if (rowNumber === 1) return; // Skip the header row explicitly

            const category = row.getCell('A').value; // Category from column A
            const name = row.getCell('B').value;       // Name from column B
            const quantity = row.getCell('C').value;   // Quantity from column C
            const sellingPrice = row.getCell('D').value; // Selling Price from column D
            const buyingPrice = row.getCell('E').value;  // Buying Price from column E
            const unit = row.getCell('F').value;        // Unit from column F
            const hsnCode = row.getCell('G').value;     // HSN Code from column G
            const gstRate = row.getCell('H').value;      // GST Rate from column H
            const maxDiscountPercentage = row.getCell('I').value; // Max Discount % from column I
            const lowStockThreshold = row.getCell('J').value; // Low Stock Threshold from column J

            // Check if this row is a category header (merged cells in column A)
            const firstCell = row.getCell('A');
            if (firstCell.isMerged) {
                const categoryCellValue = firstCell.value;
                if (typeof categoryCellValue === 'string' && categoryCellValue.startsWith('Category:')) {
                    currentCategory = categoryCellValue.replace('Category: ', '').trim();
                    return; // Skip to next row, as this is just a category header
                }
            }

            // If the name is missing, consider it an empty row and skip
            if (!name) {
                parsingErrors.push({ row: rowNumber, message: `Skipped: Item name is missing in row ${rowNumber}.` });
                return;
            }

            // Basic validation and type coercion, handling potential null or undefined values
            const item = {
                name: String(name).trim(),
                quantity: parseFloat(quantity) || 0,
                sellingPrice: parseFloat(sellingPrice) || 0,
                buyingPrice: parseFloat(buyingPrice) || 0,
                unit: String(unit || 'Nos').trim(),
                category: currentCategory,  // Use currentCategory for items
                hsnCode: String(hsnCode || '').trim(),
                gstRate: parseFloat(gstRate) || 0,
                maxDiscountPercentage: parseFloat(maxDiscountPercentage) || 0,
                lowStockThreshold: parseInt(lowStockThreshold, 10) || 5,
                image: imageMap.get(rowNumber) || '', // Retrieve image from the map
            };

            // Further validations
            if (isNaN(item.sellingPrice)) {
                parsingErrors.push({
                    row: rowNumber,
                    message: `Skipped: Invalid Selling Price for item "${item.name}" in row ${rowNumber}. Value: ${sellingPrice}.`,
                });
                return;
            }

            if (!validUnits.includes(item.unit)) {
                parsingErrors.push({
                    row: rowNumber,
                    message: `Warning: Invalid unit "${item.unit}" for item "${item.name}" in row ${rowNumber}. Defaulting to "Nos".`,
                });
                item.unit = 'Nos';
            }

            // Add the processed item to the list
            itemsToUpsert.push(item);
        });

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
