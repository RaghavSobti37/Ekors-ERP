// Create a new middleware file: middlewares/validation.js
const validateItem = (req, res, next) => {
    const { name, price } = req.body;
    
    if (!name) {
      debug("Validation failed: Missing name");
      return res.status(400).json({ message: "Item name is required" });
    }
    
    if (!price || isNaN(price)) {
      debug("Validation failed: Invalid price");
      return res.status(400).json({ message: "Valid price is required" });
    }
    
    next();
  };
  
  module.exports = { validateItem };