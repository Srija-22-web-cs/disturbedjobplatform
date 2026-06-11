'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ExecutionHistory, JobStatus, PaginatedResponse } from '@distributed-job-platform/shared-types';
import { fetchHistory } from '@/lib/api';
import { useSocket } from '@/components/providers/SocketProvider';
import {
  JobStatusBadge,
  PriorityBadge,
  ShortId,
  RelativeTime,
  EmptyState,
  Skeleton,
} from '@/components/ui';
import { RefreshCw } from 'lucide-react';

type HistoryRow = ExecutionHistory & {
  job: { id: string; type: string; priority: number } | null;
  worker: { id: string; name: string } | null;
};

export function HistoryClient({
  initialData,
}: {
  initialData: PaginatedResponse<HistoryRow> | null;
}) {
  const { lastEvent } = useSocket();
  const [rows, setRows] = useState<HistoryRow[]>(initialData?.data ?? []);
  const [total, setTotal] = useState(initialData?.total ?? 0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(!initialData);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await fetchHistory({ page: p, pageSize: 25 });
      setRows(res.data);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(page);
  }, [page, load]);

  useEffect(() => {
    if (lastEvent?.type === 'job_completed' || lastEvent?.type === 'job_failed') {
      load(page);
    }
  }, [lastEvent, page, load]);

  const refresh = async () => {
    setRefreshing(true);
    await load(page);
    setRefreshing(false);
  };

  const totalPages = Math.ceil(total / 25);

  function formatDuration(start: string | Date, end: string | Date | null) {
    if (!end) return '—';
    const ms = new Date(end).getTime() - new Date(start).getTime();
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Execution History</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} execution records</p>
        </div>
        <button onClick={refresh} disabled={refreshing} className="btn-secondary">
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                {['Job ID', 'Type', 'Status', 'Priority', 'Worker', 'Duration', 'Started'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState message="No execution history" sub="Jobs that have run will appear here" />
                  </td>
                </tr>
              ) : (
                rows.map((h) => (
                  <tr key={h.id} className="hover:bg-gray-800/40 transition-colors">
                    <td className="px-4 py-3">
                      {h.job ? (
                        <Link href={`/jobs/${h.job.id}`} className="hover:text-brand-400 transition-colors">
                          <ShortId id={h.job.id} />
                        </Link>
                      ) : (
                        <span className="text-gray-600 text-xs">deleted</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-gray-300">{h.job?.type ?? '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <JobStatusBadge status={h.status as JobStatus} />
                    </td>
                    <td className="px-4 py-3">
                      {h.job && <PriorityBadge priority={h.job.priority} />}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-gray-400">
                        {h.worker?.name ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-gray-400 text-xs font-mono">
                        {formatDuration(h.startedAt as string, h.completedAt as string | null)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <RelativeTime date={h.startedAt as string} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
            <p className="text-xs text-gray-500">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary px-3 py-1 text-xs">
                Prev
              </button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn-secondary px-3 py-1 text-xs">
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
