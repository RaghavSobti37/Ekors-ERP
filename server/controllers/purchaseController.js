const { Item, Purchase } = require("../models/itemlist");
const mongoose = require("mongoose");
const logger = require("../utils/logger");
const user = require("../models/users");

// Add purchase to specific item
exports.addSinglePurchase = async (req, res) => {
  const itemId = req.params.id;
  const user = req.user; // Assuming auth middleware populates req.user
  try {
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
    } = req.body;

    // Find the item
    const item = await Item.findById(itemId);
    if (!item) {
      return res
        .status(404)
        .json({ success: false, message: "Item not found" });
    }

    // Create purchase entry for the item
    const purchaseEntry = {
      date: new Date(date),
      companyName,
      gstNumber,
      address,
      stateName,
      invoiceNumber,
      quantity,
      price,
      gstRate: gstRate || 0,
    };

    // Note: Item model (models/itemlist.js) does not have 'purchaseHistory' array anymore. This logic was removed.

    // Increase item quantity
    item.quantity += quantity;

    // Save the item
    await item.save();

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
          description: item.name, // Use item.name for description
          quantity: quantity, // Use the quantity from request (assumed base unit)
          unit: item.baseUnit, // Store the item's base unit
          price: price, // Use the price from request (assumed base unit)
          quantity,
          price,
          gstRate: gstRate || 0,
        },
      ],
      createdBy: user._id, // Store the user who created this purchase
    });

    // Save the purchase
    const savedPurchase = await purchase.save();

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
  }
};

// Add bulk purchase
exports.addBulkPurchase = async (req, res) => {
  const user = req.user; // Assuming auth middleware populates req.user
  try {
    const {
      companyName,
      gstNumber,
      address,
      stateName,
      invoiceNumber,
      date,
      items,
    } = req.body;

    // Validate items array exists and has content
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Items array is required and must not be empty",
        });
    }

    // Basic validation for required fields for the purchase itself
    if (!companyName || !invoiceNumber || !date) {
      return res
        .status(400)
        .json({
          success: false,
          message:
            "Company name, invoice number, and date are required for the purchase.",
        });
    }

    // Validate each item in the items array
    for (const item of items) {
      // items from req.body
      if (
        !item.description ||
        typeof item.quantity !== "number" ||
        item.quantity <= 0 ||
        typeof item.price !== "number" ||
        item.price < 0
      ) {
        return res.status(400).json({
          success: false,
          message: `Invalid item data: Each item must have a description, a positive quantity, and a non-negative price. Problem with item: ${
            item.description || "N/A"
          }`,
        });
      }
      // Ensure itemId is a valid ObjectId if provided, or null
      if (item.itemId && !mongoose.Types.ObjectId.isValid(item.itemId)) {
        return res
          .status(400)
          .json({
            success: false,
            message: `Invalid itemId format for item: ${item.description}`,
          });
      }
    }

    // Create the purchase document
    const purchase = new Purchase({
      companyName,
      gstNumber,
      address,
      stateName,
      invoiceNumber,
      date: new Date(date),
      items: items.map((pItem) => {
        // Ensure gstRate is a valid number, defaulting to 0 if not.
        // Client sends parsed floats, so item.gstRate could be a number or NaN.
        // JSON.stringify converts NaN to null. So pItem.gstRate could be number or null.
        let finalGstRate = parseFloat(pItem.gstRate); // Attempt to parse again, just in case
        if (isNaN(finalGstRate) || finalGstRate < 0) {
          finalGstRate = 0;
        }
        return {
          itemId: pItem.itemId || null,
          description: pItem.description,
          quantity: pItem.quantity, // Assumed to be valid number due to prior validation loop
          price: pItem.price, // Assumed to be valid number due to prior validation loop
          gstRate: finalGstRate,
        };
      }),
      createdBy: user._id, // Store the user who created this purchase
    });

    // Save the purchase
    const savedPurchase = await purchase.save();

    // Update each item's purchase history and quantity
    for (const purchasedItem of savedPurchase.items) {
      // Iterate over items from the saved purchase document
      logger.debug(
        "purchase_item_processing",
        `Processing purchase line item: ${JSON.stringify(purchasedItem)}`,
        user
      );
      let itemToUpdate = null;
      if (purchasedItem.itemId) {
        // Only if it's an existing item with a valid ID
        logger.debug(
          "purchase_stock_update",
          `Processing item with ID: ${purchasedItem.itemId}, Description: ${purchasedItem.description}`,
          user
        );
        itemToUpdate = await Item.findById(purchasedItem.itemId);
      } else if (purchasedItem.description) {
        // Fallback: If itemId is not present, try to find by description (name)
        // For a more robust match, HSN code should ideally be part of purchasedItem if available from input
        logger.debug(
          "purchase_stock_update",
          `Attempting to find item by description (name) only: "${purchasedItem.description}" as itemId was not provided.`,
          user
        );
        itemToUpdate = await Item.findOne({ name: purchasedItem.description });
        if (itemToUpdate) {
          logger.info(
            "purchase_stock_update",
            `Found item by name match: ${itemToUpdate.name} (ID: ${itemToUpdate._id}). Proceeding with stock update.`,
            user
          );
        }
      }

      if (itemToUpdate) {
        logger.debug(
          "purchase_stock_update",
          `Found item in DB: ${itemToUpdate.name}, Current Qty: ${itemToUpdate.quantity}`,
          user
        );
        const quantityAdded = purchasedItem.quantity;
        itemToUpdate.quantity += purchasedItem.quantity;
        itemToUpdate.lastPurchaseDate = savedPurchase.date; // Update last purchase date
        itemToUpdate.lastPurchasePrice = purchasedItem.price; // Update last purchase price

        // Update restock status
        if (itemToUpdate.needsRestock) {
          itemToUpdate.restockAmount -= quantityAdded;
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

        await itemToUpdate.save(); // Save the updated item
        logger.info(
          "inventory",
          `Inventory updated for item: ${itemToUpdate.name} via purchase ${savedPurchase.invoiceNumber}. Added: ${quantityAdded}, New Qty: ${itemToUpdate.quantity}`,
          user
        );
      } else {
        // Optionally, handle cases where an itemId is provided but the item doesn't exist
        // or if fallback search by name also fails.
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
      // Removed the 'else' block that was here, as the condition is now handled by the itemToUpdate check
    }

    // Enhanced logging for purchased items
    const purchasedItemsDetails = savedPurchase.items.map((pi) => ({
      name: pi.description,
      hsnCode:
        items.find((reqItem) => reqItem.description === pi.description)
          ?.hsnCode || "N/A", // Attempt to find HSN from original request
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
    logger.error(
      "purchase",
      `Error adding bulk purchase. Invoice: ${req.body.invoiceNumber}`,
      error,
      user,
      { requestBody: req.body }
    );
    // Check for Mongoose validation error
    if (error.name === "ValidationError") {
      // Send back specific validation errors
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
  }
};

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
          price: itemInPurchase.price,
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
};

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
};

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
};
