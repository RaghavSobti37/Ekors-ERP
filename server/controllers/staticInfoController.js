// import model 
// functionalities defined 
const StaticInfo = require('../models/StaticInfo');
const logger = require('../utils/logger');

// Create new static info
exports.createStaticInfo = async (req, res) => {
  try {
    const { key, value, description, isPublic } = req.body;
    const createdBy = req.user.id;

    // Validate input
    if (!key || value === undefined || value === null) {
      logger.warn('staticInfo-controller', 'Missing required fields', req.user);
      return res.status(400).json({ error: 'Key and value are required' });
    }

    const existingInfo = await StaticInfo.findOne({ key });
    if (existingInfo) {
      logger.warn('staticInfo-controller', `Duplicate key: ${key}`, req.user);
      return res.status(400).json({ error: 'Key already exists' });
    }

    const staticInfo = new StaticInfo({
      key,
      value,
      description,
      isPublic: isPublic || false,
      createdBy
    });

    await staticInfo.save();

    logger.info('staticInfo-controller', `Created static info: ${key}`, req.user);
    res.status(201).json(staticInfo);
  } catch (error) {
    logger.error('staticInfo-controller', 'Error creating static info', error, req.user);
    res.status(500).json({ error: 'Server error' });
  }
};

// Update static info
exports.updateStaticInfo = async (req, res) => {
  try {
    const { id } = req.params;
    const { value, description, isPublic } = req.body;
    const updatedBy = req.user.id;

    const staticInfo = await StaticInfo.findById(id);
    if (!staticInfo) {
      logger.warn('staticInfo-controller', `Static info not found: ${id}`, req.user);
      return res.status(404).json({ error: 'Static info not found' });
    }

    // Check if user is admin or creator
    if (req.user.role !== 'admin' && staticInfo.createdBy.toString() !== req.user.id) {
      logger.warn('staticInfo-controller', 'Unauthorized update attempt', req.user, { staticInfoId: id });
      return res.status(403).json({ error: 'Not authorized to update this info' });
    }

    if (value !== undefined) staticInfo.value = value;
    if (description !== undefined) staticInfo.description = description;
    if (isPublic !== undefined) staticInfo.isPublic = isPublic;
    staticInfo.updatedBy = updatedBy;

    await staticInfo.save();

    logger.info('staticInfo-controller', `Updated static info: ${staticInfo.key}`, req.user);
    res.json(staticInfo);
  } catch (error) {
    logger.error('staticInfo-controller', 'Error updating static info', error, req.user);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get static info by key (public or private based on auth)
exports.getStaticInfo = async (req, res) => {
  try {
    const { key } = req.params;
    let staticInfo;

    if (req.user) {
      // Authenticated users can see all info
      staticInfo = await StaticInfo.findOne({ key });
    } else {
      // Public access only
      staticInfo = await StaticInfo.getPublicInfo(key);
    }

    if (!staticInfo) {
      logger.warn('staticInfo-controller', `Static info not found: ${key}`, req.user || null);
      return res.status(404).json({ error: 'Static info not found' });
    }

    logger.info('staticInfo-controller', `Fetched static info: ${key}`, req.user || null);
    res.json(staticInfo);
  } catch (error) {
    logger.error('staticInfo-controller', 'Error fetching static info', error, req.user || null);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get all static info (admin only)
exports.getAllStaticInfo = async (req, res) => {
  try {
    // Only admins can see all info
    if (req.user.role !== 'admin') {
      logger.warn('staticInfo-controller', 'Unauthorized access attempt to all static info', req.user);
      return res.status(403).json({ error: 'Not authorized' });
    }

    const staticInfos = await StaticInfo.find().sort({ key: 1 });
    logger.info('staticInfo-controller', 'Fetched all static info', req.user);
    res.json(staticInfos);
  } catch (error) {
    logger.error('staticInfo-controller', 'Error fetching all static info', error, req.user);
    res.status(500).json({ error: 'Server error' });
  }
};

// Delete static info
exports.deleteStaticInfo = async (req, res) => {
  try {
    const { id } = req.params;

    const staticInfo = await StaticInfo.findById(id);
    if (!staticInfo) {
      logger.warn('staticInfo-controller', `Static info not found: ${id}`, req.user);
      return res.status(404).json({ error: 'Static info not found' });
    }

    // Only admins or creators can delete
    if (req.user.role !== 'admin' && staticInfo.createdBy.toString() !== req.user.id) {
      logger.warn('staticInfo-controller', 'Unauthorized delete attempt', req.user, { staticInfoId: id });
      return res.status(403).json({ error: 'Not authorized to delete this info' });
    }

    await StaticInfo.findByIdAndDelete(id);

    logger.info('staticInfo-controller', `Deleted static info: ${staticInfo.key}`, req.user);
    res.json({ message: 'Static info deleted successfully' });
  } catch (error) {
    logger.error('staticInfo-controller', 'Error deleting static info', error, req.user);
    res.status(500).json({ error: 'Server error' });
  }
};