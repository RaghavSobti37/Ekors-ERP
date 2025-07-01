require('dotenv').config();
const mongoose = require('mongoose');
const Client = require('./models/client'); // Adjust path if needed

async function migrateClients() {
  await mongoose.connect(process.env.MONGO_URI, {});

  const clients = await Client.find({});
  let updatedCount = 0;
  let skippedCount = 0;

  for (const client of clients) {
    let needsUpdate = false;

    // Ensure email is lowercase
    if (client.email && client.email !== client.email.toLowerCase()) {
      client.email = client.email.toLowerCase();
      needsUpdate = true;
    }

    // Ensure gstNumber is uppercase
    if (client.gstNumber && client.gstNumber !== client.gstNumber.toUpperCase()) {
      client.gstNumber = client.gstNumber.toUpperCase();
      needsUpdate = true;
    }

    // Ensure clientName exists (required in new schema)
    if (!client.clientName) {
      client.clientName = ""; // Or set to companyName, or "Unknown"
      needsUpdate = true;
    }

    // Ensure phone exists (required in new schema)
    if (!client.phone) {
      client.phone = "0000000000"; // Or set to a default, or log for manual fix
      needsUpdate = true;
    }

    // Ensure companyName exists (should already be required)
    if (!client.companyName) {
      client.companyName = "Unknown Company";
      needsUpdate = true;
    }

    // Ensure user exists (should already be required)
    if (!client.user) {
      console.warn(`Client ${client._id} missing user. Skipping update.`);
      skippedCount++;
      continue;
    }

    if (needsUpdate) {
      await client.save();
      updatedCount++;
      console.log(`Updated client: ${client._id}`);
    }
  }

  console.log(`Migration complete. Updated: ${updatedCount}, Skipped: ${skippedCount}`);
  await mongoose.disconnect();
}

migrateClients().catch(err => {
  console.error(err);
  process.exit(1);
});