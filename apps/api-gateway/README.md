# Run the NestFlux API Gateway

The NestFlux API Gateway is the public Hypertext Transfer Protocol (HTTP) boundary for the platform. This guide explains the service boundary, validated startup configuration, and local commands.

## Understand the service boundary

The gateway accepts browser and client requests. It owns authentication, authorization, upload admission, and asset lifecycle records.

The gateway will:

- Validate public requests
- Read and write its PostgreSQL data
- Publish processing jobs to RabbitMQ
- Consume processing result events
- Return safe HTTP responses

The gateway will not:

- Process images
- Import worker business logic
- Expose PostgreSQL or RabbitMQ to the browser
- Share runtime state with another application

Read the [NestFlux architecture](../../docs/architecture.md) for all service boundaries and message flows.

## Check the prerequisites

Run commands from the repository root. Install Node.js 20 or newer and pnpm 12.1.0 before starting the service.

Install all workspace dependencies:

```powershell
pnpm install
```

## Run local PostgreSQL

The repository's `compose.yaml` starts the PostgreSQL database that the API Gateway will own. It binds PostgreSQL to `127.0.0.1:5432`, so the database accepts connections only from your computer.

Create your ignored local configuration from the tracked template, then replace the password in both `POSTGRES_PASSWORD` and `DATABASE_URL`:

```powershell
Copy-Item .\.env.example .\.env
code .\.env
```

Start PostgreSQL and wait for its health check:

```powershell
docker compose up -d
docker compose ps
```

The `postgres` service must show `healthy` before you connect to it. Verify the configured database and role without printing a password:

```powershell
docker compose exec postgres pg_isready -U nestflux -d nestflux
docker compose exec postgres psql -U nestflux -d nestflux -c 'SELECT current_database(), current_user;'
```

Stop the container when you do not need it:

```powershell
docker compose down
```

`docker compose down` preserves the `postgres-data` volume. Do not add `-v` unless you intend to delete the local database.

## Manage the gateway database schema

Prisma stores the Gateway's schema in `prisma/schema.prisma` and database settings in `prisma.config.ts`. The first migration creates `Asset` records and their processing states.

Validate the schema and inspect migration state:

```powershell
pnpm --filter '@nestflux/api-gateway' prisma:validate
pnpm --filter '@nestflux/api-gateway' prisma:migrate:status
```

Create a migration during local development after changing the schema, then regenerate the Prisma client:

```powershell
pnpm --filter '@nestflux/api-gateway' prisma:migrate:dev -- --name add_asset_field
pnpm --filter '@nestflux/api-gateway' prisma:generate
```

Use `prisma:migrate:deploy` only outside local development. It applies committed migrations without creating new ones. Generated Prisma client code stays ignored because the schema recreates it.

## Configure gateway startup

The gateway validates these environment variables before it opens an HTTP port. You may omit all three during local development.

| Variable | Default | Accepted value |
| --- | --- | --- |
| `NODE_ENV` | `development` | `development`, `test`, or `production` |
| `PORT` | `3000` | An integer from `1` through `65535` |
| `API_PREFIX` | `api/v1` | Lowercase path segments, such as `api/v2` |

Set custom values in PowerShell before starting the service:

```powershell
$env:PORT = '3100'
$env:API_PREFIX = 'api/v2'
pnpm --filter '@nestflux/api-gateway' start:prod
```

An invalid value stops startup and reports every invalid variable. The gateway does not open a port when configuration validation fails.

## Run the gateway locally

Start the gateway in watch mode:

```powershell
pnpm --filter '@nestflux/api-gateway' start:dev
```

The default service listens on port `3000` and exposes the `api/v1` prefix. Call the liveness endpoint from another PowerShell terminal:

```powershell
Invoke-RestMethod -Uri 'http://localhost:3000/api/v1/health/live' -Method Get
```

The endpoint returns:

```json
{
  "status": "ok"
}
```

Use the readiness endpoint before routing traffic to the gateway:

```powershell
Invoke-RestMethod -Uri 'http://localhost:3000/api/v1/health/ready' -Method Get
```

Both endpoints return `200` while the Nest process is running. Readiness does not check a database or RabbitMQ yet because this lesson has not added either dependency. Later lessons will extend readiness to verify the services that must be available before the gateway accepts traffic.

A global validation pipe rejects unknown request properties when a route uses data transfer objects.

Press `Ctrl+C` to stop the service. Nest handles the `SIGINT` signal and runs registered shutdown hooks before the process exits.

## Validate gateway changes

Run each check from the repository root:

```powershell
pnpm --filter '@nestflux/api-gateway' lint
pnpm --filter '@nestflux/api-gateway' test
pnpm --filter '@nestflux/api-gateway' test:e2e
pnpm --filter '@nestflux/api-gateway' build
```

These commands check static analysis, unit tests, HTTP integration, and production compilation.

## Navigate the scaffold

The generated source has these entry points:

- `src/main.ts`: creates and starts the Nest application
- `src/app.module.ts`: defines the root Nest module
- `src/config/app.config.ts`: exposes namespaced application configuration
- `src/config/environment.validation.ts`: validates startup variables
- `src/configure-http-app.ts`: applies the route prefix and global validation
- `src/health/health.module.ts`: owns the health feature
- `src/health/health.controller.ts`: exposes liveness and readiness routes
- `prisma.config.ts`: loads the root database URL for Prisma commands
- `prisma/schema.prisma`: defines the Gateway-owned data model
- `prisma/migrations/`: records ordered PostgreSQL schema changes
- `test/app.e2e-spec.ts`: tests the HTTP request path

Future features will use focused Nest modules instead of adding unrelated behavior to the root files.

## Treat deployment as unfinished

Do not deploy the gateway as a production service yet. Later lessons will add database access, RabbitMQ messaging, image processing, containerization, and production infrastructure.
