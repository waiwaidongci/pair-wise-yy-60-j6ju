import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { initialEvidenceState, project } from './default-evidence';
import type { EvidenceResponse, EvidenceState, IssuanceChecks } from './schema';

const dataDirectory = join(process.cwd(), '.data');
const dataFile = join(dataDirectory, 'evidence-state.json');

function cloneInitialState(): EvidenceState {
  return JSON.parse(JSON.stringify(initialEvidenceState)) as EvidenceState;
}

function normalizeState(value: Partial<EvidenceState> | null | undefined): EvidenceState {
  if (!value || !Array.isArray(value.records) || !Array.isArray(value.findings) || !Array.isArray(value.revisions)) {
    return cloneInitialState();
  }
  return {
    records: value.records,
    findings: value.findings,
    revisions: value.revisions
  } as EvidenceState;
}

export function loadEvidenceState(): EvidenceState {
  if (!existsSync(dataFile)) {
    const initial = cloneInitialState();
    saveEvidenceState(initial);
    return initial;
  }

  try {
    return normalizeState(JSON.parse(readFileSync(dataFile, 'utf8')) as Partial<EvidenceState>);
  } catch {
    return cloneInitialState();
  }
}

export function saveEvidenceState(state: EvidenceState) {
  mkdirSync(dataDirectory, { recursive: true });
  const temporaryFile = `${dataFile}.tmp`;
  writeFileSync(temporaryFile, JSON.stringify(state, null, 2), 'utf8');
  renameSync(temporaryFile, dataFile);
}

export function resetEvidenceState() {
  const initial = cloneInitialState();
  saveEvidenceState(initial);
  return initial;
}

export function getEvidenceResponse(state = loadEvidenceState(), checks: IssuanceChecks = { evidence: true, calculation: true, revisions: true, methodology: true }): EvidenceResponse {
  const openFindings = state.findings.filter((finding) => finding.status !== '已关闭');
  const reduction = state.records.reduce((total, record) => total + record.activity * record.factor / getUnitDivisor(record.unit, record.factorUnit), 0);
  const blockers: string[] = [];

  for (const record of state.records) {
    if (record.status !== '已核验' || record.requiresReverification) {
      blockers.push(`${record.id} 尚未完成重新核验`);
    }
  }

  for (const finding of openFindings) {
    blockers.push(`发现项 ${finding.id}（${finding.title}）尚未关闭`);
  }

  if (!checks.evidence) blockers.push('证据与计算链完整检查未确认');
  if (!checks.calculation) blockers.push('计算过程复核检查未确认');
  if (!checks.revisions) blockers.push('历史修订检查未确认');
  if (!checks.methodology) blockers.push('方法学匹配检查未确认');

  return {
    project,
    summary: {
      period: '2026 年第三监测期',
      reduction: Math.round(reduction * 100) / 100,
      evidenceRate: 92,
      openFindings: openFindings.length,
      sampled: 18
    },
    records: state.records,
    findings: state.findings,
    revisions: state.revisions,
    readiness: { ready: blockers.length === 0, blockers }
  };
}

export function getUnitDivisor(unit: string, factorUnit: string) {
  return unit === 'kWh' && factorUnit.includes('MWh') || factorUnit.startsWith('kg') ? 1000 : 1;
}

export function nextId(items: Array<{ id: string }>, prefix: string) {
  const maxId = items.reduce((max, item) => {
    const numeric = Number(item.id.replace(prefix, ''));
    return Number.isFinite(numeric) ? Math.max(max, numeric) : max;
  }, 0);
  return `${prefix}-${String(maxId + 1).padStart(4, '0')}`;
}

export function dueWithin(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${month}-${day}`;
}
