const mongoose = require('mongoose');
const { Item } = require("./models/itemlist");

async function migrateBaseUnitsBulk() {
  try {
    await mongoose.connect('mongodb+srv://kors-superadmin:kors1234@cluster0.ikklapw.mongodb.net/testdb?retryWrites=true&w=majority&appName=Cluster0', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    // Get all items with units
    const items = await Item.find({ units: { $exists: true, $not: { $size: 0 } } });
    
    const bulkOps = items.map(item => {
      const baseUnit = item.units.find(unit => unit.isBaseUnit);
      if (!baseUnit) return null;
      
      return {
        updateOne: {
          filter: { _id: item._id },
          update: { $set: { baseUnit: baseUnit.name } }
        }
      };
    }).filter(op => op !== null);

    if (bulkOps.length > 0) {
      const result = await Item.bulkWrite(bulkOps);
      console.log(`Bulk update complete. Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}`);
    } else {
      console.log('No items need updating');
    }

    process.exit(0);
  } catch (error) {
    console.error('Bulk migration failed:', error);
    process.exit(1);
  }
}

migrateBaseUnitsBulk();