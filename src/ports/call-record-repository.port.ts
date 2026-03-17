import type { EnrichedCallRecord } from '../schemas/call-record.schema';

export interface CallRecordRepository {
  upsertMany(records: EnrichedCallRecord[]): Promise<void>;
  getById(id: string): EnrichedCallRecord | undefined;
  getAll(): EnrichedCallRecord[];
}
