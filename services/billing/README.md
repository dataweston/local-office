# Local Office Billing Service

Handles payment orchestration with Square and prepares weekly/monthly invoices for organizations. It will collaborate with the worker for scheduled closeouts and rely on the Prisma schema defined in `packages/db` for data access.

## Key capabilities
- Create Square payment intents during order confirmation
- Generate Square invoices with ACH-preferred payment methods
- Apply loyalty discounts, referral credits, and payment fees consistently
