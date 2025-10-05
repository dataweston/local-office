# Local Office Dispatcher

This service will manage courier integrations for Dispatch, Uber Direct, and Olo-originated orders. It will expose adapters that conform to a shared `CourierAdapter` interface and surface normalized delivery updates back to the core API.

## Integration notes
- Maintain idempotency keys and retry policies for create/cancel operations.
- Verify and parse incoming webhooks for each vendor.
- Publish delivery status changes via the shared delivery update channel.

## Required environment variables

| Variable | Description |
| --- | --- |
| `DISPATCH_API_KEY` | API key used to authorize Dispatch HTTP requests. |
| `DISPATCH_BASE_URL` | Base URL for the Dispatch REST API (e.g. `https://api.dispatch.me/v1`). |
| `DISPATCH_WEBHOOK_SECRET` | Shared secret for validating Dispatch webhook signatures. |
| `UBER_DIRECT_CLIENT_ID` | OAuth client ID for Uber Direct. |
| `UBER_DIRECT_CLIENT_SECRET` | OAuth client secret for Uber Direct. |
| `UBER_DIRECT_WEBHOOK_SECRET` | HMAC secret for Uber Direct webhooks. |
| `UBER_DIRECT_BASE_URL` | Base URL for the Uber Direct delivery API (defaults to the production host when unset). |
| `UBER_DIRECT_AUTH_URL` | OAuth token endpoint base URL (defaults to the production login host when unset). |
| `OLO_API_KEY` | API key for Olo courier requests. |
| `OLO_BASE_URL` | Base URL for Olo delivery operations. |
| `OLO_WEBHOOK_SECRET` | HMAC secret shared by the Olo webhook integration. |
| `REDIS_URL` / `DISPATCHER_REDIS_URL` | Connection string for the Redis instance backing the BullMQ delivery updates queue. |

Set `DISPATCHER_REDIS_URL` when the dispatcher service should point to a Redis instance different from the default `REDIS_URL` used elsewhere.

## Testing

Integration tests mock the vendor APIs and verify request/response normalization, retry behaviour, signature verification, and BullMQ publishing hooks. Run them with:

```bash
pnpm --filter @local-office/dispatcher test
```
