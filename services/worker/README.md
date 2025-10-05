# Local Office Worker

Node.js worker powered by BullMQ that handles asynchronous tasks such as batching, label generation requests, webhook delivery, notification fan-out, and invoice preparation. Jobs are implemented in modular handlers under `src/jobs` to keep domain logic isolated and testable.

## Planned queues
- `batcher` for cutoff processing
- `labels` for PDF/ZPL generation
- `dispatcher` for delivery job orchestration
- `notify` for email/SMS
- `invoice` for closeout and Square invoice creation
- `webhook-out` for outbound webhook retries

## Configuration

The worker is configured entirely through environment variables. The following variables are recognised:

| Variable | Description | Default |
| --- | --- | --- |
| `REDIS_URL` | Connection string for Redis/BullMQ | `redis://localhost:6379` |
| `WORKER_BATCHER_CONCURRENCY` | Concurrent batcher jobs | `4` |
| `WORKER_BATCHER_ATTEMPTS` | Retry attempts for batcher jobs | `3` |
| `WORKER_BATCHER_RETRY_DELAY_MS` | Backoff delay for batcher retries | `60000` |
| `WORKER_LABELS_CONCURRENCY` | Concurrent label renders | `2` |
| `WORKER_LABELS_ATTEMPTS` | Retry attempts for label jobs | `3` |
| `WORKER_LABELS_RETRY_DELAY_MS` | Backoff base delay for label jobs | `30000` |
| `WORKER_NOTIFY_CONCURRENCY` | Notification send concurrency | `5` |
| `WORKER_NOTIFY_ATTEMPTS` | Retry attempts for notification jobs | `2` |
| `WORKER_NOTIFY_RETRY_DELAY_MS` | Backoff delay for notification retries | `15000` |
| `WORKER_INVOICE_CONCURRENCY` | Concurrent invoice aggregation jobs | `1` |
| `WORKER_INVOICE_ATTEMPTS` | Retry attempts for invoice jobs | `1` |
| `WORKER_WEBHOOK_CONCURRENCY` | Concurrent webhook deliveries | `3` |
| `WORKER_WEBHOOK_ATTEMPTS` | Retry attempts for webhooks | `5` |
| `WORKER_WEBHOOK_RETRY_DELAY_MS` | Base delay for webhook retries (exponential backoff) | `10000` |
| `BATCHER_LOCK_CRON` | Cron expression for recurring cutoff/batch locking | _unset_ |
| `LABEL_REFRESH_CRON` | Cron expression to regenerate missing labels | _unset_ |
| `NOTIFY_DISPATCH_CRON` | Cron expression to fan out queued notifications | _unset_ |
| `INVOICE_GENERATION_CRON` | Cron expression to aggregate invoices | _unset_ |
| `WEBHOOK_OUTBOX_CRON` | Cron expression to flush the webhook outbox | _unset_ |

Providing a cron expression enables the worker to schedule repeatable jobs for the corresponding queue. When unset, the queue on
ly processes ad-hoc jobs published by the application layer.

## Testing

This package uses [Vitest](https://vitest.dev/) against a local Redis instance to exercise BullMQ handlers. Ensure Redis is avai
lable on `127.0.0.1:6379` (e.g. via `redis-server --daemonize yes`) and run:

```bash
pnpm --filter @local-office/worker test
```
