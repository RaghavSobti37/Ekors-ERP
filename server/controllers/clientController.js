const Client = require('../models/client'); // Adjust path if your model is elsewhere
const logger = require('../utils/logger'); // Assuming you have a logger utility

// Search clients with role-based access
exports.searchClients = async (req, res) => {
  try {
    const searchTerm = req.query.q || '';
    const { _id: userId, role: userRole } = req.user; // From auth middleware

    if (!searchTerm.trim() || searchTerm.trim().length < 1) {
      return res.json([]);
    }

    const searchConditions = {
      $or: [
        { companyName: { $regex: searchTerm, $options: 'i' } },
        { clientName: { $regex: searchTerm, $options: 'i' } },
        { email: { $regex: searchTerm, $options: 'i' } },
        { gstNumber: { $regex: searchTerm, $options: 'i' } }
      ]
    };

    let finalQuery = {};

// Define the filter for clients created by the current user.
    // Based on the current model, 'user' field indicates the creator.
    // If "assigned to" is a separate concept, the Client model and this filter would need an update.
    const ownerFilter = { user: userId };

    if (userRole === 'super-admin') {
      finalQuery = searchConditions; // Super-admins see all matching clients
    } else if (userRole === 'admin') {
      // Admins are now also restricted to clients they created.
      // If admins should see all clients, this should be: finalQuery = searchConditions;
      finalQuery = {
        $and: [
          searchConditions,
                  ownerFilter

        ]
      };
   } else if (userRole === 'user') {
      finalQuery = {
        $and: [
          searchConditions,
          ownerFilter // 'user' role sees only their created clients
        ]
      };    } else {
      // Fallback for any other roles (if any) - restrict to their own clients
      // Or, you could return res.status(403).json({ message: 'Access denied.' });
      logger.warn('client_search', `User with unhandled role '${userRole}' attempted to search clients.`, { userId });
      finalQuery = {
        $and: [
          searchConditions,
                    ownerFilter
        ]
      };
    }

    const clients = await Client.find(finalQuery)
      .select('companyName clientName email gstNumber phone _id')
      .limit(10);

    res.json(clients);
  } catch (error) {
    logger.error("Error searching clients:", error.message, { stack: error.stack, userId: req.user?._id });
    res.status(500).json({ message: 'Error searching clients', error: error.message });
  }
};

// Create or find and update client
exports.createOrUpdateClient = async (req, res) => {
  try {
    const { email, companyName, clientName, gstNumber, phone } = req.body;
    const userId = req.user._id; // From auth middleware

    if (!email || !companyName || !gstNumber || !phone) {
      return res.status(400).json({ message: 'All client fields (Company Name, GST Number, Email, Phone) are required.' });
    }

    const normalizedEmail = email.toLowerCase();
    const normalizedGstNumber = gstNumber.toUpperCase();

    // Check for existing client by email for this user
    let client = await Client.findOne({ email: normalizedEmail, user: userId });

    if (client) {
      // Client with this email already exists for this user. Update it.
      // Ensure GST doesn't conflict if it's being changed.
      if (client.gstNumber.toUpperCase() !== normalizedGstNumber) {
        const gstConflict = await Client.findOne({ gstNumber: normalizedGstNumber, user: userId, _id: { $ne: client._id } });
        if (gstConflict) {
          return res.status(400).json({ message: 'GST Number already exists for another of your clients.', field: 'gstNumber' });
        }
      }
      const updatedClient = await Client.findByIdAndUpdate(client._id,
        { companyName, clientName, gstNumber: normalizedGstNumber, phone, email: normalizedEmail },
        { new: true, runValidators: true }
      );
      logger.info('client_update', `Client updated successfully for user ${userId}`, { clientId: updatedClient._id });
      return res.status(200).json(updatedClient);
    }

    // No client with this email for this user, check for GST conflict before creating new
    const gstClient = await Client.findOne({ gstNumber: normalizedGstNumber, user: userId });
    if (gstClient) {
      return res.status(400).json({ message: 'GST Number already exists for another of your clients.', field: 'gstNumber' });
    }

    const newClient = new Client({
      email: normalizedEmail,
      companyName,
      clientName,
      gstNumber: normalizedGstNumber,
      phone,
      user: userId // Link client to the user creating it
    });

    await newClient.save();
    logger.info('client_create', `New client created successfully by user ${userId}`, { clientId: newClient._id });
    res.status(201).json(newClient);
  } catch (error) {
    logger.error("Error in POST /api/clients:", error.message, { stack: error.stack, userId: req.user?._id, body: req.body });
    if (error.code === 11000) {
      // MongoDB unique index violation
      if (error.message.includes('email_1_user_1')) { // Adjust index name if different
        return res.status(400).json({ message: 'This email is already registered to one of your clients.', field: 'email' });
      }
      if (error.message.includes('gstNumber_1_user_1')) { // Adjust index name if different
        return res.status(400).json({ message: 'This GST Number is already registered to one of your clients.', field: 'gstNumber' });
      }
    }
    res.status(500).json({ message: 'Error creating or updating client', error: error.message });
  }
};
