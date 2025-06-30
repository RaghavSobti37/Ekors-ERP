require('dotenv').config();
const mongoose = require('mongoose');

const { STANDARD_UNITS } = require('./models/itemlist');
const Quotation = require('./models/quotation');
const Ticket = require('./models/opentickets');

const VALID_TICKET_STATUSES = [
  "Quotation Sent", "PO Received", "Payment Pending", "Inspection",
  "Packing List", "Invoice Sent", "Hold", "Closed"
];
const VALID_QUOTATION_STATUSES = ['open', 'closed', 'hold', 'running'];

function cleanAddress(addr) {
  // If it's an array or not an object, return empty address object
  if (!addr || typeof addr !== 'object' || Array.isArray(addr)) {
    return {
      address1: '', address2: '', city: '', state: '', pincode: ''
    };
  }
  return {
    address1: typeof addr.address1 === 'string' ? addr.address1 : '',
    address2: typeof addr.address2 === 'string' ? addr.address2 : '',
    city: typeof addr.city === 'string' ? addr.city : '',
    state: typeof addr.state === 'string' ? addr.state : '',
    pincode: typeof addr.pincode === 'string' ? addr.pincode : ''
  };
}

function cleanGoods(goods) {
  return (goods || []).map(good => {
    const cleaned = {};

    // Always set a non-empty hsnCode (fallback to 'NA' if missing/empty)
    let hsn = (good.hsnCode || good.hsnSacCode || '').toString().trim();
    if (!hsn) hsn = 'NA';
    cleaned.hsnCode = hsn;

    cleaned.srNo = typeof good.srNo === 'number' ? good.srNo : 0;
    cleaned.description = good.description || '';
    cleaned.subtexts = Array.isArray(good.subtexts) ? good.subtexts : [];
    cleaned.quantity = typeof good.quantity === 'number' ? good.quantity : 0;
    cleaned.unit = STANDARD_UNITS.includes(good.unit) ? good.unit : 'nos';
    cleaned.price = typeof good.price === 'number' ? good.price : 0;
    cleaned.amount = typeof good.amount === 'number' ? good.amount : 0;
    cleaned.gstRate = typeof good.gstRate === 'number' ? good.gstRate : 0;
    cleaned.originalPrice = typeof good.originalPrice === 'number' ? good.originalPrice : cleaned.price;
    cleaned.maxDiscountPercentage = typeof good.maxDiscountPercentage === 'number' ? good.maxDiscountPercentage : 0;
    cleaned.sellingPrice = typeof good.sellingPrice === 'number' ? good.sellingPrice : cleaned.price;

    // Ensure originalItem is ObjectId or null
    if (good.originalItem && typeof good.originalItem === 'object' && good.originalItem._id) {
      cleaned.originalItem = good.originalItem._id;
    } else if (typeof good.originalItem === 'string') {
      cleaned.originalItem = good.originalItem;
    } else {
      cleaned.originalItem = null;
    }

    return cleaned;
  });
}

async function migrateQuotations() {
  const quotations = await Quotation.find({});
  for (const q of quotations) {
    let updated = false;

    // Clean goods
    if (Array.isArray(q.goods)) {
      const cleanedGoods = cleanGoods(q.goods);
      if (JSON.stringify(q.goods) !== JSON.stringify(cleanedGoods)) {
        q.goods = cleanedGoods;
        updated = true;
      }
    }

    // Ensure billingAddress is an object with correct keys
    if (q.billingAddress) {
      const cleanedAddr = cleanAddress(q.billingAddress);
      if (JSON.stringify(q.billingAddress) !== JSON.stringify(cleanedAddr)) {
        q.billingAddress = cleanedAddr;
        updated = true;
      }
    } else {
      q.billingAddress = cleanAddress();
      updated = true;
    }

    // Add roundOffTotal if missing
    if (typeof q.roundOffTotal !== 'number') {
      q.roundOffTotal = 0;
      updated = true;
    }

    // Ensure status is valid
    if (!VALID_QUOTATION_STATUSES.includes(q.status)) {
      q.status = 'open';
      updated = true;
    }

    // Remove deprecated/unknown fields at root
    Object.keys(q._doc).forEach(k => {
      if (![
        'user', 'orderIssuedBy', 'date', 'referenceNumber', 'validityDate',
        'billingAddress', 'goods', 'totalQuantity', 'totalAmount', 'gstAmount',
        'grandTotal', 'roundOffTotal', 'status', 'client', 'documents',
        'createdAt', 'updatedAt', '_id', '__v'
      ].includes(k)) {
        delete q[k];
        updated = true;
      }
    });

    if (updated) await q.save();
  }
}

async function migrateTickets() {
  const tickets = await Ticket.find({});
  for (const t of tickets) {
    let updated = false;

    // Clean goods
    if (Array.isArray(t.goods)) {
      const cleanedGoods = cleanGoods(t.goods);
      if (JSON.stringify(t.goods) !== JSON.stringify(cleanedGoods)) {
        t.goods = cleanedGoods;
        updated = true;
      }
    }

    // Ensure billingAddress and shippingAddress are objects
    if (t.billingAddress) {
      const cleanedAddr = cleanAddress(t.billingAddress);
      if (JSON.stringify(t.billingAddress) !== JSON.stringify(cleanedAddr)) {
        t.billingAddress = cleanedAddr;
        updated = true;
      }
    } else {
      t.billingAddress = cleanAddress();
      updated = true;
    }
    if (t.shippingAddress) {
      const cleanedAddr = cleanAddress(t.shippingAddress);
      if (JSON.stringify(t.shippingAddress) !== JSON.stringify(cleanedAddr)) {
        t.shippingAddress = cleanedAddr;
        updated = true;
      }
    } else {
      t.shippingAddress = cleanAddress();
      updated = true;
    }

    // Add roundOff and finalRoundedAmount if missing
    if (typeof t.roundOff !== 'number') {
      t.roundOff = 0;
      updated = true;
    }
    if (typeof t.finalRoundedAmount !== 'number') {
      t.finalRoundedAmount = (t.grandTotal || 0) + (t.roundOff || 0);
      updated = true;
    }

    // Ensure status is valid
    if (!VALID_TICKET_STATUSES.includes(t.status)) {
      t.status = 'Quotation Sent';
      updated = true;
    }

    // Remove deprecated/unknown fields at root
    Object.keys(t._doc).forEach(k => {
      if (![
        'ticketNumber', 'companyName', 'quotationNumber', 'client', 'clientPhone', 'clientGstNumber',
        'billingAddress', 'shippingAddress', 'shippingSameAsBilling', 'goods', 'totalQuantity',
        'totalAmount', 'gstBreakdown', 'totalCgstAmount', 'totalSgstAmount', 'totalIgstAmount',
        'finalGstAmount', 'grandTotal', 'roundOff', 'finalRoundedAmount', 'isBillingStateSameAsCompany',
        'status', 'documents', 'statusHistory', 'createdBy', 'currentAssignee', 'deadline',
        'assignedTo', 'transferHistory', 'assignmentLog', 'dispatchDays', 'createdAt', 'updatedAt', '_id', '__v'
      ].includes(k)) {
        delete t[k];
        updated = true;
      }
    });

    if (updated) await t.save();
  }
}

const runMigration = async () => {
  await mongoose.connect(process.env.MONGO_URI, {});

  await migrateQuotations();
  await migrateTickets();

  console.log('Full migration complete!');
  mongoose.disconnect();
};

runMigration().catch(err => {
  console.error('Migration failed:', err);
  mongoose.disconnect();
});