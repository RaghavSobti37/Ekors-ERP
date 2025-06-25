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
            const name = row.getCell('B').value; // Name from column B
            const quantity = row.getCell('C').value; // Quantity from column C
            const baseUnit = row.getCell('D').value; // Base Unit from column D
            const sellingPriceBaseUnit = row.getCell('E').value; // Selling Price (per Base Unit) from column E
            const buyingPriceBaseUnit = row.getCell('F').value; // Buying Price (per Base Unit) from column F
            const meterConversionFactor = row.getCell('G').value; // Meter Conversion Factor from column G
            // Columns H and I (Selling Price per Meter, Buying Price per Meter) are derived, not directly imported for item master
            const hsnCode = row.getCell('J').value; // HSN Code from column J
            const gstRate = row.getCell('K').value; // GST Rate from column K
            const maxDiscountPercentage = row.getCell('L').value; // Max Discount % from column L
            const lowStockThreshold = row.getCell('M').value; // Low Stock Threshold from column M

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
                             pricing: {
                    baseUnit: String(baseUnit || 'Nos').trim(),
                    sellingPrice: parseFloat(sellingPriceBaseUnit) || 0,
                    buyingPrice: parseFloat(buyingPriceBaseUnit) || 0,
                },
                units: [
                    { name: String(baseUnit || 'Nos').trim(), isBaseUnit: true, conversionFactor: 1 }
                ],

                category: currentCategory,  // Use currentCategory for items
                hsnCode: String(hsnCode || '').trim(),
                gstRate: parseFloat(gstRate) || 0,
                maxDiscountPercentage: parseFloat(maxDiscountPercentage) || 0,
                lowStockThreshold: parseInt(lowStockThreshold, 10) || 5,
                image: imageMap.get(rowNumber) || '', // Retrieve image from the map
            };

            
            // Add Meter unit if conversion factor is provided and valid
            if (meterConversionFactor !== null && meterConversionFactor !== undefined && parseFloat(meterConversionFactor) > 0) {
                item.units.push({
                    name: "Mtr",
                    isBaseUnit: false,
                    conversionFactor: parseFloat(meterConversionFactor)
                });
            }



            // Further validations
            if (isNaN(item.pricing.sellingPrice)) {

                parsingErrors.push({
                    row: rowNumber,
                    message: `Skipped: Invalid Selling Price for item "${item.name}" in row ${rowNumber}. Value: ${sellingPriceBaseUnit}.`,
                });
                return;
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
