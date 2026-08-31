import type { AssetUploadedEvent } from "../src/index.js";

const assetUploadedEvent: AssetUploadedEvent = {
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

void assetUploadedEvent;

const unsupportedEvent: AssetUploadedEvent = {
  ...assetUploadedEvent,
  // @ts-expect-error Only the asset.uploaded event name is valid for this contract.
  type: "asset.completed",
};

void unsupportedEvent;
