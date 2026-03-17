import { parseCallBatchCsv } from '../parsing/parse-call-batch';
import { type CallRecord, callRecordSchema } from '../schemas/call-record.schema';
import { Result } from '../shared/result';

export function parseAndValidateBatch(payload: string): Result<CallRecord[], string> {
  const parseResult = parseCallBatchCsv(payload);
  if (!parseResult.ok) {
    return parseResult;
  }

  const records: CallRecord[] = [];
  const errors: string[] = [];

  for (const row of parseResult.value) {
    const validation = callRecordSchema.safeParse(row);
    if (validation.success) {
      records.push(validation.data);
    } else {
      const issues = validation.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
      errors.push(`Record '${row.id}': ${issues.join('; ')}`);
    }
  }

  if (errors.length > 0) {
    return Result.fail(`Validation failed:\n${errors.join('\n')}`);
  }

  return Result.ok(records);
}
