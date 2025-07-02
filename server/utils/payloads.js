// Unified Quotation Payload structure matching the Mongoose schema in server/models/quotation.js

const getInitialQuotationPayload = (userId = "", client = null) => ({
  user: userId,
  orderIssuedBy: userId,
  date: new Date().toISOString().slice(0, 10),
  referenceNumber: "",
  validityDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  billingAddress: {
    address1: "",
    address2: "",
    city: "",
    state: "",
    pincode: "",
  },
  goods: [],
  totalQuantity: 0,
  totalAmount: 0,
  gstAmount: 0,
  grandTotal: 0,
  roundOffTotal: 0,
  status: "open",
  client: client || {
    _id: null,
    companyName: "",
    clientName: "",
    gstNumber: "",
    email: "",
    phone: "",
  },
  documents: {
    quotationPdf: null,
  },
});

// --- Item Payloads and Utilities ---

const STANDARD_UNITS = [
  'nos', 'pkt', 'pcs', 'kgs', 'mtr', 'sets', 'kwp', 'ltr', 'bottle', 'each', 'bag', 'set'
];

const getInitialItemPayload = (userId = "") => ({
  name: "",
  quantity: 0,
  sellingPrice: 0,
  buyingPrice: 0,
  profitMarginPercentage: 20,
  gstRate: 0,
  hsnCode: "",
  baseUnit: "nos",
  units: [{ name: "nos", isBaseUnit: true, conversionFactor: 1 }],
  category: "",
  maxDiscountPercentage: 0,
  image: "",
  status: "approved",
  createdBy: userId,
  reviewedBy: null,
  reviewedAt: null,
  lastPurchaseDate: null,
  lastPurchasePrice: null,
  inventoryLog: [],
  excelImportHistory: [],
});

function normalizeItemPayload(item) {
  // Ensures all required fields are present and types are correct
  return {
    ...getInitialItemPayload(item.createdBy),
    ...item,
    quantity: parseFloat(item.quantity) || 0,
    sellingPrice: parseFloat(item.sellingPrice) || 0,
    buyingPrice: parseFloat(item.buyingPrice) || 0,
    gstRate: parseFloat(item.gstRate) || 0,
    maxDiscountPercentage: parseFloat(item.maxDiscountPercentage) || 0,
    units: Array.isArray(item.units) && item.units.length > 0 ? item.units : [{ name: item.baseUnit || "nos", isBaseUnit: true, conversionFactor: 1 }],
    baseUnit: item.baseUnit || (item.units && item.units[0]?.name) || "nos",
    status: item.status || "approved",
    image: item.image || "",
    category: item.category || "",
    hsnCode: item.hsnCode || "",
  };
}

module.exports = {
  getInitialQuotationPayload,
  getInitialItemPayload,
  normalizeItemPayload,
  STANDARD_UNITS
};
