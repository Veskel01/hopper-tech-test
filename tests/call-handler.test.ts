import { describe, expect, it } from 'vitest';

import { BatchDispatcher } from '../src/application/batch-dispatcher';
import { CallHandler } from '../src/call-handler';
import { CallRecordEnricher } from '../src/enrichment/call-record-enricher';
import type { OperatorLookup } from '../src/enrichment/operator-lookup';
import { InMemoryCallRecordRepository } from '../src/infrastructure/in-memory-call-record-repository';
import { InMemorySearchIndex } from '../src/infrastructure/in-memory-search-index';

const VALID_CSV = [
  'id,callStartTime,callEndTime,fromNumber,toNumber,callType,region',
  'cdr_001,2026-01-21T14:30:00.000Z,2026-01-21T14:35:30.000Z,+14155551234,+442071234567,voice,us-west'
].join('\n');

function buildHandler(lookupStub?: OperatorLookup) {
  const lookup: OperatorLookup = lookupStub ?? {
    lookup: async () => ({
      operator: 'StubOp',
      country: 'StubCountry',
      estimatedCostPerMinute: 0.01
    })
  };
  const enricher = new CallRecordEnricher(lookup);
  const repo = new InMemoryCallRecordRepository();
  const index = new InMemorySearchIndex();
  const dispatcher = new BatchDispatcher(enricher, repo, index);
  return { handler: new CallHandler(dispatcher), repo, index };
}

describe('CallHandler', () => {
  it('rejects an empty payload with ok: false', async () => {
    const { handler } = buildHandler();
    const result = await handler.handleBatch('');
    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('rejects a whitespace-only payload', async () => {
    const { handler } = buildHandler();
    const result = await handler.handleBatch('   \n  ');
    expect(result.ok).toBe(false);
  });

  it('rejects CSV with invalid E.164 number', async () => {
    const csv = [
      'id,callStartTime,callEndTime,fromNumber,toNumber,callType,region',
      'cdr_bad,2026-01-21T14:30:00.000Z,2026-01-21T14:35:30.000Z,12345,+442071234567,voice,us-west'
    ].join('\n');
    const { handler } = buildHandler();
    const result = await handler.handleBatch(csv);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('E.164');
  });

  it('rejects CSV where callEndTime is before callStartTime', async () => {
    const csv = [
      'id,callStartTime,callEndTime,fromNumber,toNumber,callType,region',
      'cdr_bad,2026-01-21T14:35:30.000Z,2026-01-21T14:30:00.000Z,+14155551234,+442071234567,voice,us-west'
    ].join('\n');
    const { handler } = buildHandler();
    const result = await handler.handleBatch(csv);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('callEndTime must be after callStartTime');
  });

  it('acknowledges a valid batch with ok: true without awaiting enrichment', async () => {
    const slowLookup: OperatorLookup = {
      lookup: () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                operator: 'SlowOp',
                country: 'SlowLand',
                estimatedCostPerMinute: 0.05
              }),
            5000
          )
        )
    };

    const { handler } = buildHandler(slowLookup);

    const start = Date.now();
    const result = await handler.handleBatch(VALID_CSV);
    const elapsed = Date.now() - start;

    expect(result).toEqual({ ok: true });
    expect(elapsed).toBeLessThan(500);
  });

  it('dispatches records so they eventually reach the repository', async () => {
    const { handler, repo } = buildHandler();
    await handler.handleBatch(VALID_CSV);

    // Give the background processor time to complete
    await new Promise((r) => setTimeout(r, 200));

    const stored = repo.getAll();
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe('cdr_001');
  });
});
