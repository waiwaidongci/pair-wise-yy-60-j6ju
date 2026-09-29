import { NextResponse } from 'next/server';
import { evidenceResponseSchema, revisionRequestSchema } from '@/lib/schema';
import { emissionsFor } from '@/lib/calc';
import { getEvidenceStore, nextFindingId } from '@/lib/server-store';
import type { Finding, RevisionEntry } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  const store = getEvidenceStore();
  const payload = {
    project: {
      id: 'CN-ER-2026-041',
      name: '临港工业园区能效提升项目',
      methodology: 'CMS-052-V01',
      vintage: '2026 监测年度',
      verifier: '华碳认证 · 核验组 B'
    },
    summary: {
      period: '2026 年第三监测期',
      reduction: 18426,
      evidenceRate: 92,
      openFindings: store.findings.filter((item) => item.status !== '已关闭').length,
      sampled: 18
    },
    records: store.records,
    findings: store.findings
  };
  return NextResponse.json(evidenceResponseSchema.parse(payload));
}

// 提交活动数据修订：校验入参 -> 生成新版本与修订链 -> 影响计算结果时退回复核并生成发现项。
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: '请求体不是合法 JSON' }, { status: 400 });
  }

  const parsed = revisionRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues.map((issue) => issue.message).join('；') },
      { status: 400 }
    );
  }
  const { recordId, value, unit, reason, actor } = parsed.data;

  const store = getEvidenceStore();
  const record = store.records.find((item) => item.id === recordId);
  if (!record) {
    return NextResponse.json({ ok: false, error: `未找到记录 ${recordId}` }, { status: 404 });
  }

  const oldEmissions = emissionsFor(record.activity, record.unit, record.factor);
  const newEmissions = emissionsFor(value, unit, record.factor);
  const impactsCalculation = Math.abs(newEmissions - oldEmissions) > 1e-9;
  const newRevisionNo = record.revision + 1;
  const recordedAt = new Date().toISOString();

  const entry: RevisionEntry = {
    revision: newRevisionNo,
    activity: value,
    unit,
    reason,
    actor,
    recordedAt,
    impactsCalculation,
    previousActivity: record.activity,
    previousUnit: record.unit
  };
  record.activity = value;
  record.unit = unit;
  record.revision = newRevisionNo;
  record.revisions.push(entry);

  let finding: Finding | null = null;
  if (impactsCalculation) {
    // 影响计算结果的修订：记录退回复核，并生成待关闭的发现项。
    record.status = '复核中';
    record.pendingRevision = newRevisionNo;
    const deviation = value - (entry.previousActivity ?? value);
    finding = {
      id: nextFindingId(store),
      recordId: record.id,
      kind: '数据修订',
      title: `V${newRevisionNo} 修订影响计算结果，记录退回复核`,
      detail: `活动数据由 ${Number(entry.previousActivity).toLocaleString()} ${entry.previousUnit} 修订为 ${value.toLocaleString()} ${unit}` +
        `（偏差 ${deviation >= 0 ? '+' : ''}${deviation.toLocaleString()} ${entry.previousUnit === unit ? unit : `${entry.previousUnit} → ${unit}`}）；` +
        `对应减排量由 ${oldEmissions.toFixed(2)} 变为 ${newEmissions.toFixed(2)} tCO₂e。需重新核验并关闭本发现项后方可通过签发准备。修订原因：${reason}`,
      assignee: '核验组 · 待重新核验',
      due: new Date(Date.now() + 7 * 86_400_000).toISOString().slice(5, 10).replace('-', '-'),
      status: '开放',
      fromRevision: newRevisionNo
    };
    store.findings.push(finding);
  }

  return NextResponse.json({
    ok: true,
    recordId,
    revision: newRevisionNo,
    impactsCalculation,
    findingId: finding?.id ?? null,
    recordedAt
  });
}
