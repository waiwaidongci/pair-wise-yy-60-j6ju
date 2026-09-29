import { NextResponse } from 'next/server';
import { getEvidenceStore } from '@/lib/server-store';

export const dynamic = 'force-dynamic';

type Action = 'verify' | 'review';

// 记录状态流转：verify 重新核验通过，review 退回复核。
// 已退回复核的记录只有在该修订对应发现项关闭后才允许重新核验通过（与签发门禁一致）。
export async function POST(request: Request) {
  let body: { recordId?: unknown; action?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: '请求体不是合法 JSON' }, { status: 400 });
  }

  const recordId = typeof body.recordId === 'string' ? body.recordId : '';
  const action: Action = body.action === 'review' ? 'review' : 'verify';

  const store = getEvidenceStore();
  const record = store.records.find((item) => item.id === recordId);
  if (!record) {
    return NextResponse.json({ ok: false, error: `未找到记录 ${recordId}` }, { status: 404 });
  }

  if (action === 'verify') {
    if (record.pendingRevision !== null) {
      const blocking = store.findings.find(
        (item) => item.recordId === record.id && item.fromRevision === record.pendingRevision && item.status !== '已关闭'
      );
      if (blocking) {
        return NextResponse.json(
          { ok: false, error: `V${record.pendingRevision} 修订生成的发现项 ${blocking.id} 尚未关闭，无法通过核验` },
          { status: 409 }
        );
      }
      record.pendingRevision = null;
    }
    record.status = '已核验';
  } else {
    record.status = '复核中';
  }

  return NextResponse.json({ ok: true, recordId: record.id, status: record.status });
}
