# Local Office Labeler

The labeler service will turn batch manifests into printable outputs. It will render both PDF (Avery 5163) and ZPL assets, attach them to batches, and expose signed URLs for providers.

## Roadmap
- Accept jobs from the `labels` queue with batch context
- Generate QR codes that reference the internal order ID
- Upload artifacts to object storage and report back to the API/worker layer
