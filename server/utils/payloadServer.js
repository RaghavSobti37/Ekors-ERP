// Unified Quotation Payload structure matching the Mongoose schema in server/models/quotation.js
const { generateTicketNumber } = require("./ticketNumberGenerator");

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
  gstAmount: 0,
  grandTotal: 0,
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

// Function to recalculate quotation totals based on goods items
function recalculateQuotationTotals(goodsList) {
  // Ensure all goods have properly calculated amounts
  const processedGoods = goodsList.map(item => {
    // If amount is not set or needs recalculation
    if (item.amount === undefined || item.amount === null) {
      const quantity = Number(item.quantity || 0);
      const price = Number(item.price || 0);
      return { ...item, amount: quantity * price };
    }
    return item;
  });
  
  const totalQuantity = processedGoods.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const totalAmount = processedGoods.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const gstAmount = processedGoods.reduce((sum, item) => sum + Number(item.amount || 0) * (parseFloat(item.gstRate || 0) / 100), 0);
  const grandTotal = totalAmount + gstAmount;
  
  // For quotations, we don't calculate rounding - only exact totals
  return { 
    totalQuantity, 
    totalAmount, 
    gstAmount, 
    grandTotal
  };
}

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

// --- Ticket Payloads and Utilities ---

const getInitialTicketPayload = (userId = "", client = null) => ({
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

// Function to recalculate ticket totals
function recalculateTicketTotals(ticket) {
  const totalQuantity = ticket.goods.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const totalAmount = ticket.goods.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  // GST breakdown and totals can be more complex, but here's a simple version:
  const gstAmount = ticket.goods.reduce((sum, item) => sum + Number(item.amount || 0) * (parseFloat(item.gstRate || 0) / 100), 0);
  const grandTotal = totalAmount + gstAmount;
  
  // Always calculate round off values
  const exactGrandTotal = grandTotal;
  const roundedTotal = Math.round(exactGrandTotal);
  const roundOffAmount = roundedTotal - exactGrandTotal;
  const roundOffDirection = roundOffAmount >= 0 ? 'up' : 'down';
  
  return { 
    totalQuantity, 
    totalAmount, 
    finalGstAmount: gstAmount, 
    grandTotal: exactGrandTotal, 
    roundOff: roundOffAmount,
    roundOffDirection,
    finalRoundedAmount: roundedTotal
  };
}

// Map a quotation payload to a ticket payload
function mapQuotationToTicketPayload(quotation, userId = "") {
  // Generate a unique ticket number using centralized function
  const ticketNumber = generateTicketNumber();
  
  // Set deadline to 30 days from now by default
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + 30);
  
  return {
    ...getInitialTicketPayload(userId, quotation.client),
    ticketNumber,
    deadline,
    companyName: quotation.client?.companyName || "",
    quotationNumber: quotation.referenceNumber,
    client: quotation.client?._id || null,
    clientPhone: quotation.client?.phone || "",
    clientGstNumber: quotation.client?.gstNumber || "",
    billingAddress: { ...quotation.billingAddress },
    shippingAddress: { ...quotation.shippingAddress },
    shippingSameAsBilling: quotation.shippingSameAsBilling || false,
    goods: quotation.goods?.map((g, idx) => ({ ...g, srNo: idx + 1 })) || [],
    totalQuantity: quotation.totalQuantity,
    totalAmount: quotation.totalAmount,
    finalGstAmount: quotation.gstAmount,
    grandTotal: quotation.grandTotal,
    roundOff: quotation.roundingDifference || (quotation.roundOffTotal - Math.floor(quotation.grandTotal || 0)),
    roundOffDirection: quotation.roundingDirection || 'up',
    finalRoundedAmount: quotation.roundOffTotal || Math.round(quotation.grandTotal || 0),
    status: "Quotation Sent",
    dispatchDays: "7-10 working days",
  };
}

module.exports = {
  // Quotation utilities
  getInitialQuotationPayload,
  recalculateQuotationTotals,
  
  // Item utilities
  getInitialItemPayload,
  normalizeItemPayload,
  STANDARD_UNITS,
  
  // Ticket utilities
  getInitialTicketPayload,
  recalculateTicketTotals,
  mapQuotationToTicketPayload
};
