import 'dotenv/config';
import { generateWorkerName } from '@distributed-job-platform/shared-utils';
import { WorkerService } from './workerService';
import logger from './logger';

const workerName = process.env.WORKER_NAME || generateWorkerName();

async function main() {
  logger.info(`Starting worker: ${workerName}`);

  const service = new WorkerService(workerName);

  // Register with the API
  await service.register();

  // Start heartbeat
  service.startHeartbeat();

  // Start processing jobs
  await service.startProcessing();

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Worker ${workerName} received ${signal}, shutting down...`);
    await service.shutdown();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error('Worker fatal error:', err);
  process.exit(1);
});
