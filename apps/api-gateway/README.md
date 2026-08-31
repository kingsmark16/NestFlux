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

The default service listens on port `3000` and exposes the `api/v1` prefix. Call its placeholder endpoint from another PowerShell terminal:

```powershell
Invoke-RestMethod -Uri 'http://localhost:3000/api/v1' -Method Get
```

The endpoint currently returns `Hello World!`. A global validation pipe already rejects unknown request properties when a route uses data transfer objects.

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
- `src/app.controller.ts`: exposes the placeholder HTTP route
- `src/app.service.ts`: returns the placeholder response
- `src/app.controller.spec.ts`: tests the controller in isolation
- `src/config/app.config.ts`: exposes namespaced application configuration
- `src/config/environment.validation.ts`: validates startup variables
- `src/configure-http-app.ts`: applies the route prefix and global validation
- `test/app.e2e-spec.ts`: tests the HTTP request path

Future features will use focused Nest modules instead of adding unrelated behavior to the root files.

## Treat deployment as unfinished

Do not deploy the scaffold as a production service. Later lessons will add health checks, database access, RabbitMQ messaging, image processing, containerization, and production infrastructure.
