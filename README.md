# JobFlux — Distributed Job Execution Platform

A production-ready distributed job execution platform built with Node.js, Next.js, PostgreSQL, Redis, and BullMQ. Workers register themselves, process jobs asynchronously, and report progress in real-time via Socket.IO.

---

## Architecture at a Glance

```
Browser (Next.js) ──── WebSocket ────► API Server (Express)
                    ──── REST ────────►      │
                                             ├─── PostgreSQL (job state)
                                             ├─── Redis / BullMQ (queue)
                                             └─── Scheduler (heartbeat monitor)
                                                      │
                                            Workers (BullMQ consumers)
                                                pull jobs, report progress
```

---

## Repository Structure

```
.
├── apps/
│   ├── api-server/          # Express + Socket.IO + BullMQ
│   │   ├── prisma/          # Schema, migrations
│   │   ├── src/
│   │   │   ├── routes/      # REST endpoints
│   │   │   ├── services/    # Business logic
│   │   │   ├── schedulers/  # Heartbeat monitor
│   │   │   └── socket/      # Socket.IO server
│   │   └── tests/
│   ├── worker/              # BullMQ worker process
│   │   └── src/
│   │       ├── workerService.ts   # Registration + heartbeat
│   │       └── jobExecutor.ts    # Job simulation
│   └── web/                 # Next.js App Router dashboard
│       └── src/app/
│           ├── dashboard/
│           ├── jobs/
│           ├── workers/
│           ├── history/
│           └── submit/
├── packages/
│   ├── shared-types/        # TypeScript types shared across apps
│   └── shared-utils/        # Utility functions
├── infrastructure/
│   ├── docker/              # Dockerfiles
│   └── scripts/             # Setup and startup scripts
├── docker-compose.yml
├── README.md
├── Architecture.md
└── Agent.md
```

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 20+ |
| Docker + Docker Compose | 24+ |
| npm | 10+ |

---

## Quick Start (Docker — Recommended)

The fastest path: everything runs in containers with one command.

```bash
# Clone and enter the repo
git clone <repo-url>
cd distributed-job-platform

# Build and start all services
docker-compose up --build

# In a separate terminal, seed sample data (optional)
docker exec jobflux-api npm run db:seed -w apps/api-server
```

Services will be available at:

| Service | URL |
|---------|-----|
| Web Dashboard | http://localhost:3000 |
| API Server | http://localhost:3001 |
| API Health | http://localhost:3001/health |

---

## Local Development Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Start infrastructure

```bash
docker-compose up -d postgres redis
```

### 3. Configure environment files

```bash
cp apps/api-server/.env.example apps/api-server/.env
cp apps/worker/.env.example     apps/worker/.env
cp apps/web/.env.example        apps/web/.env
```

### 4. Run database migrations

```bash
cd apps/api-server
npx prisma migrate dev
npx prisma generate
cd ../..
```

### 5. Start all services

```bash
# All services in parallel
npm run dev

# Or individually:
npm run dev:api      # API server on :3001
npm run dev:worker   # Worker process
npm run dev:web      # Next.js on :3000
```

### 6. (Optional) Seed sample data

```bash
npm run db:seed -w apps/api-server
```

---

## Environment Variables

### `apps/api-server/.env`

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | HTTP port |
| `DATABASE_URL` | `postgresql://postgres:password@localhost:5432/jobplatform` | Postgres connection |
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `CORS_ORIGIN` | `http://localhost:3000` | Allowed CORS origin |
| `LOG_LEVEL` | `info` | Winston log level |

### `apps/worker/.env`

| Variable | Default | Description |
|----------|---------|-------------|
| `API_URL` | `http://localhost:3001` | API server URL |
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `WORKER_NAME` | auto-generated | Unique worker name |

### `apps/web/.env`

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | API URL (browser-visible) |

---

## Running Tests

```bash
# All tests
npm test

# Individual apps
npm test -w apps/api-server
npm test -w apps/worker
npm test -w apps/web

# With coverage
npm test -w apps/api-server -- --coverage
```

---

## API Reference

### Jobs

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/jobs` | Submit a new job |
| `GET` | `/api/jobs` | List jobs (paginated, filterable by status) |
| `GET` | `/api/jobs/stats` | Dashboard statistics |
| `GET` | `/api/jobs/:id` | Job detail with execution history |
| `POST` | `/api/jobs/:id/retry` | Manually retry a failed job |

### Workers

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/workers/register` | Register a worker |
| `POST` | `/api/workers/heartbeat` | Send heartbeat |
| `GET` | `/api/workers` | List all workers |

### History

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/history` | Execution history (paginated) |

### Example: Submit a job

```bash
curl -X POST http://localhost:3001/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "type": "data-processing",
    "payload": { "inputFile": "s3://bucket/data.csv" },
    "priority": 1,
    "maxRetries": 3
  }'
```

Priority values: `1` = High, `2` = Medium, `3` = Low

---

## Scaling Workers

To run additional workers:

```bash
# Docker
docker-compose up -d --scale worker=5

# Local (each in a new terminal)
WORKER_NAME=worker-local-2 npm run dev:worker
WORKER_NAME=worker-local-3 npm run dev:worker
```

---

## Troubleshooting

**Port already in use**
```bash
lsof -i :3001 | awk 'NR>1 {print $2}' | xargs kill -9
lsof -i :3000 | awk 'NR>1 {print $2}' | xargs kill -9
```

**Prisma migration errors**
```bash
cd apps/api-server
npx prisma migrate reset   # WARNING: drops all data
npx prisma migrate dev
```

**Workers not picking up jobs**
- Confirm Redis is running: `redis-cli ping`
- Check worker logs for connection errors
- Ensure `REDIS_HOST` matches in both `api-server` and `worker` env files

**WebSocket not connecting**
- Check `CORS_ORIGIN` in `api-server/.env` matches the frontend URL
- Check `NEXT_PUBLIC_API_URL` in `web/.env`

---

## Assumptions

- Job execution is simulated (5–20s duration, 20% random failure rate) to demonstrate the full lifecycle without real compute workloads
- Workers communicate back to the API server via HTTP (not directly to the database) to keep the architecture clean and allow horizontal scaling
- Auth/multi-tenancy is out of scope for this assessment but the architecture supports adding it via middleware
