// Assuming logger might be needed if more complex validation logging is added.
// const logger = require('../utils/logger'); 

const validateItem = (req, res, next) => {
    const { name, price } = req.body;
    
    if (!name) {
      return res.status(400).json({ message: "Item name is required" });
    }
    
    if (!price || isNaN(price)) {
      return res.status(400).json({ message: "Valid price is required" });
    }
    
    next();
  };
  
  module.exports = { validateItem };