const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { Item } = require('./models/itemlist'); // Adjust path as needed to your Item model

dotenv.config(); 

const conversionData = [
  { name: "ALUMINIUM STRIP 25X3", oldUnit: "Mtr", weightOfOneMeter: 0.2025, kgRate: 290, perMeterRate: 58 },
  { name: "COPPER BONDED STRIP 25X3", oldUnit: "Mtr", weightOfOneMeter: 0.66975, kgRate: 925, perMeterRate: 619.75 },
  { name: "COPPER BONDED STRIP 25X6", oldUnit: "Mtr", weightOfOneMeter: 1.3395, kgRate: 925, perMeterRate: 1239.5 },
  { name: "COPPER STRIP 20X3", oldUnit: "Mtr", weightOfOneMeter: 0.5358, kgRate: 925, perMeterRate: 499.5 },
  { name: "Copper Strip 25x5", oldUnit: "Mtr", weightOfOneMeter: 1.11625, kgRate: 925, perMeterRate: 1036 },
  { name: "COPPER STRIP 25X6", oldUnit: "Mtr", weightOfOneMeter: 1.3395, kgRate: 925, perMeterRate: 1239.5 },
  { name: "COPPER STRIP 50*6", oldUnit: "Mtr", weightOfOneMeter: 2.679, kgRate: 925, perMeterRate: 2479 },
  { name: "Copper Strip 50x5", oldUnit: "Mtr", weightOfOneMeter: 2.2325, kgRate: 925, perMeterRate: 2072 },
  { name: "Cu Strip 25 X 3 MM", oldUnit: "Mtr", weightOfOneMeter: 0.66975, kgRate: 925, perMeterRate: 619.75 },
  { name: "Cu Strip 50 X 6 MM", oldUnit: "Mtr", weightOfOneMeter: 2.679, kgRate: 925, perMeterRate: 2479 },
  { name: "GI 50-6 Strip", oldUnit: "Mtr", weightOfOneMeter: 2.4, kgRate: 76, perMeterRate: 182.4 },
  { name: "GI Strip 20x3 Mm", oldUnit: "Mtr", weightOfOneMeter: 0.48, kgRate: 76, perMeterRate: 36.48 },
  { name: "GI Strip 25 X 3 mm", oldUnit: "Mtr", weightOfOneMeter: 0.6, kgRate: 76, perMeterRate: 45.6 },
  { name: "GI Strip 25 X 5 mm", oldUnit: "Mtr", weightOfOneMeter: 1, kgRate: 76, perMeterRate: 76 },
  { name: "GI Strip 25 X 6 mm", oldUnit: "Mtr", weightOfOneMeter: 1.2, kgRate: 76, perMeterRate: 91.2 },
  { name: "GI STRIP 32X6", oldUnit: "Mtr", weightOfOneMeter: 1.536, kgRate: 76, perMeterRate: 117.04 },
  { name: "GI STRIP 50X3 E", oldUnit: "Mtr", weightOfOneMeter: 1.2, kgRate: 76, perMeterRate: 91.2 },
  { name: "Gi Strip 75x10", oldUnit: "Mtr", weightOfOneMeter: 6, kgRate: 76, perMeterRate: 456 },
  { name: "HDGI Strip 25x3mm", oldUnit: "Mtr", weightOfOneMeter: 0.6, kgRate: 76, perMeterRate: 45.6 },
  // HDG Strip has no specific conversion data in your provided list, will be handled by default Mtr case
];

// Create a map for quick lookup by item name (case-insensitive)
const conversionMap = new Map(conversionData.map(item => [item.name.toLowerCase(), item]));

async function migrateItems() {
  console.log('Starting item data migration...');
  let migratedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Successfully connected to MongoDB.');

    // Fetch all items. Using .lean() to get plain JavaScript objects for easier manipulation
    // and to access fields that might have been removed from the Mongoose schema definition.
    const items = await Item.find({}).lean();
    console.log(`Found ${items.length} items to process.`);

    for (const item of items) {
      // Skip if the item already has the new 'pricing' and 'units' structure
      // This prevents re-migrating already migrated items.
      if (item.pricing && item.units && item.pricing.baseUnit) {
        skippedCount++;
        continue;
      }

      try {
        // Access old fields directly from the lean document.
        // Provide default values to prevent errors if fields are missing.
        const oldUnit = item.unit || "Nos"; // Default to "Nos" if old unit is undefined
        const oldSellingPrice = typeof item.sellingPrice === 'number' ? item.sellingPrice : 0;
        const oldBuyingPrice = typeof item.buyingPrice === 'number' ? item.buyingPrice : 0;

        let newPricing = {};
        let newUnits = [];

        const itemNameLower = item.name ? item.name.toLowerCase() : '';
        const conversionEntry = conversionMap.get(itemNameLower);

        // Logic for 'Mtr' items
        if (oldUnit.toLowerCase() === 'mtr') {
          if (conversionEntry) {
            // Case 1: Mtr item found in specific conversion data
            const weightOfOneMeter = conversionEntry.weightOfOneMeter;
            const kgRate = conversionEntry.kgRate; // This is the selling price per KG from your chart

            let buyingPricePerKg = 0;
            if (typeof oldBuyingPrice === 'number' && oldBuyingPrice > 0 && weightOfOneMeter > 0) {
                buyingPricePerKg = oldBuyingPrice / weightOfOneMeter;
            } else if (typeof kgRate === 'number' && kgRate > 0) {
                buyingPricePerKg = kgRate; // Fallback: assume buying price is same as selling price per KG
            }

            newPricing = {
              baseUnit: "KG",
              sellingPrice: kgRate,
              buyingPrice: buyingPricePerKg,
            };

            newUnits = [
              { name: "KG", isBaseUnit: true, conversionFactor: 1 },
              { name: "Mtr", isBaseUnit: false, conversionFactor: weightOfOneMeter },
            ];
            console.log(`Migrating "${item.name}" (Mtr to KG conversion). Old Unit: ${oldUnit}, Old SP: ${oldSellingPrice} (per Mtr). New SP: ${kgRate} (per KG).`);

          } else {
            // Case 2: Mtr item NOT found in specific conversion data
            // Keep 'Mtr' as base unit, prices remain per meter.
            newPricing = {
              baseUnit: "Mtr",
              sellingPrice: oldSellingPrice,
              buyingPrice: oldBuyingPrice,
            };
            newUnits = [
              { name: "Mtr", isBaseUnit: true, conversionFactor: 1 },
            ];
            console.log(`Migrating "${item.name}" (Mtr, no specific KG conversion). Old Unit: ${oldUnit}, Old SP: ${oldSellingPrice} (per Mtr).`);
          }
        } else {
          // Case 3: Non-'Mtr' items (e.g., "Nos", "PKT", "KG", etc.)
          // The existing unit becomes the base unit, and prices remain per that unit.
          newPricing = {
            baseUnit: oldUnit,
            sellingPrice: oldSellingPrice,
            buyingPrice: oldBuyingPrice,
          };
          newUnits = [
            { name: newPricing.baseUnit, isBaseUnit: true, conversionFactor: 1 },
          ];
          console.log(`Migrating "${item.name}" (Default conversion). Old Unit: ${oldUnit}, Old SP: ${oldSellingPrice}.`);
        }

        // Update the item document in the database using `updateOne`.
        // This method is safer for schema migrations as it doesn't re-validate the entire document
        // against the current Mongoose schema definition, allowing us to unset old fields.
        await Item.updateOne(
          { _id: item._id },
          {
            $set: {
              pricing: newPricing,
              units: newUnits,
              // Preserve other fields that are not being migrated or unset
              // These fields are copied from the original 'item' object
              name: item.name,
              quantity: item.quantity,
              gstRate: item.gstRate,
              hsnCode: item.hsnCode,
              maxDiscountPercentage: item.maxDiscountPercentage,
              lowStockThreshold: item.lowStockThreshold,
              image: item.image,
              category: item.category,
              discountAvailable: item.discountAvailable,
              lastPurchaseDate: item.lastPurchaseDate,
              lastPurchasePrice: item.lastPurchasePrice,
              status: item.status,
              createdBy: item.createdBy,
              reviewedBy: item.reviewedBy,
              reviewedAt: item.reviewedAt,
              excelImportHistory: item.excelImportHistory,
              inventoryLog: item.inventoryLog,
              needsRestock: item.needsRestock, // Ensure this is preserved if it exists
            },
            // Remove the old top-level fields
            $unset: {
              unit: "",
              sellingPrice: "",
              buyingPrice: "",
            }
          }
        );
        migratedCount++;
      } catch (itemError) {
        console.error(`Error migrating item "${item.name}" (ID: ${item._id}):`, itemError.message);
        errorCount++;
      }
    }

    console.log('\nMigration complete!');
    console.log(`Summary:`);
    console.log(`  Total items processed: ${items.length}`);
    console.log(`  Items migrated: ${migratedCount}`);
    console.log(`  Items skipped (already migrated): ${skippedCount}`);
    console.log(`  Items with errors during migration: ${errorCount}`);

  } catch (globalError) {
    console.error('Global migration error (e.g., DB connection issue):', globalError);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

migrateItems();
