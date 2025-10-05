# local-office

This directory groups every Local Office package, service, and document in preparation for promoting the stack into its own repository.

## Layout
- `apps/web` - Next.js 14 front end for employee, admin, provider, and demo flows.
- `services/` - NestJS API plus background workers (billing, dispatcher, labeler, worker).
- `packages/` - Shared Local Office artefacts (db schema, TypeScript library, UI kit, OpenAPI contracts, infra docs).
- `docs/` - Deployment and implementation guides that were previously under `docs/local-office`.

The original pnpm workspace now includes the `local-office/*` globs so existing commands like `pnpm --filter @local-office/web dev` continue to work while we stage the extraction.

When we are ready to cut a standalone repository, this folder can become the root and be wired back into the monorepo via a submodule or workspace dependency.

