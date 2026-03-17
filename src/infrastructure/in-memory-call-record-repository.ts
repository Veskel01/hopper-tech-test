import type { CallRecordRepository } from '../ports/call-record-repository.port';
import type { EnrichedCallRecord } from '../schemas/call-record.schema';

export class InMemoryCallRecordRepository implements CallRecordRepository {
  private readonly store = new Map<string, EnrichedCallRecord>();

  public async upsertMany(records: EnrichedCallRecord[]): Promise<void> {
    for (const record of records) {
      this.store.set(record.id, record);
    }
  }

  public getAll(): EnrichedCallRecord[] {
    return Array.from(this.store.values());
  }

  public getById(id: string): EnrichedCallRecord | undefined {
    return this.store.get(id);
  }
}
