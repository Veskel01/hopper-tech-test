import { type CallRecord, callRecordBaseSchema } from '../schemas/call-record.schema';
import { Result } from '../shared/result';

export type RawCallRow = Record<keyof CallRecord, string>;

const EXPECTED_HEADERS = Object.keys(callRecordBaseSchema.shape) as (keyof CallRecord)[];

export function parseCallBatchCsv(csv: string): Result<RawCallRow[], string> {
  const trimmed = csv.trim();
  if (!trimmed) {
    return Result.fail('Empty payload');
  }

  const lines = trimmed.split('\n');
  if (lines.length < 2) {
    return Result.fail('CSV must contain a header row and at least one data row');
  }

  const headers = lines[0].split(',').map((h) => h.trim());
  if (
    headers.length !== EXPECTED_HEADERS.length ||
    !EXPECTED_HEADERS.every((h, i) => headers[i] === h)
  ) {
    return Result.fail(`Invalid CSV headers. Expected: ${EXPECTED_HEADERS.join(',')}`);
  }

  const rows: RawCallRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      continue;
    }

    const fields = line.split(',');
    if (fields.length !== EXPECTED_HEADERS.length) {
      return Result.fail(
        `Row ${i} has ${fields.length} fields, expected ${EXPECTED_HEADERS.length}`
      );
    }

    const row = {} as RawCallRow;
    for (let j = 0; j < EXPECTED_HEADERS.length; j++) {
      row[EXPECTED_HEADERS[j]] = fields[j].trim();
    }
    rows.push(row);
  }

  if (rows.length === 0) {
    return Result.fail('CSV contains no data rows');
  }

  return Result.ok(rows);
}
