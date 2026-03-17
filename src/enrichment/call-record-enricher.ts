import type { CallRecord, EnrichedCallRecord } from '../schemas/call-record.schema';
import { durationInSeconds, toShortDate } from '../utils/date';
import type { OperatorLookup } from './operator-lookup';

export type EnrichmentStatus = 'complete' | 'partial';

export interface EnrichmentResult {
  record: EnrichedCallRecord;
  status: EnrichmentStatus;
  warnings: string[];
}

export class CallRecordEnricher {
  public constructor(private readonly operatorLookup: OperatorLookup) {}

  public async enrich(record: CallRecord): Promise<EnrichmentResult> {
    const warnings: string[] = [];
    const duration = durationInSeconds(record.callStartTime, record.callEndTime);
    const callDate = toShortDate(record.callStartTime);

    const [fromResult, toResult] = await Promise.allSettled([
      this.operatorLookup.lookup(record.fromNumber, callDate),
      this.operatorLookup.lookup(record.toNumber, callDate)
    ]);

    const fromInfo = fromResult.status === 'fulfilled' ? fromResult.value : undefined;
    const toInfo = toResult.status === 'fulfilled' ? toResult.value : undefined;

    if (fromResult.status === 'rejected') {
      warnings.push(`fromNumber lookup failed: ${fromResult.reason}`);
    }
    if (toResult.status === 'rejected') {
      warnings.push(`toNumber lookup failed: ${toResult.reason}`);
    }

    const durationMinutes = duration / 60;
    const estimatedCost = fromInfo
      ? Math.round(durationMinutes * fromInfo.estimatedCostPerMinute * 10_000) / 10_000
      : undefined;

    const enrichedRecord: EnrichedCallRecord = {
      ...record,
      duration,
      fromOperator: fromInfo?.operator,
      toOperator: toInfo?.operator,
      fromCountry: fromInfo?.country,
      toCountry: toInfo?.country,
      estimatedCost
    };

    const status: EnrichmentStatus = fromInfo && toInfo ? 'complete' : 'partial';

    return { record: enrichedRecord, status, warnings };
  }
}
