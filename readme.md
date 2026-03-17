# Hopper Tech Test

## Getting Started

Please refer to [coding-exercise.md](./coding-exercise.md) for the full problem description and instructions.

## Submitting your solution

Create your solution in a fork of this repository. Once you're ready to submit, please add dmanning-resilient as a collaborator on your private repository and send us a message.

## Candidate Notes

### Running

```bash
npm install
npm test          # vitest — unit + integration tests
npm run typecheck # tsc --noEmit
```

### Architecture

```
CSV payload
  → CallHandler          (thin handler — parse, validate, ack <500ms)
  → BatchDispatcher      (fire-and-forget — kicks off async processing)
  → BatchProcessor       (pipeline: enrich → persist → project)
      ├─ CallRecordEnricher          (parallel operator lookups, partial enrichment)
      ├─ CallRecordRepository        (source of truth, idempotent upsert)
      └─ SearchIndex                 (eventually consistent projection)
```

### Key decisions

- **Zod as single source of truth** — `CallRecord` and `EnrichedCallRecord` types are inferred from schemas, no manual interfaces.
- **Sub-500ms ack** — handler does synchronous validation only; enrichment + storage runs in background via dispatcher.
- **Partial enrichment** — `Promise.allSettled` on operator lookups; one failure doesn't block the other or the whole batch.
- **Retry with bounded attempts** — `OperatorLookup` wraps the flaky API (2 retries, 100ms delay).
- **Repository = commit point** — search index failure never rolls back persisted data, only marks `projectionRetryPending`.
- **Ports & adapters** — infrastructure behind interfaces (`CallRecordRepository`, `SearchIndex`), wired via constructor injection.
- **In-memory implementations** — stubs for repository (Map-based, idempotent) and search index (array-based); in production these would be e.g. PostgreSQL and Elasticsearch.

### Trade-offs

- No real queue/message broker — dispatcher uses fire-and-forget `Promise`; production would use e.g. BullMQ or SQS.
- No projection retry mechanism — `projectionRetryPending` is tracked but not acted on; a real system would have a scheduled reconciler.
- Batch-atomic validation — a single invalid record rejects the entire batch; this is intentional to prevent silent partial ingestion.


### AI Usage

I used AI to generate the code. I used the following tools:

- [Cursor](https://www.cursor.com/)
- [Codex](https://github.com/openai/codex)
