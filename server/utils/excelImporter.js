const exceljs = require('exceljs');
const logger = require('./logger'); // Assuming you have a logger utility
// The number of custom units to look for during import.
// This should be kept in sync with MAX_CUSTOM_UNITS_TO_EXPORT in the item controller.
const MAX_CUSTOM_UNITS_TO_IMPORT = 3;

async function parseExcelBufferForUpdate(fileBuffer) {
    const itemsToUpsert = [];
    const parsingErrors = [];

    try {
        const workbook = new exceljs.Workbook();
        await workbook.xlsx.load(fileBuffer);
        const worksheet = workbook.getWorksheet(1); // Assuming data is in the first sheet

        if (!worksheet) {
            parsingErrors.push({ row: 'general', message: "No worksheet found in the Excel file." });
            return { itemsToUpsert, parsingErrors };
        }


        let currentCategory = 'Other'; // Default category

        // Collect all images first to map them by row
        const imageMap = new Map();
        worksheet.getImages().forEach(image => {
            const row = image.range.tl.row + 1;  // 1-based row number            const imageId = image.imageId;
            const excelImage = workbook.getImage(imageId);
            if (excelImage) {
                const base64Image = `data:image/${excelImage.extension || "png"};base64,${excelImage.buffer.toString("base64")}`;
                imageMap.set(row, base64Image);
            }
        });

        // Iterate over rows, skipping the header row
          worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
            if (rowNumber === 1) return; // Skip the header row explicitly


            // Check if this row is a category header (merged cells in column A)
            const firstCell = row.getCell('A');
            if (firstCell.isMerged) {
                const categoryCellValue = firstCell.value;
                if (typeof categoryCellValue === 'string' && categoryCellValue.startsWith('Category:')) {
                    currentCategory = categoryCellValue.replace('Category: ', '').trim();
                    return; // Skip to next row, as this is just a category header
                }
            }

        const name = row.getCell('B').value;

            // If the name is missing, consider it an empty row and skip
            if (!name) {
                parsingErrors.push({ row: rowNumber, message: `Skipped: Item name is missing in row ${rowNumber}.` });
                return;
            }

            // Basic validation and type coercion, handling potential null or undefined values
            const item = {
                name: String(name).trim(),

                quantity: parseFloat(row.getCell('C').value) || 0,
                hsnCode: String(row.getCell('D').value || '').trim(),
                gstRate: parseFloat(row.getCell('E').value) || 0,
                maxDiscountPercentage: parseFloat(row.getCell('F').value) || 0,
                lowStockThreshold: parseInt(row.getCell('G').value, 10) || 5,
                baseUnit: String(row.getCell('H').value || 'Nos').trim(),
                sellingPriceBaseUnit: parseFloat(row.getCell('I').value) || 0,
                buyingPriceBaseUnit: parseFloat(row.getCell('J').value) || 0,
                category: currentCategory,
                image: imageMap.get(rowNumber) || '',

            };

            
            // Read custom units dynamically. Column L is 12.
            for (let i = 0; i < MAX_CUSTOM_UNITS_TO_IMPORT; i++) {
                const unitNameCol = 12 + (i * 2);
                const conversionFactorCol = 13 + (i * 2);

                const unitName = row.getCell(unitNameCol).value;
                const conversionFactor = row.getCell(conversionFactorCol).value;

                if (unitName && (conversionFactor !== null && conversionFactor !== undefined)) {
                    item[`customUnit${i + 1}Name`] = String(unitName).trim();
                    item[`customUnit${i + 1}ConversionFactor`] = parseFloat(conversionFactor);
                }
            }



            // Further validations
              if (isNaN(item.sellingPriceBaseUnit)) {


                parsingErrors.push({
                    row: rowNumber,
 message: `Skipped: Invalid Selling Price for item "${item.name}" in row ${rowNumber}. Value: ${row.getCell('I').value}.`,
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
            parsingErrors: [{ row: 'general', message: `Fatal error during Excel parsing: ${error.message}` }],
        };
    }
}

module.exports = { parseExcelBufferForUpdate };
