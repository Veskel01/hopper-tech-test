import { describe, expect, it } from 'vitest';

import { CallRecordEnricher } from '../src/enrichment/call-record-enricher';
import type { OperatorLookup } from '../src/enrichment/operator-lookup';
import type { CallRecord } from '../src/schemas/call-record.schema';

const RECORD: CallRecord = {
  id: 'cdr_001',
  callStartTime: '2026-01-21T14:30:00.000Z',
  callEndTime: '2026-01-21T14:35:30.000Z',
  fromNumber: '+14155551234',
  toNumber: '+442071234567',
  callType: 'voice',
  region: 'us-west'
};

describe('CallRecordEnricher', () => {
  it('calculates duration in seconds', async () => {
    const lookup: OperatorLookup = {
      lookup: async () => ({
        operator: 'Op',
        country: 'C',
        estimatedCostPerMinute: 0.02
      })
    };

    const enricher = new CallRecordEnricher(lookup);
    const { record } = await enricher.enrich(RECORD);

    // 5 minutes 30 seconds = 330 seconds
    expect(record.duration).toBe(330);
  });

  it('calculates estimatedCost from fromNumber operator rate', async () => {
    const lookup: OperatorLookup = {
      lookup: async (_phone, _date) => ({
        operator: 'CostOp',
        country: 'CostLand',
        estimatedCostPerMinute: 0.1
      })
    };

    const enricher = new CallRecordEnricher(lookup);
    const { record } = await enricher.enrich(RECORD);

    // 330s = 5.5 min → 5.5 * 0.10 = 0.55
    expect(record.estimatedCost).toBe(0.55);
  });

  it('returns complete status when both lookups succeed', async () => {
    const lookup: OperatorLookup = {
      lookup: async () => ({
        operator: 'Op',
        country: 'C',
        estimatedCostPerMinute: 0.01
      })
    };

    const enricher = new CallRecordEnricher(lookup);
    const result = await enricher.enrich(RECORD);

    expect(result.status).toBe('complete');
    expect(result.warnings).toHaveLength(0);
  });

  it('returns partial status with warnings when from-lookup fails', async () => {
    let callCount = 0;
    const lookup: OperatorLookup = {
      lookup: async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error('from lookup failed');
        }
        return { operator: 'ToOp', country: 'ToCountry', estimatedCostPerMinute: 0.05 };
      }
    };

    const enricher = new CallRecordEnricher(lookup);
    const result = await enricher.enrich(RECORD);

    expect(result.status).toBe('partial');
    expect(result.record.fromOperator).toBeUndefined();
    expect(result.record.toOperator).toBe('ToOp');
    expect(result.record.estimatedCost).toBeUndefined();
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('formats callDate as yy-MM-dd for the operator API', async () => {
    let capturedDate = '';
    const lookup: OperatorLookup = {
      lookup: async (_phone, date) => {
        capturedDate = date;
        return { operator: 'Op', country: 'C', estimatedCostPerMinute: 0.01 };
      }
    };

    const enricher = new CallRecordEnricher(lookup);
    await enricher.enrich(RECORD);

    expect(capturedDate).toBe('26-01-21');
  });
});
