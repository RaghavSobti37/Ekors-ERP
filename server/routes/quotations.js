const express = require('express');
const router = express.Router();
const Quotation = require('../models/quotation');
const Client = require('../models/client');
const Ticket = require('../models/opentickets');

// Create new quotation
router.post('/quotations', async (req, res) => {
    try {
        // Validate required fields
        if (!req.body.companyName || !req.body.referenceNumber) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        // Create/update client
        const client = await Client.findOneAndUpdate(
            { email: req.body.email },
            {
                companyName: req.body.companyName,
                gstNumber: req.body.gstNumber,
                phone: req.body.phone,
                billingAddress: req.body.billingAddress,
                shippingAddress: req.body.shippingAddress,
                bankDetails: req.body.bankDetails
            },
            { upsert: true, new: true }
        );

        // Create quotation
        const quotation = new Quotation({
            ...req.body,
            client: client._id
        });

        const savedQuotation = await quotation.save();
        res.status(201).json(savedQuotation);
    } catch (error) {
        console.error('Error creating quotation:', error);
        res.status(500).json({ 
            message: 'Error creating quotation',
            error: error.message 
        });
    }
});

// Get all quotations
router.get('/quotations', async (req, res) => {
    try {
        const quotations = await Quotation.find()
            .populate('client', 'companyName gstNumber billingAddress shippingAddress')
            .sort({ date: -1 });
        res.json(quotations);
    } catch (error) {
        res.status(500).json({ 
            message: 'Error fetching quotations',
            error: error.message 
        });
    }
});

// Create ticket from quotation
router.post('/quotations/:id/create-ticket', async (req, res) => {
    try {
        const quotation = await Quotation.findById(req.params.id).populate('client');
        if (!quotation) {
            return res.status(404).json({ message: 'Quotation not found' });
        }

        const ticketData = {
            companyName: quotation.client.companyName,
            quotationNumber: quotation.referenceNumber,
            billingAddress: quotation.client.billingAddress,
            shippingAddress: quotation.client.shippingAddress,
            goods: quotation.goods,
            totalQuantity: quotation.totalQuantity,
            totalAmount: quotation.totalAmount,
            gstAmount: quotation.gstAmount,
            grandTotal: quotation.grandTotal,
            status: "Quotation Sent"
        };

        const ticket = new Ticket(ticketData);
        const savedTicket = await ticket.save();
        
        res.status(201).json(savedTicket);
    } catch (error) {
        res.status(500).json({ 
            message: 'Error creating ticket',
            error: error.message 
        });
    }
});

module.exports = router;