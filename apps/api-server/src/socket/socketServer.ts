import { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import {
  SocketEvent,
  Job,
  Worker,
  JobProgressEvent,
  WorkerStatusEvent,
  JobStats,
} from '@distributed-job-platform/shared-types';
import logger from '../middleware/logger';

let io: SocketServer | null = null;

export function initializeSocket(httpServer: HttpServer): SocketServer {
  io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket: Socket) => {
    logger.info(`Socket client connected: ${socket.id}`);

    socket.on('disconnect', () => {
      logger.info(`Socket client disconnected: ${socket.id}`);
    });

    // Allow clients to subscribe to specific job updates
    socket.on('subscribe:job', (jobId: string) => {
      socket.join(`job:${jobId}`);
    });

    socket.on('unsubscribe:job', (jobId: string) => {
      socket.leave(`job:${jobId}`);
    });
  });

  logger.info('Socket.IO server initialized');
  return io;
}

export function getSocketServer(): SocketServer | null {
  return io;
}

// Broadcast helpers
export function emitJobCreated(job: Job): void {
  io?.emit(SocketEvent.JOB_CREATED, job);
}

export function emitJobAssigned(job: Job): void {
  io?.emit(SocketEvent.JOB_ASSIGNED, job);
  io?.to(`job:${job.id}`).emit(SocketEvent.JOB_ASSIGNED, job);
}

export function emitJobStarted(job: Job): void {
  io?.emit(SocketEvent.JOB_STARTED, job);
  io?.to(`job:${job.id}`).emit(SocketEvent.JOB_STARTED, job);
}

export function emitJobProgress(event: JobProgressEvent): void {
  io?.emit(SocketEvent.JOB_PROGRESS, event);
  io?.to(`job:${event.jobId}`).emit(SocketEvent.JOB_PROGRESS, event);
}

export function emitJobCompleted(job: Job): void {
  io?.emit(SocketEvent.JOB_COMPLETED, job);
  io?.to(`job:${job.id}`).emit(SocketEvent.JOB_COMPLETED, job);
}

export function emitJobFailed(job: Job): void {
  io?.emit(SocketEvent.JOB_FAILED, job);
  io?.to(`job:${job.id}`).emit(SocketEvent.JOB_FAILED, job);
}

export function emitJobRetried(job: Job): void {
  io?.emit(SocketEvent.JOB_RETRIED, job);
}

export function emitWorkerOnline(event: WorkerStatusEvent): void {
  io?.emit(SocketEvent.WORKER_ONLINE, event);
}

export function emitWorkerOffline(event: WorkerStatusEvent): void {
  io?.emit(SocketEvent.WORKER_OFFLINE, event);
}

export function emitStatsUpdated(stats: JobStats): void {
  io?.emit(SocketEvent.STATS_UPDATED, stats);
}
