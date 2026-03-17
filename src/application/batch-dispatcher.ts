import type { CallRecordEnricher } from '../enrichment/call-record-enricher';
import type { CallRecordRepository } from '../ports/call-record-repository.port';
import type { SearchIndex } from '../ports/search-index.port';
import type { CallRecord } from '../schemas/call-record.schema';
import { BatchProcessor } from './batch-processor';

export class BatchDispatcher {
  public constructor(
    private readonly enricher: CallRecordEnricher,
    private readonly repository: CallRecordRepository,
    private readonly searchIndex: SearchIndex
  ) {}

  public dispatch(records: CallRecord[]): void {
    const processor = new BatchProcessor(records, this.enricher, this.repository, this.searchIndex);

    processor.execute().catch((err) => {
      console.error('[BatchDispatcher] Unhandled processing failure:', err);
    });
  }
}
