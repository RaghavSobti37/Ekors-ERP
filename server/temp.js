require('dotenv').config();
const mongoose = require('mongoose');
const { Item, STANDARD_UNITS } = require('./models/itemlist');

// Conversion data: [name, baseUnit, weightPerMeter]
const conversionData = [
  ["ALUMINIUM STRIP 25X3", "Mtr", 0.2],
  ["COPPER BONDED STRIP 25X3", "Mtr", 0.67],
  ["COPPER BONDED STRIP 25X6", "Mtr", 1.34],
  ["COPPER STRIP 20X3", "Mtr", 0.54],
  ["Copper Strip 25x5", "Mtr", 1.12],
  ["COPPER STRIP 25X6", "Mtr", 1.34],
  ["COPPER STRIP 50*6", "Mtr", 2.68],
  ["Copper Strip 50x5", "Mtr", 2.24],
  ["Cu Strip 25 X 3 MM", "Mtr", 0.67],
  ["Cu Strip 50 X 6 MM", "Mtr", 2.68],
  ["GI 50-6 Strip", "Mtr", 2.4],
  ["GI Strip 20x3 Mm", "Mtr", 0.48],
  ["GI Strip 25 X 3 mm", "Mtr", 0.6],
  ["GI Strip 25 X 5 mm", "Mtr", 1],
  ["GI Strip 25 X 6 mm", "Mtr", 1.2],
  ["GI STRIP 32X6", "Mtr", 1.54],
  ["GI STRIP 50X3 E", "Mtr", 1.2],
  ["Gi Strip 75x10", "Mtr", 6],
  ["HDG Strip", "Mtr", null],
  ["HDGI Strip 25x3mm", "Mtr", 0.6],
];

async function run() {
  await mongoose.connect(process.env.MONGO_URI, {});

  for (const [name, baseUnit, weightPerMeter] of conversionData) {
    if (!baseUnit || !STANDARD_UNITS.includes(baseUnit.toLowerCase())) {
      console.warn(`Skipping ${name}: base unit ${baseUnit} not in STANDARD_UNITS`);
      continue;
    }

    // Find item by name (case-insensitive)
    const item = await Item.findOne({ name: new RegExp(`^${name}$`, 'i') });
    if (!item) {
      console.warn(`Item not found: ${name}`);
      continue;
    }

    // Prepare units array: base unit + kg unit if weightPerMeter is present
    const units = [
      {
        name: baseUnit.toLowerCase(),
        isBaseUnit: true,
        conversionFactor: 1,
      },
    ];

    if (weightPerMeter && !isNaN(weightPerMeter)) {
      units.push({
        name: 'kgs',
        isBaseUnit: false,
        conversionFactor: parseFloat(weightPerMeter),
      });
    }

    item.units = units;
    item.baseUnit = baseUnit.toLowerCase();

    // Fix: Ensure gstRate is valid (<= 100)
    if (!item.gstRate || item.gstRate > 100) {
      item.gstRate = 0; // or set to a valid default like 18
    }

    try {
      await item.save();
      console.log(`Updated units for: ${name}`);
    } catch (err) {
      console.warn(`Failed to update ${name}: ${err.message}`);
    }
  }

  await mongoose.disconnect();
  console.log('Done!');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});