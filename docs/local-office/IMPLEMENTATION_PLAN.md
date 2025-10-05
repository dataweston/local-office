# Local Office Implementation Plan

This document captures the high-level roadmap for delivering the Local Office platform within the existing monorepo. It translates the product specification into actionable engineering milestones.

## 1. Repository structure
- Adopt the `/apps`, `/services`, and `/packages` layout with clear ownership boundaries.
- Ensure shared dependencies (Prisma schema, contracts, UI components, infra assets) live under `/packages` for reuse.

## 2. Initial scaffolding
- Initialize a Next.js 14 application in `local-office/apps/web` with shadcn/ui and Tailwind.
- Bootstrap NestJS services in `local-office/services/api`, `local-office/services/dispatcher`, and `local-office/services/billing`.
- Create Node-based workers for `local-office/services/worker` and `local-office/services/labeler` with BullMQ integration.

## 3. Data model
- Define the Prisma schema under `local-office/packages/db`, covering organizations, programs, orders, batches, invoices, loyalty, referrals, incidents, delivery jobs, and webhooks.
- Seed baseline SKUs (pizza and sandwiches) sourced from the Midwest.

## 4. Contracts and tooling
- Author the OpenAPI 3.1 specification in `local-office/packages/contracts/openapi.yaml` for all `/v1` endpoints and webhook payloads.
- Generate TypeScript SDKs and JSON Schemas for internal consumption and external integrations.

## 5. Core functionality milestones
1. **Order lifecycle**: implement program creation, order capture with T-48 enforcement, confirmation, and payment intent creation.
2. **Batching & labels**: cron-driven batching, manifest generation, PDF/ZPL labels via the labeler service, and webhook emissions.
3. **Delivery orchestration**: integrate Dispatch and Uber Direct adapters, with Olo webhook normalization.
4. **Billing & loyalty**: calculate invoices, loyalty discounts, referral credits, and Square invoice issuance.
5. **Incident management**: capture incidents, route to SLA queues, and apply credits.

## 6. Frontend experiences
- Employee ordering flow with clear cutoff messaging and Square payment integration.
- Admin consoles for program configuration, invoices, incidents, loyalty tiers, and referral codes.
- Provider views for manifests, labels, and delivery tracking.

## 7. Infrastructure
- Produce Dockerfiles per service, a Helm chart under `local-office/packages/infra`, and GitHub Actions workflows for CI/CD.
- Configure observability with OpenTelemetry, Prometheus metrics, and BullMQ dashboards.

## 8. Compliance and security
- Enforce role-based access control, JWT authentication, webhook signing, and idempotency across services.
- Store only necessary payment identifiers, relying on Square for PCI scope.
- [done] Initial HS256 bearer guard with role checks now protects every API controller (requires AUTH_JWT_SECRET and role-bearing tokens).

## 9. Next steps
- Finalize service scaffolding with package managers and dependency setup.
- Begin implementing the Prisma schema and automated tests for the critical flows above.





