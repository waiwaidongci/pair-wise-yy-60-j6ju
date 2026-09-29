import { NextResponse } from 'next/server';
import { evidenceResponseSchema, issuanceRequestSchema } from '@/lib/schema';
import { getEvidenceResponse, loadEvidenceState } from '@/lib/evidence-server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const parsed = issuanceRequestSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: '签发检查结果不合法。' }, { status: 400 });
  }

  const response = evidenceResponseSchema.parse(getEvidenceResponse(loadEvidenceState(), parsed.data.checks));
  if (!response.readiness.ready) {
    return NextResponse.json({ accepted: false, evidence: response, blockers: response.readiness.blockers }, { status: 409 });
  }

  return NextResponse.json({ accepted: true, evidence: response, submittedAt: new Date().toISOString() });
}
