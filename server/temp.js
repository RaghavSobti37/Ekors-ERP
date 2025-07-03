require('dotenv').config();
const mongoose = require('mongoose');
const Ticket = require('./models/opentickets');

function arrayToAddressObj(address) {
  if (Array.isArray(address)) {
    // [address1, address2, state, city, pincode]
    return {
      address1: address[0] || "",
      address2: address[1] || "",
      state: address[2] || "",
      city: address[3] || "",
      pincode: address[4] || "",
    };
  }
  if (typeof address === "object" && address !== null) {
    // Already an object, just normalize keys
    return {
      address1: address.address1 || "",
      address2: address.address2 || "",
      state: address.state || "",
      city: address.city || "",
      pincode: address.pincode || "",
    };
  }
  return { address1: "", address2: "", state: "", city: "", pincode: "" };
}

async function migrateTicketAddresses() {
  await mongoose.connect(process.env.MONGO_URI, {});

  const tickets = await Ticket.find({});
  let updatedCount = 0;

  for (const ticket of tickets) {
    let changed = false;

    // Billing Address
    if (Array.isArray(ticket.billingAddress)) {
      ticket.billingAddress = arrayToAddressObj(ticket.billingAddress);
      changed = true;
    } else if (typeof ticket.billingAddress === "object" && ticket.billingAddress !== null) {
      // Normalize keys
      const normalized = arrayToAddressObj(ticket.billingAddress);
      if (JSON.stringify(ticket.billingAddress) !== JSON.stringify(normalized)) {
        ticket.billingAddress = normalized;
        changed = true;
      }
    }

    // Shipping Address
    if (Array.isArray(ticket.shippingAddress)) {
      ticket.shippingAddress = arrayToAddressObj(ticket.shippingAddress);
      changed = true;
    } else if (typeof ticket.shippingAddress === "object" && ticket.shippingAddress !== null) {
      // Normalize keys
      const normalized = arrayToAddressObj(ticket.shippingAddress);
      if (JSON.stringify(ticket.shippingAddress) !== JSON.stringify(normalized)) {
        ticket.shippingAddress = normalized;
        changed = true;
      }
    }

    if (changed) {
      await ticket.save();
      updatedCount++;
      console.log(`Updated ticket ${ticket._id}`);
    }
  }

  await mongoose.disconnect();
  console.log(`Migration complete. Updated ${updatedCount} tickets.`);
}

migrateTicketAddresses().catch(err => {
  console.error(err);
  process.exit(1);
});