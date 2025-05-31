const express = require('express');
require("dotenv").config(); 
const connectDB = require('./db.js');
const cors = require('cors');
const bcrypt = require('bcrypt');
const path = require('path'); // Still needed for static serving
const morgan = require('morgan'); // HTTP request logger
const fs = require('fs'); // Still needed for checking 'uploads' directory
const frontendLogRoute = require('./routes/frontendLogRoute.js');
require("dotenv").config(); // Make sure this is at the top before any usage

const authRoutes = require("./routes/authRoutes");
const quotationRoutes = require('./routes/quotations.js');
const logtimeRoutes = require('./routes/logTimeRoutes.js');
const itemRoutes = require('./routes/itemlistRoutes.js');
const challanRoutes = require('./routes/challanRoutes.js');
const initRouter = require('./routes/init');
const userRoutes = require('./routes/userRoutes'); 
const clientRoutes = require('./routes/clients');
const ticketsRouter = require('./routes/tickets'); // Assuming tickets.js will define all ticket routes
const reportRoutes = require("./routes/reportRoutes");
const auditLogRoutes = require('./routes/auditLogRoutes');
const logger = require('./utils/logger');

const app = express();
connectDB();

app.use(express.json());
const corsOptions = {
  origin: 'http://localhost:5173', // Your client's URL
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'], // Must include PATCH and OPTIONS
  allowedHeaders: ['Content-Type', 'Authorization'], // Must include headers sent by client
  credentials: true // If you use cookies or sessions
};
app.use(cors(corsOptions));
// Static file serving
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}
// Log HTTP requests
app.use(morgan('dev'));
// Body parser
app.use(express.urlencoded({ extended: true }));

// ----------------------------
// API Route Mounts
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/tickets', ticketsRouter);
app.use('/api/challans', challanRoutes);
app.use('/api/logtime', logtimeRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/audit', auditLogRoutes);
app.use('/api/init', initRouter);
app.use('/api', frontendLogRoute);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
logger.info('server-setup', '[SERVER INFO] /api/audit routes mounted.');

// // ----------------------------
// // Start server
// const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => {
//   logger.info('server-lifecycle', `Server started and listening on port ${PORT}. JWT_SECRET is ${process.env.JWT_SECRET ? 'set' : 'NOT SET'}.`);
// });

app.use((err, req, res, next) => {
  console.error('[SERVER CRITICAL GlobalErrorHandler] Unhandled error:', err);
  logger.error('general', `Unhandled server error on ${req.path}`, err, null, { requestMethod: req.method });
  res.status(500).send('Something broke!');
});