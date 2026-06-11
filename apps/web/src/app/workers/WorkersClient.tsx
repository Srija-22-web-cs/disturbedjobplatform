'use client';

import { useState, useEffect, useCallback } from 'react';
import { Worker, WorkerStatus } from '@distributed-job-platform/shared-types';
import { fetchWorkers } from '@/lib/api';
import { useSocket } from '@/components/providers/SocketProvider';
import {
  WorkerStatusBadge,
  RelativeTime,
  EmptyState,
  Skeleton,
  StatCard,
} from '@/components/ui';
import { RefreshCw } from 'lucide-react';

type WorkerRow = Worker & { _count: { jobs: number } };

export function WorkersClient({ initialWorkers }: { initialWorkers: WorkerRow[] | null }) {
  const { lastEvent } = useSocket();
  const [workers, setWorkers] = useState<WorkerRow[]>(initialWorkers ?? []);
  const [loading, setLoading] = useState(!initialWorkers);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setWorkers(await fetchWorkers());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialWorkers) load();
  }, [initialWorkers, load]);

  useEffect(() => {
    if (lastEvent?.type === 'worker_online' || lastEvent?.type === 'worker_offline') {
      fetchWorkers().then(setWorkers).catch(() => {});
    }
  }, [lastEvent]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const online = workers.filter((w) => w.status === WorkerStatus.ONLINE).length;
  const offline = workers.filter((w) => w.status === WorkerStatus.OFFLINE).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Workers</h1>
          <p className="text-sm text-gray-500 mt-0.5">{workers.length} total workers</p>
        </div>
        <button onClick={refresh} disabled={refreshing} className="btn-secondary">
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Total Workers" value={workers.length} accent="default" />
        <StatCard label="Online" value={online} accent="green" />
        <StatCard label="Offline" value={offline} accent="red" />
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                {['Name', 'Status', 'Jobs Processed', 'Last Heartbeat', 'Registered'].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-5 py-3">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : workers.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <EmptyState
                      message="No workers registered"
                      sub="Start a worker process to begin processing jobs"
                    />
                  </td>
                </tr>
              ) : (
                workers.map((w) => {
                  const isStale =
                    w.status === WorkerStatus.ONLINE &&
                    Date.now() - new Date(w.lastHeartbeat).getTime() > 30_000;

                  return (
                    <tr key={w.id} className="hover:bg-gray-800/40 transition-colors">
                      <td className="px-5 py-3">
                        <span className="font-mono text-sm text-gray-300">{w.name}</span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <WorkerStatusBadge status={w.status as WorkerStatus} />
                          {isStale && (
                            <span className="text-xs text-yellow-600">(stale)</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-gray-400">{w._count.jobs}</span>
                      </td>
                      <td className="px-5 py-3">
                        <RelativeTime date={w.lastHeartbeat as string} />
                      </td>
                      <td className="px-5 py-3">
                        <RelativeTime date={w.createdAt as string} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
