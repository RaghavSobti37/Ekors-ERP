const express = require('express');
require("dotenv").config(); // Ensure this is at the top
const connectDB = require('./db.js');
const cors = require('cors');
const path = require('path');
const morgan = require('morgan'); // HTTP request logger
const fs = require('fs'); // fs is still used for checking 'uploads' directory
const frontendLogRoute = require('./routes/frontendLogRoute.js');
require("dotenv").config(); // Make sure this is at the top before any usage

// Routes
const authRoutes = require("./routes/authRoutes");
const quotationRoutes = require('./routes/quotations.js');
const logtimeRoutes = require('./routes/logTimeRoutes.js');
const itemRoutes = require('./routes/itemlistRoutes.js');
const challanRoutes = require('./routes/challanRoutes.js');
const initRouter = require('./routes/init');
const userRoutes = require('./routes/userRoutes'); 
const clientRoutes = require('./routes/clients');
const reportRoutes = require("./routes/reportRoutes");
const auditLogRoutes = require('./routes/auditLogRoutes');
const logger = require('./utils/logger');

// Check if tickets route file exists before requiring it
let ticketsRouter;
try {
  ticketsRouter = require('./routes/tickets');
} catch (error) {
  console.error('Error loading tickets router:', error.message);
  // Create a simple placeholder router if the file doesn't exist
  ticketsRouter = express.Router();
}

const app = express();
connectDB();

app.use(cors({
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Static file serving
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// Log HTTP requests
app.use(morgan('dev'));

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ----------------------------
// API Route Mounts
app.use('/api/tickets', ticketsRouter); // Mounts all ticket routes, including the ones moved from index.js
app.use('/api/items', itemRoutes);
app.use('/api/init', initRouter);
app.use('/api/logtime', logtimeRoutes);
app.use('/api/challans', challanRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api', frontendLogRoute);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use("/api/reports", reportRoutes);
app.use('/api/audit', auditLogRoutes);
logger.info('server-setup', '[SERVER INFO] /api/audit routes mounted.');

// ----------------------------
// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  logger.info('server-lifecycle', `Server started and listening on port ${PORT}. JWT_SECRET is ${process.env.JWT_SECRET ? 'set' : 'NOT SET'}.`);
});

app.use((err, req, res, next) => {
  logger.error('general', `Unhandled server error on ${req.path}`, err, null, { requestMethod: req.method });
  res.status(500).send('Something broke!');
});