import { NextResponse } from 'next/server';
import { z } from 'zod';
import { evidenceResponseSchema, findingStatusSchema } from '@/lib/schema';
import { getEvidenceResponse, loadEvidenceState, saveEvidenceState } from '@/lib/evidence-server';

export const dynamic = 'force-dynamic';

const findingRequestSchema = z.object({
  status: findingStatusSchema,
  actor: z.string().trim().min(1).default('沈楠')
});

export async function PATCH(request: Request, context: { params: Promise<{ findingId: string }> }) {
  const { findingId } = await context.params;
  const parsed = findingRequestSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: '发现项状态不合法。' }, { status: 400 });
  }

  const state = loadEvidenceState();
  const finding = state.findings.find((item) => item.id === findingId);

  if (!finding) {
    return NextResponse.json({ error: `未找到发现项 ${findingId}。` }, { status: 404 });
  }

  finding.status = parsed.data.status;
  saveEvidenceState(state);

  return NextResponse.json({ accepted: true, evidence: evidenceResponseSchema.parse(getEvidenceResponse(state)) });
}
