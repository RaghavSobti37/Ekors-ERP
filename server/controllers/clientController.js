const Client = require('../models/client'); // Adjust path if your model is elsewhere
const logger = require('../utils/logger'); // Assuming you have a logger utility
const Quotation = require('../models/quotation'); // Assuming model name
const Ticket = require('../models/opentickets');     // Assuming model name
const User = require('../models/users'); 
const UniversalBackup = require('../models/universalBackup');
const mongoose = require('mongoose');


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

        // Allow 'super-admin', 'admin', and 'user' roles to search all clients
    // If other roles should also have this ability, they can be added here.
    if (userRole === 'super-admin' || userRole === 'admin' || userRole === 'user') {

      finalQuery = searchConditions; // Super-admins and Admins see all matching clients
      } else {
      // For any other roles not explicitly handled, deny access.
      // This maintains security for unrecognised or restricted roles.



return res.status(403).json({ message: 'Access denied for your role.' });
    }

    const clients = await Client.find(finalQuery)
 .select('companyName clientName email gstNumber phone _id user')
      .populate('user', 'firstname lastname email')      .limit(10);

    res.json(clients);
  } catch (error) {
    res.status(500).json({ message: 'Error searching clients', error: error.message });
  }
};

// Create a new client (POST /api/clients)
exports.createClient = async (req, res) => {
  try {
    const { email, companyName, clientName, gstNumber, phone } = req.body;
    const userId = req.user._id; // From auth middleware

    if (!email || !companyName || !gstNumber || !phone) {
      return res.status(400).json({ message: 'All client fields (Company Name, GST Number, Email, Phone) are required.' });
    }

    const normalizedEmail = email.toLowerCase();
    const normalizedGstNumber = gstNumber.toUpperCase();

    let existingClient = await Client.findOne({
      $or: [{ email: normalizedEmail }, { gstNumber: normalizedGstNumber }],
      user: userId
    });

    if (existingClient) {
      if (existingClient.email === normalizedEmail) {
        return res.status(400).json({ message: 'This email is already registered to one of your clients.', field: 'email' });
      }
      if (existingClient.gstNumber === normalizedGstNumber) {
        return res.status(400).json({ message: 'This GST Number is already registered to one of your clients.', field: 'gstNumber' });
      }    }

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

    if (error.code === 11000) {
      // MongoDB unique index violation
      if (error.message.includes('email_1_user_1')) { // Adjust index name if different
        return res.status(400).json({ message: 'This email is already registered to one of your clients.', field: 'email' });
      }
      if (error.message.includes('gstNumber_1_user_1')) { // Adjust index name if different
        return res.status(400).json({ message: 'This GST Number is already registered to one of your clients.', field: 'gstNumber' });
      }
     return res.status(400).json({ message: 'Client with this email or GST number already exists for you.', field: error.keyPattern.email ? 'email' : 'gstNumber' });
    }
    res.status(500).json({ message: 'Error creating client', error: error.message });
  }
};

// Get all clients (for admin/super-admin dashboard view)
// GET /api/clients
exports.getAllClientsForDashboard = async (req, res) => {
    try {
        const { _id: userId, role: userRole } = req.user;
        const { page = 1, limit = 10, search = '', sortBy = 'companyName', order = 'asc' } = req.query;

        let query = {};
        if (search) {
            query.$or = [
                { companyName: { $regex: search, $options: 'i' } },
                { clientName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { gstNumber: { $regex: search, $options: 'i' } },
            ];
        }

        if (userRole === 'user') {
            query.user = userId;
        }
        // Admins and Super-admins see all clients (no additional user filter)

        const clients = await Client.find(query)
            .populate('user', 'firstname lastname') // Creator
            .populate({
                path: 'quotations',
                select: 'status grandTotal' // Select necessary fields
            })
            .populate({
                path: 'tickets',
                select: 'status grandTotal' // Select necessary fields
            })
            .sort({ [sortBy]: order === 'desc' ? -1 : 1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const totalClients = await Client.countDocuments(query);

        const clientsWithStats = clients.map(client => {
            const clientObj = client.toObject();
            clientObj.quotationStats = {
                total: clientObj.quotations.length,
                open: clientObj.quotations.filter(q => q.status === 'open').length,
                closed: clientObj.quotations.filter(q => q.status === 'closed').length,
            };
            clientObj.ticketStats = {
                total: clientObj.tickets.length,
                open: clientObj.tickets.filter(t => t.status !== 'Closed').length,
                closed: clientObj.tickets.filter(t => t.status === 'Closed').length,
            };
            return clientObj;
        });

        res.json({
            clients: clientsWithStats,
            totalPages: Math.ceil(totalClients / limit),
            currentPage: parseInt(page),
            totalClients
        });

    } catch (error) {
        res.status(500).json({ message: 'Error fetching clients', error: error.message });
    }
};

// Get a single client by ID (for ViewClientPage)
// GET /api/clients/:id
exports.getClientById = async (req, res) => {
    try {
        const { id } = req.params;
        const { _id: userId, role: userRole } = req.user;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid client ID' });
        }

        const client = await Client.findById(id)
            .populate('user', 'firstname lastname email')
            .populate({
                path: 'quotations',
                select: 'referenceNumber date status grandTotal createdAt',
                options: { sort: { createdAt: -1 } }
            })
            .populate({
                path: 'tickets',
                select: 'ticketNumber status grandTotal createdAt deadline',
                options: { sort: { createdAt: -1 } }
            });

        if (!client) {
            return res.status(404).json({ message: 'Client not found' });
        }

        if (userRole !== 'super-admin' && userRole !== 'admin' && client.user._id.toString() !== userId.toString()) {
            return res.status(403).json({ message: 'Access denied. You can only view your own clients.' });
        }
        
        const clientObj = client.toObject();
        clientObj.quotationStats = {
            total: clientObj.quotations.length,
            open: clientObj.quotations.filter(q => q.status === 'open').length,
            closed: clientObj.quotations.filter(q => q.status === 'closed').length,
        };
        clientObj.ticketStats = {
            total: clientObj.tickets.length,
            open: clientObj.tickets.filter(t => t.status !== 'Closed').length,
            closed: clientObj.tickets.filter(t => t.status === 'Closed').length,
        };
        res.json(clientObj);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching client details', error: error.message });
    }
};

// Update a client (PUT /api/clients/:id)
exports.updateClient = async (req, res) => {
    try {
        const { id } = req.params;
        const { email, companyName, clientName, gstNumber, phone } = req.body;
        const { _id: currentUserId, role: currentUserRole } = req.user;

        if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid client ID' });
        let clientToUpdate = await Client.findById(id);
        if (!clientToUpdate) return res.status(404).json({ message: 'Client not found' });

        if (currentUserRole !== 'super-admin' && clientToUpdate.user.toString() !== currentUserId.toString()) {
            return res.status(403).json({ message: 'Access Denied. You are not authorized to update this client.' });
        }

        const normalizedEmail = email ? email.toLowerCase() : clientToUpdate.email;
        const normalizedGstNumber = gstNumber ? gstNumber.toUpperCase() : clientToUpdate.gstNumber;

        if (email && normalizedEmail !== clientToUpdate.email) {
            const existing = await Client.findOne({ email: normalizedEmail, user: clientToUpdate.user, _id: { $ne: id } });
            if (existing) return res.status(400).json({ message: 'This email is already registered to another client of the same owner.', field: 'email' });
        }
        if (gstNumber && normalizedGstNumber !== clientToUpdate.gstNumber) {
            const existing = await Client.findOne({ gstNumber: normalizedGstNumber, user: clientToUpdate.user, _id: { $ne: id } });
            if (existing) return res.status(400).json({ message: 'This GST Number is already registered to another client of the same owner.', field: 'gstNumber' });
        }

        clientToUpdate.companyName = companyName || clientToUpdate.companyName;
        clientToUpdate.clientName = clientName || clientToUpdate.clientName;
        clientToUpdate.email = normalizedEmail;
        clientToUpdate.gstNumber = normalizedGstNumber;
        clientToUpdate.phone = phone || clientToUpdate.phone;

        const updatedClient = await clientToUpdate.save();
        logger.info('client_update', `Client ${id} updated successfully by user ${currentUserId}`, { clientId: updatedClient._id });
        res.json(updatedClient);
    } catch (error) {
        if (error.code === 11000) return res.status(400).json({ message: 'Update failed due to a conflict with an existing client (email or GST).', field: error.keyPattern.email ? 'email' : 'gstNumber' });
        res.status(500).json({ message: 'Error updating client', error: error.message });
    }
};

// Delete a client (DELETE /api/clients/:id)
exports.deleteClient = async (req, res) => {
    const session = await mongoose.startSession(); // Start a session for transaction
    session.startTransaction();
    try {

        const { id } = req.params;
        const { _id: userId, role: userRole } = req.user;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: 'Invalid client ID' });
        }
        if (userRole !== 'super-admin') {
            await session.abortTransaction();
            session.endSession();
            return res.status(403).json({ message: 'Access Denied. Only super-admins can delete clients.' });
        }

        const client = await Client.findById(id).session(session);
        if (!client) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: 'Client not found' });
        }

        // Log if client has linked items for audit purposes if needed.
        const linkedQuotationsCount = client.quotations?.length || 0;
        const linkedTicketsCount = client.tickets?.length || 0;


 // Create a backup entry
        const backupData = new UniversalBackup({
            originalId: client._id,
            originalModel: 'Client',
            data: client.toObject(), // Store the full client document
            deletedBy: userId,
            // backupReason: `Client deleted by super-admin ${userRole}`, // Or a more specific reason if provided
            originalCreatedAt: client.createdAt,
            originalUpdatedAt: client.updatedAt,
        });
        await backupData.save({ session });

        await Client.findByIdAndDelete(id).session(session);

        await session.commitTransaction();
        session.endSession();

        logger.info('client_delete', `Client ${id} backed up and deleted by user ${userId}. Linked Quotations: ${linkedQuotationsCount}, Linked Tickets: ${linkedTicketsCount}`, { clientId: id, userId: userId, backupId: backupData._id });        res.json({ message: 'Client deleted successfully' });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        res.status(500).json({ message: 'Error deleting client', error: error.message });
    }
};
