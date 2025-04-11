const mongoose = require('mongoose');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');
const connectDB = require('./db');
const Item = require('./models/itemlist');

const importItemsFromExcel = async () => {
  try {
    await connectDB();
    console.log('✅ MongoDB connected');

    const filePath = path.resolve(__dirname, 'itemlist.xlsx');
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    // Convert the sheet to an array of objects with header row
    const rawData = xlsx.utils.sheet_to_json(sheet, { 
      defval: '',  // Default value for empty cells
      header: 1    // Use 1-indexed array format to access all rows including headers
    });
    
    console.log('Raw data first few rows:', rawData.slice(0, 5));
    
    const itemsToInsert = [];
    let currentCategory = 'Other'; // Default category
    let currentSubcategory = 'General'; // Default subcategory
    const headers = rawData[1]; // Row 2 (index 1) contains the header names
    
    // Find the indices of columns we need
    const srIndex = headers.findIndex(h => h === 'Sr');
    const descIndex = headers.findIndex(h => h === 'Description');
    const unitIndex = headers.findIndex(h => h === 'Unit');
    const priceIndex = headers.findIndex(h => h === 'Unit Price');
    const hsnIndex = headers.findIndex(h => h === 'HSN Code');
    const qtyIndex = headers.findIndex(h => h === 'Qty');
    const imageIndex = headers.findIndex(h => h === 'Image'); // New index for image column
    
    // Create image upload directory if it doesn't exist
    const uploadDir = path.resolve(__dirname, 'public', 'uploads', 'items');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
      console.log(`Created upload directory at ${uploadDir}`);
    }
    
    // Map subcategories to their main categories based on your model's enum
    const categoryMap = {
      // Lightning Arrester subcategories
      'Lightning Arrester Conventional': 'Lightning Arrester',
      'Lightning Arrester - ESE - NFC17-102:2011': 'Lightning Arrester',
      
      // Earthing subcategories
      'EARTHING ROD - GI / CU / Copper Bonded Rod / Copper Bonded Electrode': 'Earthing',
      
      // Solar subcategories
      'Modul Cleaning System - Manual': 'Solar',
      
      // Other subcategories
      'Acccessories': 'Other',
      'BALANCE OF SYSTEM  (BOS Material)': 'Other',
      'Cable Tie': 'Other',
      'DWC Pipe': 'Other',
      'HDPE Pipe': 'Other',
      'MC4 Connector': 'Other',
      'Insulator': 'Solar',
      'Wire / Conductor': 'Other',
      'FLAT / STRIP': 'Other',
      'Chemical BAG': 'Other',
      'EARTH PIT COVER': 'Other',
    };
    
    // Function to process image from cell
    const processImageFromCell = async (cell, itemName) => {
      if (!cell || typeof cell !== 'object') return '';
      
      try {
        // If the cell contains an image
        if (cell.t === 'e' && cell.w === '#REF!' || cell.w === '#N/A') {
          return '';
        }
        
        // Check if there's an image in the cell
        if (cell.t === 'o' && cell.v && cell.v.image) {
          const imageData = cell.v.image;
          
          // Generate a safe filename
          const safeName = itemName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
          const fileName = `${safeName}_${Date.now()}.png`;
          const filePath = path.join(uploadDir, fileName);
          
          // Write image to file
          fs.writeFileSync(filePath, imageData, 'binary');
          console.log(`✅ Saved image for item "${itemName}" to ${fileName}`);
          
          return `/uploads/items/${fileName}`;
        }
      } catch (error) {
        console.error(`❌ Error processing image for item "${itemName}":`, error.message);
      }
      
      return '';
    };
    
    // Skip header rows and start from row 3 (index 2)
    for (let i = 2; i < rawData.length; i++) {
      const row = rawData[i];
      if (!row || row.length === 0) continue; // Skip empty rows
      
      const srValue = row[srIndex];
      const description = row[descIndex] ? row[descIndex].trim() : '';
      
      if (!description) continue; // Skip rows with empty descriptions
      
      // Check for main category header (starts with "category")
      if (description.toLowerCase().startsWith('category')) {
        const categoryName = description.replace(/^category\s+/i, '').trim();
        
        // Map the category name to one of the allowed enum values
        if (categoryName.toLowerCase() === 'la') {
          currentCategory = 'Lightning Arrester';
        } else if (['earthing', 'earth'].includes(categoryName.toLowerCase())) {
          currentCategory = 'Earthing';
        } else if (['solar', 'pv'].includes(categoryName.toLowerCase())) {
          currentCategory = 'Solar';
        } else {
          currentCategory = 'Other';
        }
        
        console.log(`📂 Found main category at row ${i+1}: ${currentCategory}`);
        continue;
      }
      
      // Check if this is a subcategory header row (has text in Description but no Sr value)
      if (description && (!srValue || srValue === '')) {
        // This row is likely a subcategory header
        currentSubcategory = description.trim();
        // Update the category based on our mapping if available
        if (categoryMap[currentSubcategory]) {
          currentCategory = categoryMap[currentSubcategory];
        }
        console.log(`🏷️ Found subcategory at row ${i+1}: ${currentSubcategory} (Category: ${currentCategory})`);
        continue;
      }
      
      // If we have Sr and Description, this is an item row
      if (srValue && description) {
        const name = description.trim();
        const unit = row[unitIndex] ? String(row[unitIndex]).trim() : 'Nos';
        const price = parseFloat(row[priceIndex]) || 0;
        const hsnCode = row[hsnIndex] ? String(row[hsnIndex]).replace(/[^0-9]/g, '') : '';
        const quantity = parseFloat(row[qtyIndex]) || 0;
        
        // Process image if available in the image column
        let imageUrl = '';
        if (imageIndex !== -1) {
          // If the image is present in the Excel cell
          const imageCell = sheet[xlsx.utils.encode_cell({r: i, c: imageIndex})];
          imageUrl = await processImageFromCell(imageCell, name);
        }
        
        // Debug output
        console.log(`Row ${i+1}: Name=${name}, Unit=${unit}, Price=${price}, HSN=${hsnCode}, Qty=${quantity}, Category=${currentCategory}, Subcategory=${currentSubcategory}, Image=${imageUrl ? 'Yes' : 'No'}`);
        
        if (!name || price === 0) {
          console.warn(`⚠️ Skipped row ${i+1}: Missing required fields (name=${name}, price=${price}).`);
          continue;
        }
        
        // Make sure unit is one of the allowed enum values
        let validUnit = unit;
        if (!['Nos', 'Mtr', 'PKT', 'Pair', 'Set', 'Bottle', 'KG'].includes(unit)) {
          console.warn(`⚠️ Invalid unit ${unit} for ${name}, defaulting to "Nos"`);
          validUnit = 'Nos';
        }
        
        itemsToInsert.push({
          name,
          unit: validUnit,
          price,
          hsnCode,
          quantity,
          category: currentCategory, // Using the mapped category from our enum
          subcategory: currentSubcategory,
          gstRate: 0,
          discountAvailable: false,
          dynamicPricing: false,
          image: imageUrl, // Add the image URL
          purchaseHistory: []
        });
      }
    }

    if (itemsToInsert.length === 0) {
      console.log('❌ No valid items to insert.');
      process.exit(0);
    }

    console.log(`🔄 Attempting to insert ${itemsToInsert.length} items...`);
    const result = await Item.insertMany(itemsToInsert);
    console.log(`✅ Successfully imported ${result.length} items.`);
    process.exit();
  } catch (error) {
    console.error('❌ Error importing items:', error.message);
    if (error.errors) {
      for (const field in error.errors) {
        console.error(`  - ${field}: ${error.errors[field].message}`);
      }
    }
    process.exit(1);
  }
};

importItemsFromExcel();