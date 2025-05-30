const mongoose = require('mongoose');
const logger = require('./utils/logger'); // Assuming logger is in utils

const connectDB = async() => {
  try{
    const mongoURI = process.env.MONGO_URI;
    if (!mongoURI) {
      logger.error('db', 'MONGO_URI not found in environment variables. Please set it in your .env file.');
      process.exit(1);
    }
    const conn = await mongoose.connect(mongoURI);
    logger.info('db', `MongoDB Connected: ${conn.connection.host}`);
  } catch(error){
    logger.error('db', 'MongoDB connection error', error);
    process.exit(1);
  }
}

module.exports = connectDB;