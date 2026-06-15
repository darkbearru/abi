# AI Book Illustrator

Monorepo scaffold for AI Book Illustrator.

## Structure

```text
apps/
  api/              NestJS backend
  web/              Vue 3 frontend
  worker/           NestJS/BullMQ workers

packages/
  shared/           Shared TypeScript types
  ai-core/          AI provider abstractions
  storage/          Storage provider abstractions
  prompts/          Prompt template contracts
  validation/       Shared validation schemas

infra/
  docker/
  docker-compose.yml
  docker-compose.dev.yml
```

## Setup

```bash
cp .env.example .env
npm install
```

## Development

```bash
npm run dev
```

This starts all workspaces that define a `dev` script.

## Checks

```bash
npm run build
npm run typecheck
npm run lint
npm test
```

## Infrastructure

```bash
docker compose -f infra/docker-compose.yml up -d
```

This starts:

- PostgreSQL
- Redis
- Qdrant
- Neo4j
- API
- Worker
- Web

The application services wait for infrastructure healthchecks before starting. Local image/file
storage is mounted into the containers from `./storage`.

### Development Compose

Use the dev override when you want source files mounted into the app containers:

```bash
docker compose -f infra/docker-compose.yml -f infra/docker-compose.dev.yml up --build
```

### Optional MinIO

MinIO is behind the `storage` profile for later S3-compatible storage work:

```bash
docker compose -f infra/docker-compose.yml --profile storage up -d minio
```

### Validate Compose

```bash
docker compose -f infra/docker-compose.yml config
docker compose -f infra/docker-compose.yml -f infra/docker-compose.dev.yml config
```
