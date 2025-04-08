const mongoose = require('mongoose');

const purchaseSchema = new mongoose.Schema({
  companyName: String,
  gstNumber: String,
  address: String,
  stateName: String,
  invoiceNumber: String,
  date: Date,
  items: [{
    srNo: Number,
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Item',
    },
    itemName: String,
    description: String,
    price: Number,
    quantity: Number
  }]
});

module.exports = mongoose.model('Purchase', purchaseSchema);
