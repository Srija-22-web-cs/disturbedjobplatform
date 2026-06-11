'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { RefreshCw, ArrowRight } from 'lucide-react';
import {
  JobStats,
  Job,
  Worker,
  WorkerStatus,
} from '@distributed-job-platform/shared-types';
import { PaginatedResponse } from '@distributed-job-platform/shared-types';
import { fetchJobStats, fetchJobs, fetchWorkers } from '@/lib/api';
import { useSocket } from '@/components/providers/SocketProvider';
import {
  StatCard,
  JobStatusBadge,
  PriorityBadge,
  WorkerStatusBadge,
  ProgressBar,
  ShortId,
  RelativeTime,
  Spinner,
  EmptyState,
} from '@/components/ui';

interface Props {
  initialStats: JobStats | null;
  initialJobs: PaginatedResponse<Job & { assignedWorker: Worker | null }> | null;
  initialWorkers: (Worker & { _count: { jobs: number } })[] | null;
}

export function DashboardClient({ initialStats, initialJobs, initialWorkers }: Props) {
  const { stats: liveStats, lastEvent } = useSocket();
  const [stats, setStats] = useState<JobStats | null>(initialStats);
  const [jobs, setJobs] = useState(initialJobs?.data ?? []);
  const [workers, setWorkers] = useState(initialWorkers ?? []);
  const [refreshing, setRefreshing] = useState(false);

  // Use live stats from socket when available
  useEffect(() => {
    if (liveStats) setStats(liveStats);
  }, [liveStats]);

  // Refresh job list on any job event
  useEffect(() => {
    if (!lastEvent) return;
    const jobEvents = ['job_created', 'job_completed', 'job_failed', 'job_started', 'job_assigned'];
    if (jobEvents.includes(lastEvent.type)) {
      fetchJobs({ pageSize: 5 }).then((r) => setJobs(r.data)).catch(() => {});
    }
    if (lastEvent.type === 'worker_online' || lastEvent.type === 'worker_offline') {
      fetchWorkers().then(setWorkers).catch(() => {});
    }
  }, [lastEvent]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const [s, j, w] = await Promise.all([fetchJobStats(), fetchJobs({ pageSize: 5 }), fetchWorkers()]);
      setStats(s);
      setJobs(j.data);
      setWorkers(w);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const onlineWorkers = workers.filter((w) => w.status === WorkerStatus.ONLINE).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">System overview and recent activity</p>
        </div>
        <button onClick={refresh} disabled={refreshing} className="btn-secondary">
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stat Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Jobs" value={stats?.total ?? '—'} accent="default" />
        <StatCard label="Queued" value={stats?.queued ?? '—'} accent="blue" />
        <StatCard label="Running" value={stats?.running ?? '—'} accent="yellow" sub={`${stats?.assigned ?? 0} assigned`} />
        <StatCard label="Completed" value={stats?.completed ?? '—'} accent="green" />
        <StatCard label="Failed" value={stats?.failed ?? '—'} accent="red" />
        <StatCard label="Retrying" value={stats?.retrying ?? '—'} accent="orange" />
        <StatCard label="Online Workers" value={onlineWorkers} accent="purple" sub={`of ${workers.length} total`} />
        <StatCard
          label="Success Rate"
          value={
            stats && (stats.completed + stats.failed) > 0
              ? `${Math.round((stats.completed / (stats.completed + stats.failed)) * 100)}%`
              : '—'
          }
          accent="green"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Jobs */}
        <div className="card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
            <h2 className="font-semibold text-gray-200">Recent Jobs</h2>
            <Link href="/jobs" className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-gray-800">
            {jobs.length === 0 ? (
              <EmptyState message="No jobs yet" sub="Submit a job to get started" />
            ) : (
              jobs.map((job) => (
                <Link
                  key={job.id}
                  href={`/jobs/${job.id}`}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-gray-800/50 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-200 truncate">{job.type}</span>
                      <ShortId id={job.id} />
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <JobStatusBadge status={job.status as any} />
                      <PriorityBadge priority={job.priority} />
                      <RelativeTime date={job.createdAt as string} />
                    </div>
                  </div>
                  <div className="w-20">
                    <ProgressBar value={job.progress} status={job.status as any} />
                    <p className="text-xs text-gray-600 text-right mt-0.5">{job.progress}%</p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Workers */}
        <div className="card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
            <h2 className="font-semibold text-gray-200">Workers</h2>
            <Link href="/workers" className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-gray-800">
            {workers.length === 0 ? (
              <EmptyState message="No workers registered" sub="Start a worker process to begin processing jobs" />
            ) : (
              workers.slice(0, 6).map((w) => (
                <div key={w.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-mono text-gray-300 truncate">{w.name}</p>
                    <p className="text-xs text-gray-600 mt-0.5">{w._count.jobs} jobs processed</p>
                  </div>
                  <WorkerStatusBadge status={w.status as any} />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
