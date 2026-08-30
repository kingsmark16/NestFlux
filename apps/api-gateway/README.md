# Develop the NestFlux API Gateway

The NestFlux API Gateway is the public Hypertext Transfer Protocol (HTTP) boundary for the platform. This guide explains its responsibility, local commands, and current scaffold state.

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

## Run the gateway locally

Start the gateway in watch mode:

```powershell
pnpm --filter '@nestflux/api-gateway' start:dev
```

The current scaffold listens on port `3000`. Call its placeholder endpoint from another PowerShell terminal:

```powershell
Invoke-RestMethod -Uri 'http://localhost:3000/' -Method Get
```

The endpoint currently returns `Hello World!`. A later lesson will replace it with health and versioned Application Programming Interface (API) routes.

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
- `test/app.e2e-spec.ts`: tests the HTTP request path

Future features will use focused Nest modules instead of adding unrelated behavior to the root files.

## Treat deployment as unfinished

Do not deploy the scaffold as a production service. Later lessons will add configuration validation, request validation, health checks, graceful shutdown, containerization, and production infrastructure.
