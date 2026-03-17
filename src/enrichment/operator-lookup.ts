import { lookupOperator, type OperatorInfo } from '../operator-lookup';

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 100;

export class OperatorLookup {
  public async lookup(phoneNumber: string, callDate: string): Promise<OperatorInfo> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await lookupOperator(phoneNumber, callDate);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        }
      }
    }

    throw lastError;
  }
}
