# Local Office API Service

This service will provide the REST API for Local Office, including program management, ordering, batching, invoicing, and webhook publishing. The plan is to implement it with NestJS and Prisma against the shared schema in `packages/db`.

## Responsibilities
- Host OpenAPI-defined endpoints under `/v1`
- Enforce order cutoffs, group size limits, and loyalty pricing
- Emit webhooks for state changes and push jobs to the worker queues
