// --- Ticket Payloads and Utilities ---

// This file is now the single source of truth for all payloads (ticket, quotation, etc).
// Do not use any other payload utility files.

// Initial Ticket Payload (matches opentickets.js schema)
export const getInitialTicketPayload = (userId = "", client = null) => ({
  ticketNumber: "",
  companyName: "",
  quotationNumber: "",
  client: client?._id || null,
  clientPhone: client?.phone || "",
  clientGstNumber: client?.gstNumber || "",
  billingAddress: {
    address1: "",
    address2: "",
    city: "",
    state: "",
    pincode: "",
  },
  shippingAddress: {
    address1: "",
    address2: "",
    city: "",
    state: "",
    pincode: "",
  },
  shippingSameAsBilling: false,
  goods: [],
  totalQuantity: 0,
  totalAmount: 0,
  gstBreakdown: [],
  totalCgstAmount: 0,
  totalSgstAmount: 0,
  totalIgstAmount: 0,
  finalGstAmount: 0,
  grandTotal: 0,
  roundOff: 0,
  finalRoundedAmount: 0,
  isBillingStateSameAsCompany: false,
  status: "Quotation Sent",
  documents: {
    quotation: null,
    po: null,
    pi: null,
    challan: null,
    packingList: null,
    feedback: null,
    other: [],
  },
  statusHistory: [],
  createdBy: userId,
  currentAssignee: userId,
  deadline: null,
  assignedTo: userId,
  transferHistory: [],
  assignmentLog: [],
  dispatchDays: "7-10 working days",
});

// Utility to recalculate ticket totals (GST, round off, etc.)
export function recalculateTicketTotals(ticket) {
  const totalQuantity = ticket.goods.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const totalAmount = ticket.goods.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  // GST breakdown and totals can be more complex, but here's a simple version:
  const gstAmount = ticket.goods.reduce((sum, item) => sum + Number(item.amount || 0) * (parseFloat(item.gstRate || 0) / 100), 0);
  const grandTotal = totalAmount + gstAmount;
  const roundOff = Math.round((grandTotal - Math.round(grandTotal)) * 100) / 100;
  const finalRoundedAmount = Math.round(grandTotal);
  return { totalQuantity, totalAmount, finalGstAmount: gstAmount, grandTotal, roundOff, finalRoundedAmount };
}

// Utility to map a quotation payload to a ticket payload
export function mapQuotationToTicketPayload(quotation, userId = "") {
  return {
    ...getInitialTicketPayload(userId, quotation.client),
    companyName: quotation.client?.companyName || "",
    quotationNumber: quotation.referenceNumber,
    client: quotation.client?._id || null,
    clientPhone: quotation.client?.phone || "",
    clientGstNumber: quotation.client?.gstNumber || "",
    billingAddress: { ...quotation.billingAddress },
    goods: quotation.goods?.map((g, idx) => ({ ...g, srNo: idx + 1 })) || [],
    totalQuantity: quotation.totalQuantity,
    totalAmount: quotation.totalAmount,
    finalGstAmount: quotation.gstAmount,
    grandTotal: quotation.grandTotal,
    roundOff: quotation.roundOffTotal - Math.floor(quotation.roundOffTotal),
    finalRoundedAmount: quotation.roundOffTotal,
    status: "Quotation Sent",
    dispatchDays: "7-10 working days",
    // ...other fields as needed
  };
}

// --- Quotation Payloads and Utilities (import or copy from quotationPayload.js if needed) ---
export const getInitialQuotationPayload = (userId = "", client = null) => ({
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

export function recalculateQuotationTotals(goodsList) {
  const totalQuantity = goodsList.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const totalAmount = goodsList.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const gstAmount = goodsList.reduce((sum, item) => sum + Number(item.amount || 0) * (parseFloat(item.gstRate || 0) / 100), 0);
  const grandTotal = totalAmount + gstAmount;
  const roundOffTotal = Math.round(grandTotal * 100) / 100;
  return { totalQuantity, totalAmount, gstAmount, grandTotal, roundOffTotal };
}

// --- Item Payloads and Utilities ---

export const STANDARD_UNITS = [
  'nos', 'pkt', 'pcs', 'kgs', 'mtr', 'sets', 'kwp', 'ltr', 'bottle', 'each', 'bag', 'set'
];

export const getInitialItemPayload = (userId = "") => ({
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

export function normalizeItemPayload(item) {
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

// Normalizes an item for use in a quotation's goods array
export function normalizeItemForQuotation(item) {
  return {
    srNo: undefined, // to be set by caller
    description: item.name || "",
    hsnCode: item.hsnCode || "",
    quantity: 1,
    unit: item.baseUnit || (item.units && item.units[0]?.name) || "nos",
    price: parseFloat(item.sellingPrice) || 0,
    gstRate: parseFloat(item.gstRate) || 0,
    amount: parseFloat(item.sellingPrice) || 0,
    units: Array.isArray(item.units) && item.units.length > 0 ? item.units : [{ name: item.baseUnit || "nos", isBaseUnit: true, conversionFactor: 1 }],
    originalItem: item, // Keep the full item for reference
  };
}
