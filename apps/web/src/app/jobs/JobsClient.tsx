'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Plus, RefreshCw, Filter } from 'lucide-react';
import { Job, Worker, JobStatus, PaginatedResponse } from '@distributed-job-platform/shared-types';
import { fetchJobs } from '@/lib/api';
import { useSocket } from '@/components/providers/SocketProvider';
import {
  JobStatusBadge,
  PriorityBadge,
  ProgressBar,
  ShortId,
  RelativeTime,
  EmptyState,
  Spinner,
  Skeleton,
} from '@/components/ui';

type JobRow = Job & { assignedWorker: Worker | null };

const STATUS_FILTERS = [
  { label: 'All', value: '' },
  { label: 'Queued', value: JobStatus.QUEUED },
  { label: 'Running', value: JobStatus.RUNNING },
  { label: 'Completed', value: JobStatus.COMPLETED },
  { label: 'Failed', value: JobStatus.FAILED },
  { label: 'Retrying', value: JobStatus.RETRYING },
];

export function JobsClient({ initialData }: { initialData: PaginatedResponse<JobRow> | null }) {
  const { lastEvent } = useSocket();
  const [jobs, setJobs] = useState<JobRow[]>(initialData?.data ?? []);
  const [total, setTotal] = useState(initialData?.total ?? 0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<JobStatus | ''>('');
  const [loading, setLoading] = useState(!initialData);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (p: number, status: JobStatus | '') => {
      setLoading(true);
      try {
        const res = await fetchJobs({ page: p, pageSize: 25, status: status || undefined });
        setJobs(res.data);
        setTotal(res.total);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    load(page, statusFilter);
  }, [page, statusFilter, load]);

  // Live updates — refresh when job events fire
  useEffect(() => {
    if (!lastEvent) return;
    const relevant = ['job_created', 'job_completed', 'job_failed', 'job_started', 'job_assigned', 'job_retried'];
    if (relevant.includes(lastEvent.type)) {
      load(page, statusFilter);
    }
  }, [lastEvent, page, statusFilter, load]);

  const refresh = async () => {
    setRefreshing(true);
    await load(page, statusFilter);
    setRefreshing(false);
  };

  const totalPages = Math.ceil(total / 25);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Jobs</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} total jobs</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refresh} disabled={refreshing} className="btn-secondary">
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <Link href="/submit" className="btn-primary">
            <Plus className="w-4 h-4" />
            New Job
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-4 h-4 text-gray-500" />
        {STATUS_FILTERS.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => { setStatusFilter(value as JobStatus | ''); setPage(1); }}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              statusFilter === value
                ? 'bg-brand-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                {['ID', 'Type', 'Status', 'Priority', 'Worker', 'Progress', 'Retries', 'Created'].map((h) => (
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
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : jobs.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <EmptyState
                      message="No jobs found"
                      sub={statusFilter ? `No jobs with status ${statusFilter}` : 'Submit a job to get started'}
                    />
                  </td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-gray-800/40 transition-colors group">
                    <td className="px-4 py-3">
                      <Link href={`/jobs/${job.id}`} className="group-hover:text-brand-400 transition-colors">
                        <ShortId id={job.id} />
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-300">{job.type}</span>
                    </td>
                    <td className="px-4 py-3">
                      <JobStatusBadge status={job.status as JobStatus} />
                    </td>
                    <td className="px-4 py-3">
                      <PriorityBadge priority={job.priority} />
                    </td>
                    <td className="px-4 py-3">
                      {job.assignedWorker ? (
                        <span className="font-mono text-xs text-gray-400 truncate max-w-[120px] block">
                          {job.assignedWorker.name}
                        </span>
                      ) : (
                        <span className="text-gray-600 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <ProgressBar value={job.progress} status={job.status as JobStatus} />
                        <span className="text-xs text-gray-500 w-8 text-right shrink-0">{job.progress}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-gray-400 text-xs">
                        {job.retryCount}/{job.maxRetries}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <RelativeTime date={job.createdAt as string} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
            <p className="text-xs text-gray-500">
              Page {page} of {totalPages} · {total} jobs
            </p>
            <div className="flex gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-secondary px-3 py-1 text-xs"
              >
                Prev
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="btn-secondary px-3 py-1 text-xs"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
