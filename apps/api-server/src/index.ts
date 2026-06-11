import 'dotenv/config';
import { createServer } from 'http';
import app from './app';
import { initializeSocket } from './socket/socketServer';
import { initializeQueue } from './services/queueService';
import { startScheduler } from './schedulers/jobScheduler';
import logger from './middleware/logger';

const PORT = parseInt(process.env.PORT || '3001', 10);

async function main() {
  const httpServer = createServer(app);

  // Initialize Socket.IO
  initializeSocket(httpServer);

  // Initialize BullMQ queue
  await initializeQueue();

  // Start background scheduler (heartbeat monitor + retry processor)
  startScheduler();

  httpServer.listen(PORT, () => {
    logger.info(`API server running on port ${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    httpServer.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
