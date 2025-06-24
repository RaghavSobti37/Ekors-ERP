const express = require('express');
const router = express.Router();
const companyController = require('../controllers/companyController');
const authMiddleware = require('../middleware/auth');
const { isSuperAdmin } = require('../middleware/roleMiddleware');

// PUBLIC ROUTE for PDFs
// @route   GET /api/company/default
// @desc    Get the single default company's information
router.get('/default', companyController.getDefaultCompany);

// SUPER-ADMIN ONLY ROUTES
const adminOnly = [authMiddleware, isSuperAdmin];

// @route   POST /api/company
// @desc    Create a new company
router.post('/', adminOnly, companyController.createCompany);

// @route   GET /api/company
// @desc    Get all companies
router.get('/', adminOnly, companyController.getCompanies);

// @route   PUT /api/company/:id/field
// @desc    Update a specific field for a company
router.put('/:id/field', adminOnly, companyController.updateCompanyField);

// @route   DELETE /api/company/:id/field
// @desc    Delete a specific field for a company
router.delete('/:id/field', adminOnly, companyController.deleteCompanyField);

// @route   PATCH /api/company/:id/set-default
// @desc    Set a company as the default
router.patch('/:id/set-default', adminOnly, companyController.setDefaultCompany);

// @route   DELETE /api/company/:id
// @desc    Delete an entire company document
router.delete('/:id', adminOnly, companyController.deleteCompany);

module.exports = router;
