import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { rateLimit } from 'express-rate-limit';
import jobRoutes from './routes/jobRoutes';
import workerRoutes from './routes/workerRoutes';
import historyRoutes from './routes/historyRoutes';
import internalRoutes from './routes/internalRoutes';
import { errorHandler } from './middleware/errorHandler';
import logger from './middleware/logger';

const app = express();

// Security
app.use(helmet());

// CORS
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true,
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  message: { error: 'Too many requests', message: 'Rate limit exceeded' },
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// HTTP logging
app.use(
  morgan('combined', {
    stream: { write: (msg) => logger.info(msg.trim()) },
  })
);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'api-server' });
});

// Routes
app.use('/api/jobs', internalRoutes); // internal worker callbacks (PATCH status/progress)
app.use('/api/jobs', jobRoutes);
app.use('/api/workers', workerRoutes);
app.use('/api/history', historyRoutes);

// 404
app.use((_req, res) => {
  res.status(404).json({ error: 'Not Found', message: 'Route does not exist' });
});

// Error handler (must be last)
app.use(errorHandler);

export default app;
