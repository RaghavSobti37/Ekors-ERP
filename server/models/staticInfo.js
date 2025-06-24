// mongo db ka scehma define fields , req , 
const mongoose = require('mongoose');
const logger = require('../utils/logger');

const staticInfoSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  description: {
    type: String,
    trim: true
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index for faster search on public info
staticInfoSchema.index({ key: 1, isPublic: 1 });

// Pre-save hook to log creation
staticInfoSchema.pre('save', function(next) {
  logger.info('staticInfo-model', `Saving static info with key: ${this.key}`, this.createdBy);
  next();
});

// Post-save hook
staticInfoSchema.post('save', function(doc, next) {
  logger.info('staticInfo-model', `Static info saved: ${doc.key}`, doc.createdBy);
  next();
});

// Static method to get public info
staticInfoSchema.statics.getPublicInfo = async function(key) {
  try {
    const info = await this.findOne({ key, isPublic: true });
    return info;
  } catch (error) {
    logger.error('staticInfo-model', 'Error fetching public static info', error);
    throw error;
  }
};

// Static method to get all public info
staticInfoSchema.statics.getAllPublicInfo = async function() {
  try {
    const info = await this.find({ isPublic: true });
    return info;
  } catch (error) {
    logger.error('staticInfo-model', 'Error fetching all public static info', error);
    throw error;
  }
};

const StaticInfo = mongoose.model('StaticInfo', staticInfoSchema);

module.exports = StaticInfo;