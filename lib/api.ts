import ky from 'ky';
import { evidenceResponseSchema } from './schema';

const client = ky.create({ timeout: 10_000, retry: { limit: 1 } });

async function readError(error: unknown): Promise<string> {
  if (error && typeof error === 'object' && 'response' in error) {
    const response = (error as { response?: Response }).response;
    if (response) {
      try {
        const payload = await response.json() as { error?: string };
        if (payload.error) return payload.error;
      } catch {
        // 非 JSON 错误体，回退到状态文本
      }
      return `请求失败（${response.status}）`;
    }
  }
  return '网络异常，请稍后重试';
}

export async function fetchEvidence() {
  const payload = await client.get('/api/evidence').json<unknown>();
  return evidenceResponseSchema.parse(payload);
}

export type RevisionPayload = {
  recordId: string;
  value: number;
  unit: string;
  reason: string;
  actor: string;
};

export type RevisionResult = {
  ok: boolean;
  recordId: string;
  revision: number;
  impactsCalculation: boolean;
  findingId: string | null;
  recordedAt: string;
};

// 提交偏差值、单位和原因，服务端保存为新版本；返回新版本号、是否影响计算结果及待关闭发现项。
export async function submitEvidenceCorrection(payload: RevisionPayload): Promise<RevisionResult> {
  try {
    return await client.post('/api/evidence', { json: payload }).json<RevisionResult>();
  } catch (error) {
    throw new Error(await readError(error));
  }
}

export async function verifyRecordRemote(recordId: string): Promise<{ ok: boolean; status: string }> {
  try {
    return await client.post('/api/evidence/verify', { json: { recordId, action: 'verify' } }).json();
  } catch (error) {
    throw new Error(await readError(error));
  }
}

export async function returnToReviewRemote(recordId: string): Promise<{ ok: boolean; status: string }> {
  try {
    return await client.post('/api/evidence/verify', { json: { recordId, action: 'review' } }).json();
  } catch (error) {
    throw new Error(await readError(error));
  }
}

export async function updateFindingRemote(
  findingId: string,
  action: 'request' | 'close',
  actor: string
): Promise<{ ok: boolean; status: string }> {
  try {
    return await client.patch(`/api/evidence/findings/${encodeURIComponent(findingId)}`, { json: { action, actor } }).json();
  } catch (error) {
    throw new Error(await readError(error));
  }
}
