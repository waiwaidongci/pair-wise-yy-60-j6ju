import { z } from 'zod';

export const recordStatusSchema = z.enum(['待核验', '复核中', '已核验', '需补证']);
export const findingStatusSchema = z.enum(['开放', '补证中', '已关闭']);
export const findingTypeSchema = z.enum(['缺失证据', '单位不一致', '时间范围', '异常波动', '数据修订']);

export const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  methodology: z.string(),
  vintage: z.string(),
  verifier: z.string()
});

export const summarySchema = z.object({
  period: z.string(),
  reduction: z.number(),
  evidenceRate: z.number(),
  openFindings: z.number(),
  sampled: z.number()
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
  status: recordStatusSchema,
  revision: z.number(),
  requiresReverification: z.boolean(),
  verifiedAt: z.string().nullable(),
  verifiedBy: z.string().nullable()
});

export const revisionSchema = z.object({
  id: z.string(),
  recordId: z.string(),
  version: z.number(),
  activity: z.number(),
  unit: z.string(),
  previousActivity: z.number().nullable(),
  previousUnit: z.string().nullable(),
  reason: z.string(),
  actor: z.string(),
  createdAt: z.string(),
  affectsCalculation: z.boolean()
});

export const findingSchema = z.object({
  id: z.string(),
  recordId: z.string(),
  type: findingTypeSchema,
  title: z.string(),
  detail: z.string(),
  assignee: z.string(),
  due: z.string(),
  status: findingStatusSchema,
  revisionId: z.string().nullable()
});

export const readinessSchema = z.object({
  ready: z.boolean(),
  blockers: z.array(z.string())
});

export const evidenceResponseSchema = z.object({
  project: projectSchema,
  summary: summarySchema,
  records: z.array(recordSchema),
  findings: z.array(findingSchema),
  revisions: z.array(revisionSchema),
  readiness: readinessSchema
});

export const correctionRequestSchema = z.object({
  recordId: z.string().min(1),
  value: z.number().finite().positive(),
  unit: z.string().trim().min(1),
  reason: z.string().trim().min(2, '请填写修订原因'),
  actor: z.string().trim().min(1).default('沈楠')
});

export const issuanceRequestSchema = z.object({
  checks: z.object({
    evidence: z.boolean(),
    calculation: z.boolean(),
    revisions: z.boolean(),
    methodology: z.boolean()
  })
});

export type EvidenceResponse = z.infer<typeof evidenceResponseSchema>;
export type EvidenceRecord = z.infer<typeof recordSchema>;
export type EvidenceRevision = z.infer<typeof revisionSchema>;
export type EvidenceFinding = z.infer<typeof findingSchema>;
export type EvidenceState = Pick<EvidenceResponse, 'records' | 'findings' | 'revisions'>;
export type CorrectionRequest = z.infer<typeof correctionRequestSchema>;
export type IssuanceChecks = z.infer<typeof issuanceRequestSchema>['checks'];
