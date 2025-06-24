const mongoose = require("mongoose");

const ticketSchema = new mongoose.Schema({}, { strict: false }); // Placeholder if Ticket model is complex or just for ObjectId

const clientSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
    },
    clientName: {
      // Name of the contact person at the client company
      type: String,
      trim: true,
    },
    companyName: {
      type: String,
      required: true,
      trim: true,
    },

    // add client name
    gstNumber: {
      type: String,
      required: true,
      uppercase: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    quotations: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Quotation",
      },
    ], // Quotations associated with this client
    tickets: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Ticket", // Tickets associated with this client
      },
    ],
  },
  { timestamps: true }
);

clientSchema.index({
  companyName: "text",
  clientName: "text",
  gstNumber: "text",
  email: "text",
});

// clientSchema.index({ user: 1, email: 1 }, { unique: true });
// clientSchema.index({ user: 1, gstNumber: 1}, {unique: true});
module.exports = mongoose.model("Client", clientSchema);
