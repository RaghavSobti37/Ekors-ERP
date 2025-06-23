const mongoose = require("mongoose");

const purchaseItemSchema = new mongoose.Schema(
  {
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Item",
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0.01,
    },
    price: {
      type: Number, // Price at which this item was purchased in this transaction
      required: true,
      min: 0,
    },
    sellingPriceAtPurchase: {
      // Optional: if you want to record what the item's selling price was at time of this purchase
      type: Number,
      required: false,
      min: 0,
      default: 0,
    },
    gstRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
  },
  {
    _id: true,
    timestamps: false,
  }
);

// Purchase schema for bulk purchases
const purchaseSchema = new mongoose.Schema(
  {
    companyName: {
      type: String,
      required: true,
      trim: true,
    },
    gstNumber: {
      type: String,
      trim: true,
      default: "",
      validate: {
        validator: function (v) {
          // Basic GST validation - can be enhanced
          return (
            v === "" ||
            /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9A-Z]{1}[Z]{1}[0-9A-Z]{1}$/.test(
              v
            )
          );
        },
        message: (props) => `${props.value} is not a valid GST number!`,
      },
    },
    address: {
      type: String,
      default: "",
    },
    stateName: {
      type: String,
      default: "",
    },
    invoiceNumber: {
      type: String,
      required: true,
      trim: true,
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    items: [purchaseItemSchema],
    totalAmount: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Assuming your user model is named 'User'
      required: false, // Make it not strictly required for existing data
    },
  },
  {
    timestamps: true,
  }
);

// Instead of embedding purchase history, reference purchase documents
const itemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    quantity: {
      type: Number,
      default: 0,
    },
    sellingPrice: {
      // Renamed from price
      type: Number,
      required: true,
      min: 0,
    },
    buyingPrice: {
      // New field for buying price
      type: Number,
      default: 0, // Default to 0, can be updated
      min: 0,
    },
    unit: {
      type: String,
      required: true,
      enum: ["Nos", "Mtr", "PKT", "Pair", "Set", "Bottle", "KG"],
      default: "Nos",
    },
    category: {
      type: String,
      default: "Other",
      index: true,
    },
    subcategory: {
      type: String,
      default: "General",
      index: true,
    },
    gstRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    hsnCode: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    discountAvailable: {
      type: Boolean,
      default: false,
    },
    maxDiscountPercentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    needsRestock: { type: Boolean, default: false },
    lowStockThreshold: { type: Number, default: 5 }, // Default low stock threshold
    excelImportHistory: [
      {
        action: { type: String, enum: ["created", "updated"], required: true },
        importedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // User who performed the import
        importedAt: { type: Date, default: Date.now },
        fileName: { type: String }, // Name of the Excel file
        changes: [
          {
            // For 'updated' action: logs specific field changes
            field: String,
            oldValue: mongoose.Schema.Types.Mixed,
            newValue: mongoose.Schema.Types.Mixed,
          },
        ],
        snapshot: mongoose.Schema.Types.Mixed, // For 'created' action: stores the initial state of the item
      },
    ],
    // Reference to purchases instead of embedding them
    lastPurchaseDate: {
      type: Date,
      default: null,
    },
    lastPurchasePrice: {
      type: Number,
      default: null,
    },
    // New fields for review workflow
    status: {
      type: String,
      enum: ["pending_review", "approved"],
      default: "approved", // Default to approved, will be overridden if created by 'user'
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Add a pre-save hook to calculate total amount
purchaseSchema.pre("save", function (next) {
  if (this.items && this.items.length > 0) {
    this.totalAmount = this.items.reduce((sum, item) => {
      const itemTotal = item.price * item.quantity;
      const gstAmount = itemTotal * (item.gstRate / 100);
      return sum + itemTotal + gstAmount;
    }, 0);
  }
  next();
});

// Create a compound index for better performance on common queries
itemSchema.index({ category: 1, subcategory: 1 });
purchaseSchema.index({ date: -1 });
purchaseSchema.index({ companyName: 1 });
purchaseSchema.index({ "items.itemId": 1 });

const Item = mongoose.model("Item", itemSchema);
const Purchase = mongoose.model("Purchase", purchaseSchema);

module.exports = { Item, Purchase };
