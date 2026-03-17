import type { EnrichedCallRecord } from '../schemas/call-record.schema';

export interface SearchIndex {
  indexMany(records: EnrichedCallRecord[]): Promise<void>;
}
