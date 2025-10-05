# Local Office deployment playbook

This guide covers the minimum configuration required to run the Local Office stack outside of the legacy Local Effort deployment. It assumes you are provisioning each service in its own process or container.

## Components
- **Next web app** (`local-office/apps/web`): hosts employee, admin, and provider UIs plus the Local Office demo flows.
- **API** (`local-office/services/api`): NestJS gateway for programs, orders, batches, incidents, invoices, referrals, and delivery orchestration.
- **Billing service** (`local-office/services/billing`): wraps Square payments and invoice APIs.
- **Dispatcher service** (`local-office/services/dispatcher`): handles courier adapters (Dispatch, Uber Direct, Olo).
- **Worker** (`local-office/services/worker`): BullMQ processors for batching, label generation, notifications, and webhooks.
- **Labeler** (`local-office/services/labeler`): generates PDF/ZPL payloads referenced by worker jobs.
- **Shared packages** (`local-office/packages/db`, `local-office/packages/lib`, `local-office/packages/contracts`, `local-office/packages/ui`): Prisma schema, utility helpers, generated SDKs, and UI kit.

## Prerequisites
1. **Runtime**: Node.js 20.x with pnpm (enable via `corepack enable`).
2. **Datastores**:
   - PostgreSQL 15+ for Prisma (`DATABASE_URL`).
   - Redis 7+ for BullMQ queues (`REDIS_URL`).
   - Optional object storage (S3-compatible) for rendered labels (`OBJECT_STORAGE_*` envs).
3. **External integrations**:
   - Square access token, location IDs, and webhook secrets.
   - Dispatch and Uber Direct API keys (or sandbox credentials) if delivery orchestration is enabled.
   - Brevo API key for transactional email (optional; worker handles retries when absent).
4. **Authentication**:
   - HMAC secret for API JWTs (`AUTH_JWT_SECRET`).
   - Optional issuer/audience claims (`AUTH_JWT_ISSUER`, `AUTH_JWT_AUDIENCE`).

## Environment snapshot
Add the following variables to your deployment environment (alongside existing Square/Brevo settings):

```
# Local Office API authentication
AUTH_JWT_SECRET=generate_a_long_random_value
AUTH_JWT_ISSUER=local-office
AUTH_JWT_AUDIENCE=local-office-app

# Shared services
DATABASE_URL=postgres://user:pass@host:5432/localoffice
REDIS_URL=redis://host:6379/0
OBJECT_STORAGE_DIR=/var/localoffice/storage            # optional local bucket for development
OBJECT_STORAGE_PUBLIC_URL=https://assets.example.com/   # optional if using real object storage
```

Run the usual Prisma commands once credentials are in place:

```
pnpm install
pnpm --filter @local-office/db generate
pnpm --filter @local-office/db migrate:deploy   # or migrate dev locally
```

## Service startup order
1. **Database migration** (one-time or during deploy): `pnpm --filter @local-office/db migrate:deploy`.
2. **API**: `pnpm --filter @local-office/api build && pnpm --filter @local-office/api start`. The API now refuses to boot without `AUTH_JWT_SECRET`.
3. **Billing/Dispatcher/Labeler**: `pnpm --filter @local-office/billing start`, `pnpm --filter @local-office/dispatcher start`, `pnpm --filter @local-office/labeler start`.
4. **Worker**: `pnpm --filter @local-office/worker start` (ensure it can reach Redis and object storage paths).
5. **Next web app**: `pnpm --filter @local-office/web build && pnpm --filter @local-office/web start`. Configure `NEXT_PUBLIC_API_BASE_URL` to the API origin.

## Generating bearer tokens
Tokens must include a subject (`sub`) and at least one allowed role (`EMPLOYEE`, `ADMIN`, `PROVIDER`). You can mint a short-lived token with Node:

```
node -e "const { SignJWT } = require('jose');
(async () => {
  const secret = new TextEncoder().encode(process.env.AUTH_JWT_SECRET || 'dev-secret');
  const token = await new SignJWT({ email: 'admin@example.com', roles: ['ADMIN'] })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('user-123')
    .setAudience(process.env.AUTH_JWT_AUDIENCE || 'local-office-app')
    .setIssuer(process.env.AUTH_JWT_ISSUER || 'local-office')
    .setExpirationTime('1h')
    .sign(secret);
  console.log(token);
})();"
```

Store the token in the Local Office UI with the header dropdown (top-right) or inject it into automated tests via the `Authorization: Bearer` header.

## Deployment tips
- Package each service with its own process manager (systemd, supervisord, PM2, or containers). The API, worker, and dispatcher must share environment settings for Redis, database, and auth.
- When containerizing, install only filtered workspaces to keep images lean:
  - `pnpm install --filter @local-office/api... --filter @local-office/db...` etc.
- Expose the API on a private network; require HTTPS termination at the gateway or load balancer. The API guard enforces Bearer tokens but does not handle SSL.
- Configure health checks against `/v1/programs?org=ping` once you add a public health endpoint, or wire a dedicated controller.
- Queue backoff and email/webhook retries run inside `local-office/services/worker`. Monitor queue depth via BullMQ dashboards or custom metrics (pending in `local-office/packages/infra`).

## Next steps
- Add Dockerfiles + Helm chart once infrastructure decisions are finalized (tracked in Implementation Plan section 7).
- Layer structured logging/metrics exporters so each service reports to your observability stack.
- Extend the auth guard to accept JWKS or asymmetric keys when integrating with an IdP.

