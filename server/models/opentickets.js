const mongoose = require('mongoose');

// Function to generate a unique 6-digit ticket number
const generateTicketNumber = () => {
    return `T-${Math.floor(100000 + Math.random() * 900000)}`;
};

const openticketSchema = new mongoose.Schema({
    ticketNumber: { type: String, default: generateTicketNumber, unique: true },
    quotationNumber: { type: String, required: true },
    date: { type: Date, default: Date.now },
    billingAddress: { type: String, required: true },
    shippingAddress: { type: String, required: true },

    goods: [
        {
            srNo: { type: Number, required: true },
            description: { type: String, required: true },
            hsnSacCode: { type: String, required: true },
            quantity: { type: Number, required: true },
            price: { type: Number, required: true },
            amount: { type: Number, required: true }
        }
    ],

    totalQuantity: { type: Number, required: true },
    totalAmount: { type: Number, required: true },

    gstRate: { type: Number, default: 18 }, // Default IGST 18%
    gstAmount: { type: Number, required: true },
    grandTotal: { type: Number, required: true },

    status: {
        type: String,
        enum: ['Quotation Sent', 'PO Received', 'Payment Pending', 'Inspection', 'Packing List', 'Invoice Sent', 'Completed'],
        default: 'Quotation Sent'
    }
});

const OpenticketModel = mongoose.model("OpenTicket", openticketSchema);
module.exports = OpenticketModel;
