import { describe, expect, it } from 'vitest';

import { BatchProcessor } from '../src/application/batch-processor';
import { CallRecordEnricher } from '../src/enrichment/call-record-enricher';
import type { OperatorLookup } from '../src/enrichment/operator-lookup';
import { InMemoryCallRecordRepository } from '../src/infrastructure/in-memory-call-record-repository';
import { InMemorySearchIndex } from '../src/infrastructure/in-memory-search-index';
import type { CallRecordRepository } from '../src/ports/call-record-repository.port';
import type { SearchIndex } from '../src/ports/search-index.port';
import type { CallRecord } from '../src/schemas/call-record.schema';

const SAMPLE_RECORD: CallRecord = {
  id: 'cdr_001',
  callStartTime: '2026-01-21T14:30:00.000Z',
  callEndTime: '2026-01-21T14:35:30.000Z',
  fromNumber: '+14155551234',
  toNumber: '+442071234567',
  callType: 'voice',
  region: 'us-west'
};

const HAPPY_LOOKUP: OperatorLookup = {
  lookup: async () => ({
    operator: 'TestOp',
    country: 'TestLand',
    estimatedCostPerMinute: 0.02
  })
};

function buildProcessor(opts?: { lookup?: OperatorLookup; searchIndex?: SearchIndex }) {
  const repo = new InMemoryCallRecordRepository();
  const index = opts?.searchIndex ?? new InMemorySearchIndex();
  const enricher = new CallRecordEnricher(opts?.lookup ?? HAPPY_LOOKUP);
  const processor = new BatchProcessor([SAMPLE_RECORD], enricher, repo, index);
  return { processor, repo, index };
}

describe('BatchProcessor', () => {
  it('completes the happy path: enrich → persist → project', async () => {
    const { processor, repo } = buildProcessor();
    const finalState = await processor.execute();

    expect(finalState.status).toBe('completed');
    if (finalState.status === 'completed') {
      expect(finalState.projectionStatus).toBe('indexed');
    }

    const stored = repo.getAll();
    expect(stored).toHaveLength(1);
    expect(stored[0].duration).toBe(330);
    expect(stored[0].fromOperator).toBe('TestOp');
  });

  it('still persists records when a lookup fails (partial enrichment)', async () => {
    const failingLookup: OperatorLookup = {
      lookup: async () => {
        throw new Error('lookup down');
      }
    };

    const { processor, repo } = buildProcessor({ lookup: failingLookup });
    const finalState = await processor.execute();

    expect(finalState.status).toBe('completed');

    const stored = repo.getAll();
    expect(stored).toHaveLength(1);
    expect(stored[0].fromOperator).toBeUndefined();
    expect(stored[0].estimatedCost).toBeUndefined();
    expect(stored[0].duration).toBe(330);

    const results = processor.getEnrichmentResults();
    expect(results[0].status).toBe('partial');
    expect(results[0].warnings.length).toBeGreaterThan(0);
  });

  it('does not roll back the repo write when indexing fails', async () => {
    const failingIndex: SearchIndex = {
      indexMany: async () => {
        throw new Error('index unavailable');
      }
    };

    const { processor, repo } = buildProcessor({ searchIndex: failingIndex });
    const finalState = await processor.execute();

    expect(finalState.status).toBe('completed');
    if (finalState.status === 'completed') {
      expect(finalState.projectionStatus).toBe('projectionRetryPending');
    }

    expect(repo.getAll()).toHaveLength(1);
  });

  it('can be wired with fake ports — no concrete infrastructure dependency', async () => {
    let persisted = false;
    let indexed = false;

    const fakeRepo: CallRecordRepository = {
      upsertMany: async () => {
        persisted = true;
      },
      getById: () => undefined,
      getAll: () => []
    };
    const fakeIndex: SearchIndex = {
      indexMany: async () => {
        indexed = true;
      }
    };
    const enricher = new CallRecordEnricher(HAPPY_LOOKUP);

    const processor = new BatchProcessor([SAMPLE_RECORD], enricher, fakeRepo, fakeIndex);
    await processor.execute();

    expect(persisted).toBe(true);
    expect(indexed).toBe(true);
  });
});
