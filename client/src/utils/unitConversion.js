export const calculateItemPriceAndQuantity = (item, quantity, selectedUnitName) => {
  if (!item || !item.pricing || !item.units || !selectedUnitName) {
    console.warn("Invalid input for calculateItemPriceAndQuantity", { item, quantity, selectedUnitName });
    return { pricePerSelectedUnit: 0, quantityInBaseUnit: 0 };
  }

  const basePricePerBaseUnit = parseFloat(item.pricing.sellingPrice) || 0;
  const selectedUnitInfo = item.units.find(u => u.name === selectedUnitName);

  if (!selectedUnitInfo) {
    console.warn(`Unit '${selectedUnitName}' not found for item '${item.name}'.`);
    // Fallback to base unit if selected unit is not found (e.g., if data is inconsistent)
    const baseUnitInfo = item.units.find(u => u.isBaseUnit) || item.units[0];
    if (baseUnitInfo) {
        return calculateItemPriceAndQuantity(item, quantity, baseUnitInfo.name);
    }
    return { pricePerSelectedUnit: 0, quantityInBaseUnit: 0 };
  }

  const conversionFactor = parseFloat(selectedUnitInfo.conversionFactor) || 0;
  const pricePerSelectedUnit = basePricePerBaseUnit * conversionFactor;
  const quantityInBaseUnit = quantity * conversionFactor; // For inventory tracking
  return { pricePerSelectedUnit, quantityInBaseUnit };
};
