'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { JobPriority } from '@distributed-job-platform/shared-types';
import { createJob } from '@/lib/api';
import { ErrorBox } from '@/components/ui';
import { CheckCircle, Send } from 'lucide-react';
import clsx from 'clsx';

const JOB_TYPES = [
  { value: 'data-processing', label: 'Data Processing', description: 'Process and transform datasets' },
  { value: 'image-resize', label: 'Image Resize', description: 'Resize and convert images' },
  { value: 'report-generation', label: 'Report Generation', description: 'Generate PDF reports' },
  { value: 'email-send', label: 'Email Send', description: 'Send bulk email campaigns' },
  { value: 'ml-inference', label: 'ML Inference', description: 'Run machine learning predictions' },
  { value: 'custom', label: 'Custom', description: 'Define your own job type' },
];

const PRIORITIES = [
  { value: JobPriority.HIGH, label: 'High', desc: 'Processes first', color: 'text-red-400' },
  { value: JobPriority.MEDIUM, label: 'Medium', desc: 'Default priority', color: 'text-amber-400' },
  { value: JobPriority.LOW, label: 'Low', desc: 'Processes last', color: 'text-gray-400' },
];

const DEFAULT_PAYLOADS: Record<string, string> = {
  'data-processing': JSON.stringify({ batchId: 'batch-001', inputFile: 's3://bucket/data.csv', outputFormat: 'parquet' }, null, 2),
  'image-resize': JSON.stringify({ imageUrl: 'https://example.com/photo.jpg', targetWidth: 800, targetHeight: 600, format: 'webp' }, null, 2),
  'report-generation': JSON.stringify({ reportType: 'monthly-sales', dateRange: { from: '2024-01-01', to: '2024-01-31' }, format: 'pdf' }, null, 2),
  'email-send': JSON.stringify({ campaignId: 'camp-42', template: 'welcome', audienceSegment: 'new-users' }, null, 2),
  'ml-inference': JSON.stringify({ modelName: 'sentiment-v2', inputs: ['Great product!', 'Terrible service.'], batchSize: 32 }, null, 2),
  custom: JSON.stringify({ key: 'value' }, null, 2),
};

export function SubmitJobClient() {
  const router = useRouter();
  const [type, setType] = useState('data-processing');
  const [customType, setCustomType] = useState('');
  const [priority, setPriority] = useState<JobPriority>(JobPriority.MEDIUM);
  const [maxRetries, setMaxRetries] = useState(3);
  const [payload, setPayload] = useState(DEFAULT_PAYLOADS['data-processing']);
  const [payloadError, setPayloadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTypeChange = (t: string) => {
    setType(t);
    setPayload(DEFAULT_PAYLOADS[t] || DEFAULT_PAYLOADS.custom);
  };

  const validatePayload = (raw: string): boolean => {
    try {
      JSON.parse(raw);
      setPayloadError(null);
      return true;
    } catch {
      setPayloadError('Invalid JSON — check your payload syntax');
      return false;
    }
  };

  const handleSubmit = async () => {
    if (!validatePayload(payload)) return;
    setSubmitting(true);
    setError(null);
    try {
      const effectiveType = type === 'custom' ? customType.trim() || 'custom' : type;
      const res = await createJob({
        type: effectiveType,
        payload: JSON.parse(payload),
        priority,
        maxRetries,
      });
      setSubmitted(res.job.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit job');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto mt-20 text-center animate-fade-in">
        <div className="w-16 h-16 rounded-full bg-emerald-900/50 flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-8 h-8 text-emerald-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Job Submitted</h2>
        <p className="text-gray-400 text-sm mb-1">Your job is queued and will be processed shortly.</p>
        <p className="font-mono text-xs text-gray-600 mb-8">{submitted}</p>
        <div className="flex gap-3 justify-center">
          <button onClick={() => router.push(`/jobs/${submitted}`)} className="btn-primary">
            View Job
          </button>
          <button onClick={() => { setSubmitted(null); setError(null); }} className="btn-secondary">
            Submit Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Submit Job</h1>
        <p className="text-sm text-gray-500 mt-0.5">Create a new job to be processed by the worker pool</p>
      </div>

      {error && <ErrorBox message={error} />}

      {/* Job Type */}
      <div className="card p-5 space-y-3">
        <h2 className="font-semibold text-gray-200 text-sm">Job Type</h2>
        <div className="grid grid-cols-2 gap-2">
          {JOB_TYPES.map(({ value, label, description }) => (
            <button
              key={value}
              onClick={() => handleTypeChange(value)}
              className={clsx(
                'text-left px-4 py-3 rounded-lg border transition-all',
                type === value
                  ? 'border-brand-500 bg-brand-900/30 text-brand-300'
                  : 'border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600 hover:text-gray-300'
              )}
            >
              <p className="font-medium text-sm">{label}</p>
              <p className="text-xs opacity-60 mt-0.5">{description}</p>
            </button>
          ))}
        </div>
        {type === 'custom' && (
          <div>
            <label className="label">Custom Job Type Name</label>
            <input
              className="input"
              placeholder="e.g. video-transcode"
              value={customType}
              onChange={(e) => setCustomType(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Priority */}
      <div className="card p-5 space-y-3">
        <h2 className="font-semibold text-gray-200 text-sm">Priority</h2>
        <div className="flex gap-2">
          {PRIORITIES.map(({ value, label, desc, color }) => (
            <button
              key={value}
              onClick={() => setPriority(value)}
              className={clsx(
                'flex-1 py-2.5 px-4 rounded-lg border text-sm font-medium transition-all',
                priority === value
                  ? 'border-brand-500 bg-brand-900/30 text-brand-300'
                  : 'border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600'
              )}
            >
              <span className={color}>{label}</span>
              <p className="text-xs text-gray-600 font-normal mt-0.5">{desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Max Retries */}
      <div className="card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-200 text-sm">Max Retries</h2>
          <span className="text-brand-400 font-bold">{maxRetries}</span>
        </div>
        <input
          type="range"
          min={0}
          max={10}
          value={maxRetries}
          onChange={(e) => setMaxRetries(Number(e.target.value))}
          className="w-full accent-brand-500"
        />
        <p className="text-xs text-gray-600">
          Job will be retried up to {maxRetries} times on failure, with exponential backoff.
        </p>
      </div>

      {/* Payload */}
      <div className="card p-5 space-y-3">
        <h2 className="font-semibold text-gray-200 text-sm">Payload (JSON)</h2>
        <textarea
          className={clsx(
            'input font-mono text-xs min-h-[160px] resize-y',
            payloadError && 'ring-1 ring-red-500 border-red-700'
          )}
          value={payload}
          onChange={(e) => {
            setPayload(e.target.value);
            validatePayload(e.target.value);
          }}
          spellCheck={false}
        />
        {payloadError && <p className="text-xs text-red-400">{payloadError}</p>}
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={submitting || !!payloadError}
        className="btn-primary w-full py-3 text-base justify-center"
      >
        <Send className="w-4 h-4" />
        {submitting ? 'Submitting…' : 'Submit Job'}
      </button>
    </div>
  );
}
