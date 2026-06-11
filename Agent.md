# Agent.md — AI Usage & Development Approach

## AI Tools Used

| Tool | Purpose |
|------|---------|
| Claude (Anthropic) | Primary development assistant — architecture design, code generation, test scaffolding, documentation |

---

## Development Workflow

This project was built using Claude as a collaborative engineering partner. The workflow was:

1. **Define the architecture first** — before writing any code, establish the system design: which components exist, how they communicate, what the data model looks like, and where the failure boundaries are.

2. **Build incrementally by layer** — infrastructure types → shared packages → API server → worker → frontend → Docker → docs. Each layer built on a stable foundation.

3. **Generate complete files, not stubs** — every file in this repository is a complete, runnable implementation. No TODOs, no placeholders.

4. **Review and reason about each decision** — AI-generated code was evaluated for correctness, not blindly accepted. Architecture decisions (e.g., workers communicating via HTTP rather than direct DB access) were made deliberately and documented.

---

## Key Prompts Used

### System architecture prompt
> "Design a distributed job execution platform with: job submission, async execution across workers, heartbeat monitoring, retry with exponential backoff, failure recovery, queue prioritization, and real-time progress via WebSocket. Use Node.js + TypeScript, PostgreSQL + Prisma, Redis + BullMQ, Next.js, Socket.IO, Docker."

### Per-component prompts
> "Implement the BullMQ queue service. Workers should pull jobs, report progress every second, have a 20% chance of failure, run for 5–20 seconds, and communicate results back to the API via HTTP PATCH."

> "Implement the background scheduler: detect workers with stale heartbeats (>30s), mark them OFFLINE, find their ASSIGNED/RUNNING jobs, re-queue them with incremented retryCount, create an ExecutionHistory record."

> "Build the Next.js dashboard with App Router. Server components fetch initial data; client components subscribe to Socket.IO events for live updates. Pages: Dashboard (stats), Jobs (table with filtering), Workers, History, Submit."

### Debugging prompts
> "The worker sends PATCH /api/jobs/:id/status but the route isn't mounted yet. Add an internal routes file for worker callbacks that mounts before the public job routes."

---

## Engineering Decisions Made (and why)

### Workers report via HTTP, not direct DB writes

**Decision**: Workers call `PATCH /api/jobs/:id/status` to report state changes.

**Reasoning**: This keeps the worker fully stateless (no DB credentials, no Prisma dependency), ensures all Socket.IO broadcasts happen automatically, and creates a single authoritative state machine in the API layer. Direct DB writes from workers would create split ownership and could leave Socket.IO out of sync.

### Single scheduler, in-process

**Decision**: Heartbeat monitoring runs as a `setInterval` in the API server, not as a separate service.

**Reasoning**: Appropriate for a single-node deployment. The simplest design that works. If scaling to multiple API instances, add a Redis-backed distributed lock so only one node runs the scheduler at a time.

### BullMQ priority mapping (HIGH=10, MEDIUM=5, LOW=1)

**Decision**: Map domain priorities (1/2/3) to BullMQ weights (10/5/1) — higher BullMQ weight = higher priority.

**Reasoning**: BullMQ's priority is inverted relative to natural intuition. This mapping makes the domain model intuitive (lower number = higher priority) while the queue handles execution order correctly.

### Monorepo with npm workspaces, not a separate package registry

**Decision**: `shared-types` and `shared-utils` are local workspace packages.

**Reasoning**: Zero publish overhead, instant changes propagate, TypeScript paths resolve correctly. The Docker build correctly handles workspace hoisting with `--include-workspace-root`.

### Execution history per-run, not per-job

**Decision**: Each execution attempt creates a separate `ExecutionHistory` record, not a single mutable record per job.

**Reasoning**: A job may be retried multiple times, each by a different worker. An append-only history gives full traceability — you can see which worker ran which attempt, what the logs were, and when it started/ended. Mutating a single record would lose this audit trail.

---

## What I'd Improve with More Time

1. **Redis Adapter for Socket.IO** — for multi-instance API deployment, add `@socket.io/redis-adapter` so broadcasts reach all connected clients regardless of which API instance handles the socket connection.

2. **Distributed scheduler lock** — use `redlock` to ensure the heartbeat scheduler only runs on one API instance at a time.

3. **Job DAG / dependencies** — allow jobs to declare dependencies on other jobs, enabling workflow pipelines.

4. **Authentication** — JWT-based auth middleware on all routes, with worker API keys issued at registration time.

5. **Metrics endpoint** — `/metrics` in Prometheus format for Grafana integration. BullMQ metrics (queue depth, processing rate, failure rate) are particularly valuable.

6. **Dead-letter queue UI** — a dedicated view for permanently failed jobs with detailed error inspection and bulk retry.
