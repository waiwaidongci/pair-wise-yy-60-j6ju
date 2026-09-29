import { NextResponse } from 'next/server';
import { correctionRequestSchema, evidenceResponseSchema, type EvidenceResponse } from '@/lib/schema';
import { dueWithin, getEvidenceResponse, loadEvidenceState, nextId, saveEvidenceState } from '@/lib/evidence-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(evidenceResponseSchema.parse(getEvidenceResponse()));
}

export async function POST(request: Request) {
  let parsedBody: unknown;

  try {
    parsedBody = await request.json();
  } catch {
    return NextResponse.json({ error: '请求内容必须为 JSON。' }, { status: 400 });
  }

  const parsed = correctionRequestSchema.safeParse(parsedBody);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? '修订请求不合法。' }, { status: 400 });
  }

  const correction = parsed.data;
  const state = loadEvidenceState();
  const record = state.records.find((item) => item.id === correction.recordId);

  if (!record) {
    return NextResponse.json({ error: `未找到记录 ${correction.recordId}。` }, { status: 404 });
  }

  const normalizedValue = Number(correction.value);
  const normalizedUnit = correction.unit.trim();
  if (normalizedValue === record.activity && normalizedUnit === record.unit) {
    return NextResponse.json({ error: '偏差值或单位至少修改一项，才能保存新版本。' }, { status: 400 });
  }

  const affectsCalculation = true;
  const version = state.revisions.filter((item) => item.recordId === record.id).length + 1;
  const revisionId = nextId(state.revisions, 'R');
  const createdAt = new Date().toISOString();

  const revision = {
    id: revisionId,
    recordId: record.id,
    version,
    activity: normalizedValue,
    unit: normalizedUnit,
    previousActivity: record.activity,
    previousUnit: record.unit,
    reason: correction.reason.trim(),
    actor: correction.actor.trim(),
    createdAt,
    affectsCalculation
  };

  state.revisions.push(revision);
  record.activity = normalizedValue;
  record.unit = normalizedUnit;
  record.revision = version;

  let finding: EvidenceResponse['findings'][number] | null = null;
  if (affectsCalculation) {
    finding = {
      id: nextId(state.findings, 'F'),
      recordId: record.id,
      type: '数据修订',
      title: `修订影响计算结果，需复核 ${record.id}`,
      detail: `${revision.actor} 将活动数据由 ${revision.previousActivity?.toLocaleString()} ${revision.previousUnit} 修订为 ${normalizedValue.toLocaleString()} ${normalizedUnit}；需关闭本项并重新核验后方可进入签发准备。原因：${revision.reason}`,
      assignee: `${record.owner} · 复核组`,
      due: dueWithin(7),
      status: '开放',
      revisionId
    };
    state.findings.push(finding);
    record.status = '复核中';
    record.requiresReverification = true;
    record.verifiedAt = null;
    record.verifiedBy = null;
  }

  saveEvidenceState(state);

  return NextResponse.json({
    accepted: true,
    revision,
    finding,
    evidence: evidenceResponseSchema.parse(getEvidenceResponse(state))
  }, { status: 201 });
}
