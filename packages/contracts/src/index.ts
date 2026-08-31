export type AssetUploadedEvent = Readonly<{
  type: "asset.uploaded";
  eventId: string;
  occurredAt: string;
  data: Readonly<{
    assetId: string;
    storageKey: string;
    originalFilename: string;
    contentType: string;
    sizeBytes: number;
  }>;
}>;
