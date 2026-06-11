#!/bin/bash
set -e

echo "==> Setting up distributed-job-platform for local development"

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "❌ Node.js 20+ required"; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "❌ Docker required"; exit 1; }

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
  echo "❌ Node.js 20+ required, found $(node --version)"; exit 1
fi

echo "✓ Node.js $(node --version)"

# Install dependencies
echo "==> Installing npm workspaces..."
npm install

# Copy env files
for dir in apps/api-server apps/worker apps/web; do
  if [ ! -f "$dir/.env" ]; then
    cp "$dir/.env.example" "$dir/.env"
    echo "✓ Created $dir/.env"
  fi
done

# Start infra
echo "==> Starting PostgreSQL and Redis..."
docker-compose up -d postgres redis

echo "==> Waiting for services to be healthy..."
sleep 5

# Run migrations
echo "==> Running database migrations..."
cd apps/api-server
npx prisma migrate deploy
npx prisma generate
cd ../..

echo ""
echo "✅ Setup complete!"
echo ""
echo "Run the platform:"
echo "  npm run dev"
echo ""
echo "Or with Docker:"
echo "  docker-compose up --build"
