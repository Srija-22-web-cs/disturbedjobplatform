'use client';

import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  SocketEvent,
  Job,
  JobStats,
  JobProgressEvent,
  WorkerStatusEvent,
} from '@distributed-job-platform/shared-types';

interface SocketContextValue {
  socket: Socket | null;
  connected: boolean;
  stats: JobStats | null;
  lastEvent: { type: string; data: unknown } | null;
}

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  connected: false,
  stats: null,
  lastEvent: null,
});

export function SocketProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [stats, setStats] = useState<JobStats | null>(null);
  const [lastEvent, setLastEvent] = useState<{ type: string; data: unknown } | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const socket = io(apiUrl, {
      transports: ['websocket', 'polling'],
      reconnectionDelay: 1000,
      reconnectionAttempts: Infinity,
    });

    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    const track = (type: string) => (data: unknown) => {
      setLastEvent({ type, data });
    };

    socket.on(SocketEvent.JOB_CREATED, track(SocketEvent.JOB_CREATED));
    socket.on(SocketEvent.JOB_ASSIGNED, track(SocketEvent.JOB_ASSIGNED));
    socket.on(SocketEvent.JOB_STARTED, track(SocketEvent.JOB_STARTED));
    socket.on(SocketEvent.JOB_PROGRESS, track(SocketEvent.JOB_PROGRESS));
    socket.on(SocketEvent.JOB_COMPLETED, track(SocketEvent.JOB_COMPLETED));
    socket.on(SocketEvent.JOB_FAILED, track(SocketEvent.JOB_FAILED));
    socket.on(SocketEvent.JOB_RETRIED, track(SocketEvent.JOB_RETRIED));
    socket.on(SocketEvent.WORKER_ONLINE, track(SocketEvent.WORKER_ONLINE));
    socket.on(SocketEvent.WORKER_OFFLINE, track(SocketEvent.WORKER_OFFLINE));
    socket.on(SocketEvent.STATS_UPDATED, (data: JobStats) => {
      setStats(data);
      setLastEvent({ type: SocketEvent.STATS_UPDATED, data });
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, connected, stats, lastEvent }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}

export function useJobSocket(jobId: string) {
  const { socket, lastEvent } = useSocket();

  useEffect(() => {
    if (!socket || !jobId) return;
    socket.emit('subscribe:job', jobId);
    return () => socket.emit('unsubscribe:job', jobId);
  }, [socket, jobId]);

  const progress =
    lastEvent?.type === SocketEvent.JOB_PROGRESS &&
    (lastEvent.data as JobProgressEvent)?.jobId === jobId
      ? (lastEvent.data as JobProgressEvent).progress
      : null;

  const jobUpdate =
    (lastEvent?.type === SocketEvent.JOB_COMPLETED ||
      lastEvent?.type === SocketEvent.JOB_FAILED ||
      lastEvent?.type === SocketEvent.JOB_STARTED) &&
    (lastEvent.data as Job)?.id === jobId
      ? (lastEvent.data as Job)
      : null;

  return { progress, jobUpdate };
}
