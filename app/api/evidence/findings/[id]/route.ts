import { NextResponse } from 'next/server';
import { getEvidenceStore } from '@/lib/server-store';

export const dynamic = 'force-dynamic';

type FindingAction = 'request' | 'close';

// 发现项状态流转：request 发起补证（开放 -> 补证中），close 关闭并记录关闭人与时间。
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  let body: { action?: unknown; actor?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: '请求体不是合法 JSON' }, { status: 400 });
  }

  const action: FindingAction = body.action === 'request' ? 'request' : 'close';
  const actor = typeof body.actor === 'string' && body.actor.trim() ? body.actor.trim() : '核验员';

  const store = getEvidenceStore();
  const finding = store.findings.slice().reverse().find((item) => item.id === id);
  if (!finding) {
    return NextResponse.json({ ok: false, error: `未找到发现项 ${id}` }, { status: 404 });
  }

  if (action === 'request') {
    if (finding.status === '已关闭') {
      return NextResponse.json({ ok: false, error: '发现项已关闭' }, { status: 409 });
    }
    finding.status = '补证中';
  } else {
    finding.status = '已关闭';
    finding.closedAt = new Date().toISOString();
    finding.closedBy = actor;
  }

  return NextResponse.json({ ok: true, id: finding.id, status: finding.status });
}
