import bcrypt from 'bcrypt';
import connectDB from './db.js';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import fs from 'fs';
import frontendLogRoute from './routes/frontendLogRoute.js';
import morgan from 'morgan';
import path from 'path';
import auditLogRoutes from './routes/auditLogRoutes.js';
import authRoutes from './routes/authRoutes.js';
import challanRoutes from './routes/challanRoutes.js';
import clientRoutes from './routes/clients.js';
import initRouter from './routes/init.js';
import itemRoutes from './routes/itemlistRoutes.js';
import logger from './utils/logger.js';
import logtimeRoutes from './routes/logTimeRoutes.js';
import quotationRoutes from './routes/quotations.js';
import reportRoutes from './routes/reportRoutes.js';
import ticketsRouter from './routes/tickets.js';
import userRoutes from './routes/userRoutes.js';

dotenv.config();

const app = express();
connectDB();

const allowedOrigins = [
  'http://localhost:5173',
  'https://ekors-erp.vercel.app',
  /^https:\/\/ekors-erp-.*\.vercel\.app$/,
];

const corsOptions = {
  origin: function (origin, callback) {
    if (
      !origin ||
      allowedOrigins.some(pattern =>
        typeof pattern === 'string' ? pattern === origin : pattern.test(origin)
      )
    ) {
      callback(null, true);
    } else {
      logger.warn('cors', `CORS: Blocked origin - ${origin}`);
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}
app.use('/uploads', express.static(path.join(path.resolve(), 'uploads')));

// ----------------------------
// API Route Mounts
app.use('/api', frontendLogRoute);
app.use('/api/audit', auditLogRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/challans', challanRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/init', initRouter);
app.use('/api/items', itemRoutes);
app.use('/api/logtime', logtimeRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/tickets', ticketsRouter);
app.use('/api/users', userRoutes);

app.get('/api/health', (req, res) => {
  console.log('Health check endpoint hit');
  res.status(200).json({ status: 'ok', message: 'Server is healthy' });
});

logger.info('server-setup', '[SERVER INFO] /api/audit routes mounted.');

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[SERVER CRITICAL GlobalErrorHandler] Unhandled error:', err);
  logger.error('general', `Unhandled server error on ${req.path}`, err, null, {
    requestMethod: req.method,
  });
  res.status(500).send('Something broke!');
});

export default app;
