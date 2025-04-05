const express = require('express');
const router = express.Router();
const Quotation = require('../models/quotation');
const Client = require('../models/client');
const Ticket = require('../models/opentickets');

// Create new quotation
router.put('/quotations/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { client, ...quotationData } = req.body;

        // Update or create client
        const updatedClient = await Client.findOneAndUpdate(
            { email: client.email },
            client,
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        // Update quotation
        const updatedQuotation = await Quotation.findByIdAndUpdate(
            id,
            {
                ...quotationData,
                client: updatedClient._id,
            },
            { new: true }
        ).populate('client');

        res.status(200).json(updatedQuotation);
    } catch (error) {
        res.status(500).json({ message: 'Error updating quotation', error: error.message });
    }
});

// Create or update quotation
const handleQuotationUpsert = async (req, res) => {
    try {
      const { client, ...quotationData } = req.body;
      const { id } = req.params;
  
      // Validate required fields
      if (!quotationData.referenceNumber || !client?.email) {
        return res.status(400).json({ message: 'Missing required fields' });
      }
  
      // Check reference number uniqueness
      const refCheck = await Quotation.findOne({
        referenceNumber: quotationData.referenceNumber,
        ...(id && { _id: { $ne: id } })
      });
  
      if (refCheck) {
        return res.status(400).json({ message: 'Reference number already exists' });
      }
  
      // Upsert client
      const savedClient = await Client.findOneAndUpdate(
        { email: client.email },
        client,
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
  
      // Prepare quotation data
      const data = {
        ...quotationData,
        date: new Date(quotationData.date),
        validityDate: new Date(quotationData.validityDate),
        client: savedClient._id
      };
  
      let quotation;
      if (id) {
        quotation = await Quotation.findByIdAndUpdate(id, data, { new: true });
      } else {
        quotation = new Quotation(data);
        await quotation.save();
      }
  
      const populated = await Quotation.findById(quotation._id).populate('client');
      res.status(id ? 200 : 201).json(populated);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  };

  router.post('/', handleQuotationUpsert);
router.put('/:id', handleQuotationUpsert);

  
router.post('/quotations', async (req, res) => {
    try {
        const { client, ...quotationData } = req.body;

        // Validate required fields
        if (!quotationData.referenceNumber || !client.email) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        // Create/update client
        const savedClient = await Client.findOneAndUpdate(
            { email: client.email },
            client,
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        // Create quotation
        const quotation = new Quotation({
            ...quotationData,
            client: savedClient._id,
        });

        const savedQuotation = await quotation.save();
        const populatedQuotation = await Quotation.findById(savedQuotation._id).populate('client');

        res.status(201).json(populatedQuotation);
    } catch (error) {
        res.status(500).json({ message: 'Error creating quotation', error: error.message });
    }
});

// Update quotation
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { client, ...quotationData } = req.body;

        // Check if reference number is being changed and if it already exists
        if (quotationData.referenceNumber) {
            const existing = await Quotation.findOne({ 
                referenceNumber: quotationData.referenceNumber,
                _id: { $ne: id } // Exclude current quotation from check
            });
            if (existing) {
                return res.status(400).json({ message: 'Reference number already exists' });
            }
        }

        // Update or create client
        let updatedClient;
        if (client && client.email) {
            updatedClient = await Client.findOneAndUpdate(
                { email: client.email },
                client,
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
        }

        // Prepare update data
        const updateData = {
            ...quotationData,
            date: new Date(quotationData.date),
            validityDate: new Date(quotationData.validityDate)
        };

        if (updatedClient) {
            updateData.client = updatedClient._id;
        }

        // Update quotation
        const updatedQuotation = await Quotation.findByIdAndUpdate(
            id,
            updateData,
            { new: true }
        ).populate('client');

        if (!updatedQuotation) {
            return res.status(404).json({ message: 'Quotation not found' });
        }

        res.status(200).json(updatedQuotation);
    } catch (error) {
        res.status(500).json({ 
            message: 'Error updating quotation', 
            error: error.message 
        });
    }
});


// Get all quotations
router.get('/quotations', async (req, res) => {
    try {
        const quotations = await Quotation.find()
            .populate('client', 'companyName gstNumber email phone billingAddress shippingAddress bankDetails')
            .sort({ date: -1 });
        res.json(quotations);
    } catch (error) {
        res.status(500).json({ 
            message: 'Error fetching quotations',
            error: error.message 
        });
    }
});

// // Create ticket from quotation
// router.post('/quotations/:id/create-ticket', async (req, res) => {
//     try {
//         const quotation = await Quotation.findById(req.params.id).populate('client');
//         if (!quotation) {
//             return res.status(404).json({ message: 'Quotation not found' });
//         }

//         const ticketData = {
//             companyName: quotation.client.companyName,
//             quotationNumber: quotation.referenceNumber,
//             billingAddress: quotation.client.billingAddress,
//             shippingAddress: quotation.client.shippingAddress,
//             goods: quotation.goods,
//             totalQuantity: quotation.totalQuantity,
//             totalAmount: quotation.totalAmount,
//             gstAmount: quotation.gstAmount,
//             grandTotal: quotation.grandTotal,
//             status: "Quotation Sent"
//         };

//         const ticket = new Ticket(ticketData);
//         const savedTicket = await ticket.save();
        
//         res.status(201).json(savedTicket);
//     } catch (error) {
//         res.status(500).json({ 
//             message: 'Error creating ticket',
//             error: error.message 
//         });
//     }
// });

// Check reference number availability
router.get('/check-reference', async (req, res) => {
    try {
      const { referenceNumber, excludeId } = req.query;
      const query = { referenceNumber };
      
      if (excludeId) {
        query._id = { $ne: excludeId };
      }
  
      const existing = await Quotation.findOne(query);
      res.json({ exists: !!existing });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

// Update your PUT endpoint to handle reference number changes
router.put('/:id', async (req, res) => {
    try {
      const { referenceNumber } = req.body;
      const quotation = await Quotation.findById(req.params.id);
      
      // If reference number is being changed
      if (referenceNumber && quotation.referenceNumber !== referenceNumber) {
        const existing = await Quotation.findOne({ referenceNumber });
        if (existing) {
          return res.status(400).json({ message: 'Reference number already exists' });
        }
      }
  
      const updatedQuotation = await Quotation.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true }
      );
      res.json(updatedQuotation);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

module.exports = router;