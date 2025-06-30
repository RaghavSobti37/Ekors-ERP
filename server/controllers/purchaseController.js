const { Item, Purchase } = require("../models/itemlist");
const mongoose = require("mongoose");
const logger = require("../utils/logger");
const User = require("../models/users");

// Helper function for unit conversion and base price calculation
const calculateBaseUnitDetails = async (item, quantity, price, unitName, session, user) => {
    let quantityInTransactionalUnit = parseFloat(quantity);
    let totalPriceForTransaction = parseFloat(price);

    if (isNaN(quantityInTransactionalUnit) || quantityInTransactionalUnit <= 0) {
        logger.warn("purchase_helper", `Invalid quantity: ${quantity}. Assuming 1 for calculation.`, user);
        quantityInTransactionalUnit = 1;
    }
    if (isNaN(totalPriceForTransaction) || totalPriceForTransaction < 0) {
        logger.warn("purchase_helper", `Invalid price: ${price}. Assuming 0 for calculation.`, user);
        totalPriceForTransaction = 0;
    }

    if (!item) {
        logger.warn("purchase_helper", `Item not found for base unit calculation. Returning raw values.`, user);
        return { quantityInBaseUnit: quantityInTransactionalUnit, pricePerBaseUnit: totalPriceForTransaction, baseUnitName: unitName || "N/A" };
    }

    const itemBaseUnit = item.baseUnit;
    let conversionFactor = 1;

    if (unitName && unitName.toLowerCase() !== itemBaseUnit.toLowerCase()) {
        const foundUnit = item.units.find(u => u.name.toLowerCase() === unitName.toLowerCase());
        if (foundUnit) {
            conversionFactor = foundUnit.conversionFactor;
        } else {
            logger.warn("purchase_helper", `Unit "${unitName}" not found for item "${item.name}". Assuming it's the base unit for conversion.`, user);
        }
    }

    const finalQuantityInBaseUnit = quantityInTransactionalUnit * conversionFactor;
    const finalPricePerBaseUnit = finalQuantityInBaseUnit > 0 ? (totalPriceForTransaction / finalQuantityInBaseUnit) : 0;

    return {
        quantityInBaseUnit: finalQuantityInBaseUnit,
        pricePerBaseUnit: finalPricePerBaseUnit,
        baseUnitName: itemBaseUnit
    };
};

// Helper function to update item pricing on purchase
const updateItemPricingOnPurchase = async (item, newQuantity, purchasePricePerBaseUnit, session, user) => {
  // If there's existing stock, calculate the weighted average
  let newBuyingPrice;
  if (item.quantity > 0) {
    const totalValueBeforePurchase = item.quantity * item.buyingPrice;
    const purchaseValue = newQuantity * purchasePricePerBaseUnit;
    const totalQuantityAfterPurchase = item.quantity + newQuantity;
    newBuyingPrice = (totalValueBeforePurchase + purchaseValue) / totalQuantityAfterPurchase;
  } else {
    // If no existing stock, the new buying price is simply the purchase price
    newBuyingPrice = purchasePricePerBaseUnit;
  }

  // Ensure the buying price is not NaN or negative after calculation
  if (isNaN(newBuyingPrice) || newBuyingPrice < 0) {
    logger.error(
      "purchase_pricing",
      `Invalid calculated buying price for item ${item.name}: ${newBuyingPrice}. Resetting to purchase price.`,
      user,
      { itemId: item._id }
    );
    newBuyingPrice = purchasePricePerBaseUnit; // Reset to the purchase price as a fallback
  }

  // Calculate the new selling price based on the profit margin
  const profitMargin = item.profitMarginPercentage / 100;
  const newSellingPrice = newBuyingPrice * (1 + profitMargin);

  // Update the item with the new prices
  item.buyingPrice = newBuyingPrice;
  item.sellingPrice = newSellingPrice;
  item.quantity += newQuantity; // Also update the quantity here

  logger.info(
    "purchase_pricing",
    `Updated pricing for item ${item.name}: Buying Price = ${newBuyingPrice.toFixed(2)}, Selling Price = ${newSellingPrice.toFixed(2)}`,
    user,
    { itemId: item._id, profitMarginPercentage: item.profitMarginPercentage }
  );
};



// Add purchase to specific item
exports.addSinglePurchase = async (req, res) => {
  const itemId = req.params.id;
  const user = req.user; // Assuming auth middleware populates req.user
  const session = await mongoose.startSession();
  
  try {
    session.startTransaction();

    const {
      companyName,
      gstNumber,
      address,
      stateName,
      invoiceNumber,
      date,
      quantity,
      price,
      gstRate,
      unit, // Added unit from request body
         } = req.body;

          // Find the item, populate units for conversion
        const   item = await Item.findById(itemId).session(session);
          if (!item) {
            await session.abortTransaction();
            return res
              .status(404)
              .json({ success: false, message: "Item not found" });
          }

          // Calculate quantities and prices in base units
          const { quantityInBaseUnit, pricePerBaseUnit, baseUnitName } = await calculateBaseUnitDetails(item, quantity, price, unit, session, user);

          // Update item quantity and buying price
          await updateItemPricingOnPurchase(item, quantityInBaseUnit, pricePerBaseUnit, session, user);          item.lastPurchaseDate = new Date(date); // Update last purchase date
          item.lastPurchasePrice = pricePerBaseUnit; // Update last purchase price

          // Add inventory log entry for the purchase
          item.inventoryLog = item.inventoryLog || [];
          item.inventoryLog.push({
            type: "Purchase (Single)",
            date: new Date(),
            quantityChange: quantityInBaseUnit,
            details: `Purchased ${quantity} ${unit} at ₹${price} (₹${pricePerBaseUnit.toFixed(2)}/${baseUnitName}). Invoice: ${invoiceNumber}.`,
            userReference: user._id,
          });

          // Save the item
          await item.save({ session });

          // Also create a purchase document with this item
          const purchase = new Purchase({
            companyName,
            gstNumber,
            address,
            stateName,
            invoiceNumber,
            date: new Date(date),
            items: [
              {
                    itemId: itemId,
                    description: item.name,
                    quantity: quantity, // Store original quantity from transaction
                    unit: unit || item.baseUnit, // Store original unit from transaction, fallback to item's base unit
                    price: price, // Store original total price for the transaction quantity
                    pricePerBaseUnit: pricePerBaseUnit, // Store calculated price per base unit
                    sellingPriceAtPurchase: item.sellingPrice, // Store item's selling price at time of purchase
                    gstRate: gstRate || 0,
              },
            ],
            createdBy: user._id, // Store the user who created this purchase
          });

          // Save the purchase
          const savedPurchase = await purchase.save({ session });

          await session.commitTransaction();

          logger.info(
            "purchase",
            `Single purchase added successfully for item ID: ${itemId}`,
            user,
            { purchaseId: savedPurchase._id, itemId }
          );
          res
            .status(201)
            .json({
              success: true,
              data: { itemUpdated: item, purchase: savedPurchase },
            });
  } catch (error) {
    if (session.inTransaction()) {
        await session.abortTransaction();
    }
    logger.error(
      "purchase",
      `Error adding single purchase for item ID: ${itemId}`,
      error,
      user,
      { requestBody: req.body }
    );
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to add purchase",
        error: error.message,
      });
  } finally {
    session.endSession();
  }
};

exports.addBulkPurchase = async (req, res) => {
  const user = req.user; // Assuming auth middleware populates req.user
  const session = await mongoose.startSession(); // Start a session for transaction
        try {
          session.startTransaction();          const {
            companyName,
            gstNumber,
            address,
            stateName,
            invoiceNumber,
            date,
            items, // This 'items' array comes from the request body
          } = req.body;

          // Validate items array exists and has content
          if (!items || !Array.isArray(items) || items.length === 0) {
            await session.abortTransaction();
            return res
              .status(400)
              .json({
                success: false,
                message: "Items array is required and must not be empty",
              });
          }

          // Basic validation for required fields for the purchase itself
          if (!companyName || !invoiceNumber || !date) {
            await session.abortTransaction();
            return res
              .status(400)
              .json({
                success: false,
                message:
                  "Company name, invoice number, and date are required for the purchase.",
              });
          }

          // Prepare items for the Purchase document, including calculated pricePerBaseUnit
          const purchaseItemsForDoc = [];
          for (const pItem of items) { // pItem is from req.body
            // Validate each item in the items array
            if (
              !pItem.description ||
              typeof pItem.quantity !== "number" ||
              pItem.quantity <= 0 ||
              typeof pItem.price !== "number" ||
              pItem.price < 0
            ) {
              await session.abortTransaction();
              return res.status(400).json({
                success: false,
                message: `Invalid item data: Each item must have a description, a positive quantity, and a non-negative price. Problem with item: ${
                  pItem.description || "N/A"
                }`,
              });
            }
            // Ensure itemId is a valid ObjectId if provided, or null
            if (pItem.itemId && !mongoose.Types.ObjectId.isValid(pItem.itemId)) {
              await session.abortTransaction();
              return res
                .status(400)
                .json({
                  success: false,
                  message: `Invalid itemId format for item: ${pItem.description}`,
                });
            }

            let itemDetailsForConversion = null;
            if (pItem.itemId) {
                itemDetailsForConversion = await Item.findById(pItem.itemId).session(session);
            } else if (pItem.description) {
                itemDetailsForConversion = await Item.findOne({ name: pItem.description }).session(session);
            }

            let calculatedPricePerBaseUnit = 0;
            let itemSellingPriceAtPurchase = 0;
            let actualUnitUsed = pItem.unit; // Use the unit provided in the request

            if (itemDetailsForConversion) {
                const { pricePerBaseUnit, baseUnitName } = await calculateBaseUnitDetails(itemDetailsForConversion, pItem.quantity, pItem.price, pItem.unit, session, user);
                calculatedPricePerBaseUnit = pricePerBaseUnit;
                itemSellingPriceAtPurchase = itemDetailsForConversion.sellingPrice; // Get current selling price
                actualUnitUsed = baseUnitName; // Use the item's actual base unit name for consistency if unit was not provided or was invalid
            } else {
                // If item not found, we can't convert, so pricePerBaseUnit is just price/quantity
                calculatedPricePerBaseUnit = pItem.quantity > 0 ? (pItem.price / pItem.quantity) : 0;
                logger.warn("purchase_bulk", `Item "${pItem.description}" not found for base unit conversion. PricePerBaseUnit calculated as total price / quantity.`, user);
            }

            let finalGstRate = parseFloat(pItem.gstRate);
            if (isNaN(finalGstRate) || finalGstRate < 0) {
              finalGstRate = 0;
            }

            purchaseItemsForDoc.push({
              itemId: pItem.itemId || null,
              description: pItem.description,
              quantity: pItem.quantity,
              unit: actualUnitUsed, // Store the unit used in the transaction
              price: pItem.price, // Total price for the quantity in the transaction unit
              pricePerBaseUnit: calculatedPricePerBaseUnit, // Calculated price per base unit
              sellingPriceAtPurchase: itemSellingPriceAtPurchase, // Item's selling price at the time of purchase
              gstRate: finalGstRate,
            });
          }

          // Create the purchase document
          const purchase = new Purchase({
            companyName,
            gstNumber,
            address,
            stateName,
            invoiceNumber,
            date: new Date(date),
            items: purchaseItemsForDoc, // Use the prepared items
            createdBy: user._id,
          });

          // Save the purchase
          const savedPurchase = await purchase.save({ session });

          // Update each item's quantity, buying price, and add inventory log
          for (const purchasedItem of savedPurchase.items) {
            logger.debug(
              "purchase_item_processing",
              `Processing purchase line item: ${JSON.stringify(purchasedItem)}`,
              user
            );
            let itemToUpdate = null;
            if (purchasedItem.itemId) {
              itemToUpdate = await Item.findById(purchasedItem.itemId).session(session);
            } else if (purchasedItem.description) {
              itemToUpdate = await Item.findOne({ name: purchasedItem.description }).session(session);
            }

            if (itemToUpdate) {
              logger.debug(
                "purchase_stock_update",
                `Found item in DB: ${itemToUpdate.name}, Current Qty: ${itemToUpdate.quantity}`,
                user
              );

               const { quantityInBaseUnit, pricePerBaseUnit, baseUnitName } = await calculateBaseUnitDetails(itemToUpdate, purchasedItem.quantity, purchasedItem.price, purchasedItem.unit, session, user);
               await updateItemPricingOnPurchase(itemToUpdate, quantityInBaseUnit, pricePerBaseUnit, session, user);              itemToUpdate.lastPurchaseDate = savedPurchase.date;
              itemToUpdate.lastPurchasePrice = pricePerBaseUnit; // Store price per base unit

              // Add inventory log entry
              itemToUpdate.inventoryLog = itemToUpdate.inventoryLog || [];
              itemToUpdate.inventoryLog.push({
                type: "Purchase (Bulk)",
                date: new Date(),
                quantityChange: quantityInBaseUnit,
                details: `Purchased ${purchasedItem.quantity} ${purchasedItem.unit} at ₹${purchasedItem.price} (₹${pricePerBaseUnit.toFixed(2)}/${baseUnitName}). Invoice: ${invoiceNumber}.`,
                userReference: user._id,
              });

              // Update restock status
              if (itemToUpdate.needsRestock) {
                itemToUpdate.restockAmount -= quantityInBaseUnit;
                if (
                  itemToUpdate.restockAmount <= 0 ||
                  itemToUpdate.quantity >= itemToUpdate.lowStockThreshold
                ) {
                  itemToUpdate.needsRestock = false;
                  itemToUpdate.restockAmount = 0;
                  logger.info(
                    "inventory",
                    `Item ${itemToUpdate.name} restocked. No longer needs restock. New Qty: ${itemToUpdate.quantity}`,
                    user
                  );
                } else {
                  logger.info(
                    "inventory",
                    `Item ${itemToUpdate.name} partially restocked. Still needs: ${itemToUpdate.restockAmount}. New Qty: ${itemToUpdate.quantity}`,
                    user
                  );
                }
              }

              await itemToUpdate.save({ session });
              logger.info(
                "inventory",
                `Inventory updated for item: ${itemToUpdate.name} via purchase ${invoiceNumber}. Added: ${quantityInBaseUnit} ${baseUnitName}, New Qty: ${itemToUpdate.quantity}`,
                user
              );
            } else {
              const identifier = purchasedItem.itemId
                ? `ID ${purchasedItem.itemId}`
                : `description "${purchasedItem.description}"`;
              logger.warn(
                "purchase_stock_update",
                `Item with ${identifier} not found in DB during bulk purchase stock update. Stock not updated for this item.`,
                user,
                {
                  searchedItemId: purchasedItem.itemId,
                  searchedDescription: purchasedItem.description,
                }
              );
            }
          }

          await session.commitTransaction();

          const purchasedItemsDetails = savedPurchase.items.map((pi) => ({
            name: pi.description,
            hsnCode:
              items.find((reqItem) => reqItem.description === pi.description)
                ?.hsnCode || "N/A",
            quantityPurchased: pi.quantity,
          }));

          logger.info(
            "purchase",
            `Bulk purchase added successfully. Invoice: ${invoiceNumber}`,
            user,
            { purchaseId: savedPurchase._id, itemsProcessed: purchasedItemsDetails }
          );
          res.status(201).json({ success: true, data: savedPurchase });
        } catch (error) {
   if (session.inTransaction()) {
            await session.abortTransaction();
          }          logger.error(
            "purchase",
            `Error adding bulk purchase. Invoice: ${req.body.invoiceNumber}`,
            error,
            user,
            { requestBody: req.body }
          );
          if (error.name === "ValidationError") {
            return res
              .status(400)
              .json({
                success: false,
                message: "Validation failed creating purchase",
                errors: error.errors,
              });
          }
          res
            .status(500)
            .json({
              success: false,
              message: "Failed to add bulk purchase",
              error: error.message,
            });
        } finally {
          session.endSession();
        }
      }

      exports.getItemPurchaseHistory = async (req, res) => {
        const user = req.user;
        try {
          // Validate item ID
          if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: "Invalid item ID" });
          }

          const purchases = await Purchase.find({ "items.itemId": req.params.id })
            .populate("createdBy", "firstname lastname email") // Populate createdBy
            .sort({ date: -1 })
            .select("companyName invoiceNumber date items createdBy") // Select necessary fields
            .lean();

          logger.debug(
            "purchase_history_fetch",
            `For item ID ${req.params.id}, found ${purchases.length} parent purchase documents.`,
            { purchasesData: JSON.stringify(purchases) }
          ); // Log fetched data

          // Transform the data to match frontend expectations
          const transformed = purchases
            .map((purchase) => {
              const itemInPurchase = purchase.items.find(
                (i) => i.itemId && i.itemId.toString() === req.params.id
              );

              if (!itemInPurchase) {
                // This log helps identify if a parent purchase doc was found, but the specific item was not found within its 'items' array.
                logger.warn(
                  "purchase_history_transform",
                  `Item ID ${req.params.id} not found in items array of purchase ${purchase._id}, though parent document matched. This is unexpected.`,
                  { purchaseItems: JSON.stringify(purchase.items) }
                );
              }
              if (!itemInPurchase) return null;

              return {
                _id: purchase._id,
                companyName: purchase.companyName,
                invoiceNumber: purchase.invoiceNumber,
                date: purchase.date,
                createdByName: purchase.createdBy
                  ? `${purchase.createdBy.firstname} ${purchase.createdBy.lastname}`.trim()
                  : "System/N/A",
                quantity: itemInPurchase.quantity,
                price: itemInPurchase.price, // This is the total price for the quantity
                pricePerBaseUnit: itemInPurchase.pricePerBaseUnit, // New: Add price per base unit
                // description: itemInPurchase.description, // Not needed for this specific table
                // gstRate: itemInPurchase.gstRate, // Not needed for this specific table
              };
            })
            .filter(Boolean); // Remove any null entries

          res.json(transformed);
          logger.debug(
            "purchase",
            `Fetched item purchase history for item ID: ${req.params.id}`,
            user,
            { count: transformed.length }
          );
        } catch (err) {
          logger.error(
            "purchase",
            `Error fetching item purchase history for item ID: ${req.params.id}`,
            err,
            user
          );
          res.status(500).json({ message: "Server error fetching purchase history" });
        }
      }

      // Get all purchases
      exports.getAllPurchases = async (req, res) => {
        const user = req.user;
        try {
          // Fetch all purchases and sort by date descending (newest first)
          const purchases = await Purchase.find().sort({ date: -1 }).lean();
          res.status(200).json(purchases);
          logger.debug("purchase", `Fetched all purchases`, user, {
            count: purchases.length,
          });
        } catch (error) {
          logger.error("purchase", `Error fetching all purchases`, error, user);
          res
            .status(500)
            .json({
              success: false,
              message: "Failed to fetch purchases",
              error: error.message,
            });
        }
      }

      // Get purchase by ID
      exports.getPurchaseById = async (req, res) => {
        const user = req.user;
        try {
          const purchase = await Purchase.findById(req.params.id).populate(
            "items.itemId"
          );
          if (!purchase) {
            return res.status(404).json({ message: "Purchase not found" });
          }
          res.json(purchase);
        } catch (error) {
          logger.error(
            "purchase",
            `Error fetching purchase by ID: ${req.params.id}`,
            error,
            user
          );
          res.status(500).json({ message: "Server error while fetching purchase" });
        }
      }

