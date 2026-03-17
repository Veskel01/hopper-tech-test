import type { BatchDispatcher } from './application/batch-dispatcher';
import { parseAndValidateBatch } from './validation/parse-and-validate-batch';

interface Response {
  ok: boolean;
  error?: string;
}

export class CallHandler {
  public constructor(private readonly dispatcher: BatchDispatcher) {}

  public async handleBatch(payload: string): Promise<Response> {
    const result = parseAndValidateBatch(payload);

    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    this.dispatcher.dispatch(result.value);

    return { ok: true };
  }
}
