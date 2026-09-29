import { z } from 'zod';

export const revisionEntrySchema = z.object({
  revision: z.number(),
  activity: z.number(),
  unit: z.string(),
  reason: z.string(),
  actor: z.string(),
  recordedAt: z.string(),
  impactsCalculation: z.boolean(),
  previousActivity: z.number().nullable(),
  previousUnit: z.string().nullable()
});

export const recordSchema = z.object({
  id: z.string(),
  source: z.string(),
  activity: z.number(),
  unit: z.string(),
  factor: z.number(),
  factorUnit: z.string(),
  timeRange: z.string(),
  evidenceCount: z.number(),
  anomaly: z.number(),
  owner: z.string(),
  status: z.enum(['待核验', '复核中', '已核验', '需补证']),
  revision: z.number(),
  revisions: z.array(revisionEntrySchema),
  pendingRevision: z.number().nullable()
});

export const findingSchema = z.object({
  id: z.string(),
  recordId: z.string(),
  kind: z.enum(['缺失证据', '单位不一致', '时间范围', '异常波动', '数据修订']),
  title: z.string(),
  detail: z.string(),
  assignee: z.string(),
  due: z.string(),
  status: z.enum(['开放', '补证中', '已关闭']),
  fromRevision: z.number().optional(),
  closedAt: z.string().optional(),
  closedBy: z.string().optional()
});

export const evidenceResponseSchema = z.object({
  project: z.object({
    id: z.string(),
    name: z.string(),
    methodology: z.string(),
    vintage: z.string(),
    verifier: z.string()
  }),
  summary: z.object({
    period: z.string(),
    reduction: z.number(),
    evidenceRate: z.number(),
    openFindings: z.number(),
    sampled: z.number()
  }),
  records: z.array(recordSchema),
  findings: z.array(findingSchema)
});

export const revisionRequestSchema = z.object({
  recordId: z.string().min(1),
  value: z.number({ invalid_type_error: '修订值必须为数字' }).nonnegative('修订值不能为负'),
  unit: z.string().trim().min(1, '单位不能为空'),
  reason: z.string().trim().min(1, '修订原因不能为空'),
  actor: z.string().trim().min(1, '提交人不能为空')
});

export type EvidenceResponse = z.infer<typeof evidenceResponseSchema>;
export type RevisionRequest = z.infer<typeof revisionRequestSchema>;
