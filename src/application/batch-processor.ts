import type { CallRecordEnricher, EnrichmentResult } from '../enrichment/call-record-enricher';
import type { CallRecordRepository } from '../ports/call-record-repository.port';
import type { SearchIndex } from '../ports/search-index.port';
import type { CallRecord, EnrichedCallRecord } from '../schemas/call-record.schema';

export type ProjectionStatus = 'indexed' | 'projectionRetryPending';

export type ProcessingState =
  | { readonly status: 'accepted' }
  | { readonly status: 'enriching' }
  | { readonly status: 'persisting' }
  | { readonly status: 'projecting' }
  | { readonly status: 'completed'; readonly projectionStatus: ProjectionStatus }
  | { readonly status: 'failed'; readonly error: string };

type ActiveStatus = 'enriching' | 'persisting' | 'projecting';

export class BatchProcessor {
  private state: ProcessingState = { status: 'accepted' };
  private enrichmentResults: EnrichmentResult[] = [];

  public constructor(
    private readonly records: CallRecord[],
    private readonly enricher: CallRecordEnricher,
    private readonly repository: CallRecordRepository,
    private readonly searchIndex: SearchIndex
  ) {}

  public async execute(): Promise<ProcessingState> {
    try {
      const enriched = await this.runStep('enriching', () => this.enrichRecords());
      await this.runStep('persisting', () => this.persistRecords(enriched));
      const projectionStatus = await this.runStep('projecting', () =>
        this.projectRecords(enriched)
      );

      this.state = { status: 'completed', projectionStatus };
      return this.state;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.state = { status: 'failed', error: message };
      return this.state;
    }
  }

  public getState(): ProcessingState {
    return this.state;
  }

  public getEnrichmentResults(): readonly EnrichmentResult[] {
    return this.enrichmentResults;
  }

  private async enrichRecords(): Promise<EnrichedCallRecord[]> {
    this.enrichmentResults = await Promise.all(this.records.map((r) => this.enricher.enrich(r)));
    return this.enrichmentResults.map((r) => r.record);
  }

  private async persistRecords(records: EnrichedCallRecord[]): Promise<void> {
    await this.repository.upsertMany(records);
  }

  private async projectRecords(records: EnrichedCallRecord[]): Promise<ProjectionStatus> {
    try {
      await this.searchIndex.indexMany(records);
      return 'indexed';
    } catch {
      return 'projectionRetryPending';
    }
  }

  private async runStep<T>(status: ActiveStatus, fn: () => Promise<T>): Promise<T> {
    this.state = { status };
    return fn();
  }
}
