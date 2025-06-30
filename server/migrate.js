require('dotenv').config();
const mongoose = require('mongoose');
const { Item, STANDARD_UNITS } = require('./models/itemlist');

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected');
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

// Helper to split and clean unit strings
function splitUnits(str) {
  if (!str) return [];
  return str
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
}

// Map common aliases to standard units
const UNIT_ALIASES = {
  kg: 'kgs',
  kgs: 'kgs',
  kilogram: 'kgs',
  kilograms: 'kgs',
  gm: 'kgs', // or map to 'gms' if you add it
  gms: 'kgs',
  meter: 'mtr',
  meters: 'mtr',
  m: 'mtr',
  nos: 'nos',
  no: 'nos',
  piece: 'pcs',
  pieces: 'pcs',
  pc: 'pcs',
  pkt: 'pkt',
  set: 'set',
  sets: 'sets',
  kwp: 'kwp',
  ltr: 'ltr',
  litre: 'ltr',
  liters: 'ltr',
  bottle: 'bottle',
  each: 'each',
  bag: 'bag',
  // Add more aliases as needed
};

// Try to map a unit to a valid enum value
function mapToStandardUnit(unit) {
  if (!unit) return null;
  unit = unit.trim().toLowerCase();
  if (STANDARD_UNITS.includes(unit)) return unit;
  if (UNIT_ALIASES[unit]) return UNIT_ALIASES[unit];
  // Try plural/singular forms
  if (STANDARD_UNITS.includes(unit + 's')) return unit + 's';
  if (STANDARD_UNITS.includes(unit.slice(0, -1))) return unit.slice(0, -1);
  return null; // Could not map
}

// Normalize units and baseUnit to new schema (all lowercase, base unit always present)
function normalizeUnitsAndBaseUnit(units, baseUnit) {
  // If baseUnit is comma-separated, split it
  let baseUnitsArr = splitUnits(baseUnit);
  // Map all base units to standard units, filter out invalids
  baseUnitsArr = baseUnitsArr.map(mapToStandardUnit).filter(Boolean);
  if (baseUnitsArr.length === 0) return { baseUnit: '', units: [] };
  const baseUnitLower = baseUnitsArr[0];

  // Collect all unique unit names from baseUnit and units array
  let allUnitNames = new Set(baseUnitsArr);
  if (Array.isArray(units)) {
    for (const u of units) {
      if (u && u.name) {
        splitUnits(u.name)
          .map(mapToStandardUnit)
          .filter(Boolean)
          .forEach(n => allUnitNames.add(n));
      }
    }
  }

  // Build normalized units array
  const normalizedUnits = [];
  for (const name of allUnitNames) {
    normalizedUnits.push({
      name,
      isBaseUnit: name === baseUnitLower,
      conversionFactor: 1,
    });
  }

  return { baseUnit: baseUnitLower, units: normalizedUnits };
}

async function migrateAllItems() {
  await connectDB();

  const items = await Item.find({});
  let updatedCount = 0;

  for (const item of items) {
    // Remove items with name longer than 100 chars
    if (item.name && item.name.length > 100) {
      try {
        await item.deleteOne();
        console.warn(`Deleted item with too long name: ${item.name}`);
      } catch (err) {
        console.warn(`Could not delete item "${item.name}": ${err.message}`);
      }
      continue;
    }

    // Normalize baseUnit and units
    const { baseUnit, units } = normalizeUnitsAndBaseUnit(item.units || [], item.baseUnit);

    // Only update if normalization changes something
    const needsUpdate =
      item.baseUnit !== baseUnit ||
      JSON.stringify(item.units) !== JSON.stringify(units);

    if (needsUpdate) {
      item.baseUnit = baseUnit;
      item.units = units;
      try {
        await item.save();
        updatedCount++;
        console.log(`Updated: ${item.name}`);
      } catch (err) {
        console.warn(`Could not update ${item.name}: ${err.message}`);
      }
    }
  }

  console.log(`Migration complete. Updated ${updatedCount} items.`);
  await mongoose.disconnect();
}

migrateAllItems().catch(err => {
  console.error(err);
  process.exit(1);
});