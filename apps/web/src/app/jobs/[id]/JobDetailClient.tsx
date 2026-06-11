'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, RotateCcw } from 'lucide-react';
import {
  Job,
  Worker,
  ExecutionHistory,
  JobStatus,
} from '@distributed-job-platform/shared-types';
import { fetchJob, retryJob } from '@/lib/api';
import { useJobSocket } from '@/components/providers/SocketProvider';
import {
  JobStatusBadge,
  PriorityBadge,
  ProgressBar,
  WorkerStatusBadge,
  ShortId,
  RelativeTime,
  ErrorBox,
} from '@/components/ui';

type DetailJob = Job & {
  assignedWorker: Worker | null;
  executionHistory: (ExecutionHistory & { worker: { id: string; name: string } | null })[];
};

export function JobDetailClient({ job: initialJob }: { job: DetailJob }) {
  const [job, setJob] = useState(initialJob);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { progress: liveProgress, jobUpdate } = useJobSocket(job.id);

  // Update progress live
  useEffect(() => {
    if (liveProgress !== null) {
      setJob((j) => ({ ...j, progress: liveProgress }));
    }
  }, [liveProgress]);

  // Reload on job state change
  useEffect(() => {
    if (jobUpdate) {
      fetchJob(job.id).then(setJob).catch(() => {});
    }
  }, [jobUpdate, job.id]);

  const handleRetry = async () => {
    setRetrying(true);
    setError(null);
    try {
      const res = await retryJob(job.id);
      setJob((j) => ({ ...j, status: res.job.status as JobStatus, retryCount: res.job.retryCount }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to retry job');
    } finally {
      setRetrying(false);
    }
  };

  const refresh = () => fetchJob(job.id).then(setJob).catch(() => {});

  const isTerminal = job.status === JobStatus.COMPLETED || job.status === JobStatus.FAILED;
  const canRetry = job.status === JobStatus.FAILED && job.retryCount < job.maxRetries;

  return (
    <div className="space-y-6 max-w-4xl animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link href="/jobs" className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1 mb-2">
            <ArrowLeft className="w-3 h-3" /> Jobs
          </Link>
          <h1 className="text-xl font-bold text-white">{job.type}</h1>
          <div className="flex items-center gap-2 mt-1.5">
            <JobStatusBadge status={job.status as JobStatus} />
            <PriorityBadge priority={job.priority} />
            <ShortId id={job.id} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refresh} className="btn-secondary">
            <RefreshCw className="w-4 h-4" />
          </button>
          {canRetry && (
            <button onClick={handleRetry} disabled={retrying} className="btn-primary">
              <RotateCcw className={`w-4 h-4 ${retrying ? 'animate-spin' : ''}`} />
              Retry Job
            </button>
          )}
        </div>
      </div>

      {error && <ErrorBox message={error} />}

      {/* Progress */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-200">Progress</h2>
          <span className="text-2xl font-bold text-white">{job.progress}%</span>
        </div>
        <ProgressBar value={job.progress} status={job.status as JobStatus} />
        {job.errorMessage && (
          <p className="text-xs text-red-400 mt-2 font-mono">{job.errorMessage}</p>
        )}
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card p-5 space-y-3">
          <h2 className="font-semibold text-gray-200 text-sm">Job Info</h2>
          <Field label="ID" value={<code className="font-mono text-xs text-gray-400 break-all">{job.id}</code>} />
          <Field label="Type" value={job.type} />
          <Field label="Retry Count" value={`${job.retryCount} / ${job.maxRetries}`} />
          <Field label="Created" value={<RelativeTime date={job.createdAt as string} />} />
          <Field label="Updated" value={<RelativeTime date={job.updatedAt as string} />} />
        </div>

        <div className="card p-5 space-y-3">
          <h2 className="font-semibold text-gray-200 text-sm">Worker</h2>
          {job.assignedWorker ? (
            <>
              <Field label="Name" value={<code className="font-mono text-xs text-gray-400">{job.assignedWorker.name}</code>} />
              <Field label="Status" value={<WorkerStatusBadge status={job.assignedWorker.status as any} />} />
              <Field label="Worker ID" value={<ShortId id={job.assignedWorker.id} />} />
            </>
          ) : (
            <p className="text-sm text-gray-600">No worker assigned</p>
          )}
        </div>
      </div>

      {/* Payload */}
      <div className="card p-5">
        <h2 className="font-semibold text-gray-200 mb-3 text-sm">Payload</h2>
        <pre className="bg-gray-800 rounded-lg p-4 text-xs text-gray-300 font-mono overflow-x-auto">
          {JSON.stringify(job.payload, null, 2)}
        </pre>
      </div>

      {/* Result */}
      {job.result && (
        <div className="card p-5">
          <h2 className="font-semibold text-gray-200 mb-3 text-sm">Result</h2>
          <pre className="bg-gray-800 rounded-lg p-4 text-xs text-emerald-300 font-mono overflow-x-auto">
            {JSON.stringify(job.result, null, 2)}
          </pre>
        </div>
      )}

      {/* Execution History */}
      {job.executionHistory.length > 0 && (
        <div className="card">
          <div className="px-5 py-4 border-b border-gray-800">
            <h2 className="font-semibold text-gray-200 text-sm">Execution History</h2>
          </div>
          <div className="divide-y divide-gray-800">
            {job.executionHistory.map((h) => (
              <div key={h.id} className="px-5 py-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <JobStatusBadge status={h.status as JobStatus} />
                    {h.worker && (
                      <code className="text-xs text-gray-500 font-mono">{h.worker.name}</code>
                    )}
                  </div>
                  <RelativeTime date={h.startedAt as string} />
                </div>
                {h.logs.length > 0 && (
                  <div className="bg-gray-800 rounded-lg p-3 space-y-0.5">
                    {(h.logs as string[]).map((log, i) => (
                      <p key={i} className="text-xs font-mono text-gray-400">{log}</p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs text-gray-500 shrink-0">{label}</span>
      <span className="text-xs text-gray-300 text-right">{value}</span>
    </div>
  );
}
