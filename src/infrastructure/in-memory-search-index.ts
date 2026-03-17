import type { SearchIndex } from '../ports/search-index.port';
import type { EnrichedCallRecord } from '../schemas/call-record.schema';

export class InMemorySearchIndex implements SearchIndex {
  private readonly documents: EnrichedCallRecord[] = [];

  public async indexMany(records: EnrichedCallRecord[]): Promise<void> {
    this.documents.push(...records);
  }
}
