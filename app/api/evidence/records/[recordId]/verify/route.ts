import { NextResponse } from 'next/server';
import { z } from 'zod';
import { evidenceResponseSchema } from '@/lib/schema';
import { getEvidenceResponse, loadEvidenceState, saveEvidenceState } from '@/lib/evidence-server';

export const dynamic = 'force-dynamic';

const verifyRequestSchema = z.object({
  actor: z.string().trim().min(1).default('沈楠')
}).default({});

export async function POST(request: Request, context: { params: Promise<{ recordId: string }> }) {
  const { recordId } = await context.params;
  const actor = await request.json().catch(() => ({}))
    .then((body) => verifyRequestSchema.parse(body).actor);

  const state = loadEvidenceState();
  const record = state.records.find((item) => item.id === recordId);

  if (!record) {
    return NextResponse.json({ error: `未找到记录 ${recordId}。` }, { status: 404 });
  }

  const openFindings = state.findings.filter((finding) => finding.recordId === recordId && finding.status !== '已关闭');
  if (openFindings.length > 0) {
    return NextResponse.json({
      error: `${recordId} 仍有 ${openFindings.length} 个发现项未关闭，不能重新核验。`,
      evidence: evidenceResponseSchema.parse(getEvidenceResponse(state))
    }, { status: 409 });
  }

  record.status = '已核验';
  record.requiresReverification = false;
  record.verifiedAt = new Date().toISOString();
  record.verifiedBy = actor;
  saveEvidenceState(state);

  return NextResponse.json({ accepted: true, verifiedAt: record.verifiedAt, verifiedBy: actor, evidence: evidenceResponseSchema.parse(getEvidenceResponse(state)) });
}
