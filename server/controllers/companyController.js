const CompanyInfo = require('../models/companyInfo');
const UniversalBackup = require('../models/universalBackup');

// Helper to get nested values, used for backing up deleted fields
const getNestedValue = (obj, path) => {
    if (!path || typeof path !== 'string') return undefined;
    return path.split('.').reduce((o, key) => (o && o[key] !== undefined ? o[key] : undefined), obj.toObject());
};

// POST /api/company - Create a new company
exports.createCompany = async (req, res) => {
    try {
        // Accept nested company object
        let companyData = req.body.company || req.body;
        // Convert contactNumbers to array if string
        if (companyData.contacts && typeof companyData.contacts.contactNumbers === 'string') {
            companyData.contacts.contactNumbers = companyData.contacts.contactNumbers.split(',').map(s => s.trim()).filter(Boolean);
        }
        const newCompany = new CompanyInfo({ company: companyData });
        // If this is the very first company, make it the default
        const count = await CompanyInfo.countDocuments();
        if (count === 0) {
            newCompany.isDefault = true;
        }
        await newCompany.save();
        res.status(201).json(newCompany);
    } catch (error) {
        console.error("Error in createCompany:", error);
        res.status(500).json({ message: 'Error creating company', error: error.message });
    }
};

// GET /api/company - Get all companies
exports.getCompanies = async (req, res) => {
    try {
        const companies = await CompanyInfo.find().sort({ isDefault: -1, 'company.companyName': 1 });
        res.status(200).json(companies);
    } catch (error) {
        console.error("Error in getCompanies:", error);
        res.status(500).json({ message: 'Error fetching companies', error: error.message });
    }
};

// GET /api/company/default - Get the single default company for PDFs
exports.getDefaultCompany = async (req, res) => {
    try {
        let companyInfo = await CompanyInfo.findOne({ isDefault: true });
        // Fallback: if no default is set, get the first company
        if (!companyInfo) {
            companyInfo = await CompanyInfo.findOne().sort({ createdAt: 1 });
        }
        res.status(200).json(companyInfo);
    } catch (error) {
        console.error("Error in getDefaultCompany:", error);
        res.status(500).json({ message: 'Error fetching default company information', error: error.message });
    }
};

// PUT /api/company/:id/field - Update a specific field for a company
exports.updateCompanyField = async (req, res) => {
    const { id } = req.params;
    const { field, value } = req.body;

    if (!field) {
        return res.status(400).json({ message: 'Field to update is required.' });
    }

    try {
        let updateValue = value;
        if (field.endsWith('contactNumbers')) {
            updateValue = value.split(',').map(item => item.trim());
        }
        const update = { $set: { [field]: updateValue } };
        const updatedInfo = await CompanyInfo.findByIdAndUpdate(id, update, { new: true });
        res.status(200).json(updatedInfo);
    } catch (error) {
        console.error("Error in updateCompanyField:", error);
        res.status(500).json({ message: 'Error updating company field', error: error.message });
    }
};

// DELETE /api/company/:id/field - Delete a specific field for a company
exports.deleteCompanyField = async (req, res) => {
    const { id } = req.params;
    const { field } = req.body;

    if (!field) {
        return res.status(400).json({ message: 'Field to delete is required.' });
    }

    try {
        const companyInfo = await CompanyInfo.findById(id);
        if (!companyInfo) {
            return res.status(404).json({ message: 'Company not found.' });
        }

        const valueToDelete = getNestedValue(companyInfo, field);
        if (valueToDelete === undefined) {
            return res.status(200).json(companyInfo); // Field doesn't exist, nothing to do
        }

        // Backup the field before deleting
        const backup = new UniversalBackup({
            originalId: companyInfo._id,
            originalModel: 'CompanyInfo_Field',
            data: { fieldPath: field, deletedValue: valueToDelete },
            deletedBy: req.user._id,
        });
        await backup.save();

        const update = { $unset: { [field]: "" } };
        const updatedInfo = await CompanyInfo.findByIdAndUpdate(id, update, { new: true });
        res.status(200).json(updatedInfo);
    } catch (error) {
        console.error("Error in deleteCompanyField:", error);
        res.status(500).json({ message: 'Error deleting company field', error: error.message });
    }
};

// PATCH /api/company/:id/set-default - Set a company as the default
exports.setDefaultCompany = async (req, res) => {
    try {
        const company = await CompanyInfo.findById(req.params.id);
        if (!company) {
            return res.status(404).json({ message: 'Company not found' });
        }
        company.isDefault = true;
        await company.save(); // The pre-save hook will handle unsetting other defaults
        res.status(200).json(company);
    } catch (error) {
        console.error("Error in setDefaultCompany:", error);
        res.status(500).json({ message: 'Error setting default company', error: error.message });
    }
};

// DELETE /api/company/:id - Delete an entire company
exports.deleteCompany = async (req, res) => {
    try {
        const company = await CompanyInfo.findById(req.params.id);
        if (!company) {
            return res.status(404).json({ message: 'Company not found' });
        }
        if (company.isDefault) {
            return res.status(400).json({ message: 'Cannot delete the default company. Please set another company as default first.' });
        }

        // Backup the entire company document
        const backup = new UniversalBackup({
            originalId: company._id,
            originalModel: 'CompanyInfo',
            data: company.toObject(),
            deletedBy: req.user._id,
        });
        await backup.save();

        await CompanyInfo.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: 'Company deleted and backed up successfully.' });
    } catch (error) {
        console.error("Error in deleteCompany:", error);
        res.status(500).json({ message: 'Error deleting company', error: error.message });
    }
};
