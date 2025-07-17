const mongoose = require('mongoose');

const CompanyInfoSchema = new mongoose.Schema({
    // isDefault marks the company whose details will be used on PDFs.
    isDefault: {
        type: Boolean,
        default: false,
        index: true,
    },
    company: {
        companyName: { type: String, required: true, unique: true },
        gstin: { type: String },
        cin: { type: String },
        addresses: {
            companyAddress: { type: String },
            officeAddress: { type: String }
        },
        contacts: {
            contactNumbers: [{ type: String }],
            email: { type: String }
        },
        bank: {
            bankName: { type: String },
            accountNumber: { type: String },
            ifscCode: { type: String },
            branch: { type: String }
        }
    }
}, { timestamps: true, strict: false });

// Pre-save hook to ensure only one company can be the default
CompanyInfoSchema.pre('save', async function (next) {
    if (this.isModified('isDefault') && this.isDefault) {
        // `this.constructor` refers to the Model
        await this.constructor.updateMany({ _id: { $ne: this._id } }, { isDefault: false });
    }
    next();
});

module.exports = mongoose.model('CompanyInfo', CompanyInfoSchema);
