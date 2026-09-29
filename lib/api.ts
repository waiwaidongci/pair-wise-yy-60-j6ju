import ky, { HTTPError } from 'ky';
import type { CorrectionRequest, EvidenceFinding, EvidenceResponse, EvidenceRevision, IssuanceChecks } from './schema';

const client = ky.create({ timeout: 10_000, retry: { limit: 0 } });

export async function fetchEvidence() {
  return client.get('/api/evidence').json<EvidenceResponse>();
}

export async function submitEvidenceCorrection(payload: CorrectionRequest) {
  return client.post('/api/evidence', { json: payload }).json<{
    accepted: boolean;
    revision: EvidenceRevision;
    finding: EvidenceFinding | null;
    evidence: EvidenceResponse;
  }>();
}

export async function verifyEvidenceRecord(recordId: string, actor = '沈楠') {
  return client.post(`/api/evidence/records/${recordId}/verify`, { json: { actor } }).json<{ accepted: boolean; evidence: EvidenceResponse }>();
}

export async function updateFinding(findingId: string, status: '开放' | '补证中' | '已关闭', actor = '沈楠') {
  return client.patch(`/api/evidence/findings/${findingId}`, { json: { status, actor } }).json<{ accepted: boolean; evidence: EvidenceResponse }>();
}

export async function submitIssuance(checks: IssuanceChecks) {
  return client.post('/api/evidence/issuance', { json: { checks } }).json<{ accepted: boolean; evidence: EvidenceResponse; submittedAt?: string }>();
}

export async function getApiError(error: unknown) {
  if (error instanceof HTTPError) {
    const body = await error.response.json().catch(() => null) as { error?: string } | null;
    if (body?.error) return body.error;
  }
  return error instanceof Error ? error.message : '接口请求失败，请稍后重试。';
}
