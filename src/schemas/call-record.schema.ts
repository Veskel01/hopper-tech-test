import { z } from 'zod';

const E164_PATTERN = /^\+[1-9]\d{1,14}$/;

export const callRecordBaseSchema = z.object({
  id: z.string().min(1, 'id must not be empty'),
  callStartTime: z.iso.datetime(),
  callEndTime: z.iso.datetime(),
  fromNumber: z.string().regex(E164_PATTERN, 'Must be E.164 format'),
  toNumber: z.string().regex(E164_PATTERN, 'Must be E.164 format'),
  callType: z.enum(['voice', 'video']),
  region: z.string().min(1, 'region must not be empty')
});

export const callRecordSchema = callRecordBaseSchema.refine(
  (data) => new Date(data.callEndTime).getTime() > new Date(data.callStartTime).getTime(),
  { message: 'callEndTime must be after callStartTime' }
);

export type CallRecord = z.infer<typeof callRecordBaseSchema>;

export const enrichedCallRecordSchema = callRecordBaseSchema.extend({
  duration: z.number(),
  fromOperator: z.string().optional(),
  toOperator: z.string().optional(),
  fromCountry: z.string().optional(),
  toCountry: z.string().optional(),
  estimatedCost: z.number().optional()
});

export type EnrichedCallRecord = z.infer<typeof enrichedCallRecordSchema>;
