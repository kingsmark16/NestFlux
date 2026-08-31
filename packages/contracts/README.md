# Share NestFlux message contracts

`@nestflux/contracts` defines TypeScript message shapes shared by independently running NestFlux services. It lets the API Gateway and processing worker agree on event data without importing each other’s modules or business logic.

## Use the asset upload event

Import the `AssetUploadedEvent` type when a service publishes or consumes the first processing event:

```typescript
import type { AssetUploadedEvent } from "@nestflux/contracts";

const event: AssetUploadedEvent = {
  type: "asset.uploaded",
  eventId: "event_123",
  occurredAt: "2026-08-31T00:00:00.000Z",
  data: {
    assetId: "asset_123",
    storageKey: "assets/storage-key",
    originalFilename: "sunset.jpg",
    contentType: "image/jpeg",
    sizeBytes: 1024,
  },
};
```

The package contains types only. It creates no runtime link between the Gateway and worker.

## Check and build the package

Run the compiler checks from the repository root:

```powershell
pnpm --filter '@nestflux/contracts' check
pnpm --filter '@nestflux/contracts' test
pnpm --filter '@nestflux/contracts' build
```

`test` type-checks a valid event and confirms TypeScript rejects an unsupported event name. `build` writes declaration files and an empty JavaScript entry point to `dist/`.
