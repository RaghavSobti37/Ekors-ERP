const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const quotationHistorySchema = new Schema({
    quotationId: {
        type: Schema.Types.ObjectId,
        ref: 'Quotation',
        required: true,
        index: true
    },
    changedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    action: {
        type: String,
        required: true,
        enum: ['CREATE', 'UPDATE', 'STATUS_CHANGE', 'DELETE']
    },
    changes: { type: Schema.Types.Mixed } // Store a snapshot or diff of the changes
}, { timestamps: { createdAt: 'changedAt', updatedAt: false } });

module.exports = mongoose.model('QuotationHistory', quotationHistorySchema);
