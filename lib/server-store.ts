import type { CarbonRecord, Finding } from '@/lib/types';
import { emissionsFor } from './calc';

export type EvidenceStore = {
  records: CarbonRecord[];
  findings: Finding[];
  findingSeq: number;
};

function revision(
  record: CarbonRecord,
  entry: Omit<CarbonRecord['revisions'][number], 'previousActivity' | 'previousUnit'>
): CarbonRecord['revisions'][number] {
  const previous = record.revisions.find((item) => item.revision === entry.revision - 1) ?? null;
  return {
    ...entry,
    previousActivity: previous ? previous.activity : null,
    previousUnit: previous ? previous.unit : null
  };
}

const seedRecords: CarbonRecord[] = [
  (() => {
    const base = {
      id: 'ACT-0318', source: '电表 E-17 / 四号压缩机组', activity: 428650, unit: 'kWh',
      factor: 0.5568, factorUnit: 'tCO2/MWh', timeRange: '2026-07-01 至 07-31',
      evidenceCount: 4, anomaly: 2.3, owner: '项目现场 O2', status: '复核中' as const
    };
    const record: CarbonRecord = { ...base, revision: 3, pendingRevision: null, revisions: [] };
    record.revisions = [
      revision(record, { revision: 1, activity: 429180, unit: 'kWh', reason: '原始电表读数录入', actor: '项目现场 · 徐璐', recordedAt: '2026-08-02T02:15:00+08:00', impactsCalculation: false }),
      revision(record, { revision: 2, activity: 425300, unit: 'kWh', reason: '按校验证书修正倍率后重录', actor: '项目现场 · 徐璐', recordedAt: '2026-08-04T03:40:00+08:00', impactsCalculation: true }),
      revision(record, { revision: 3, activity: 428650, unit: 'kWh', reason: '补充月末抄表数据，覆盖整监测期', actor: '核验员 · 沈楠', recordedAt: '2026-08-09T02:05:00+08:00', impactsCalculation: true })
    ];
    return record;
  })(),
  (() => {
    const base = {
      id: 'ACT-0321', source: '蒸汽流量计 ST-04', activity: 2038.4, unit: 'GJ',
      factor: 0.11, factorUnit: 'tCO2/GJ', timeRange: '2026-07-01 至 07-31',
      evidenceCount: 3, anomaly: 0, owner: '能源中心', status: '已核验' as const
    };
    const record: CarbonRecord = { ...base, revision: 2, pendingRevision: null, revisions: [] };
    record.revisions = [
      revision(record, { revision: 1, activity: 2041.0, unit: 'GJ', reason: '蒸汽流量月报录入', actor: '能源中心 · 周磊', recordedAt: '2026-08-02T03:30:00+08:00', impactsCalculation: false }),
      revision(record, { revision: 2, activity: 2038.4, unit: 'GJ', reason: '修正冷凝回收扣减口径', actor: '核验员 · 沈楠', recordedAt: '2026-08-06T06:20:00+08:00', impactsCalculation: true })
    ];
    return record;
  })(),
  (() => {
    const base = {
      id: 'ACT-0325', source: '柴油消耗台账 / 应急泵', activity: 1846, unit: 'L',
      factor: 2.68, factorUnit: 'kgCO2/L', timeRange: '2026-07-01 至 07-31',
      evidenceCount: 2, anomaly: 8.6, owner: '设备保障部', status: '需补证' as const
    };
    const record: CarbonRecord = { ...base, revision: 4, pendingRevision: null, revisions: [] };
    record.revisions = [
      revision(record, { revision: 1, activity: 1760, unit: 'L', reason: '应急泵柴油台账录入', actor: '设备保障部 · 姜婷', recordedAt: '2026-08-02T03:05:00+08:00', impactsCalculation: false }),
      revision(record, { revision: 2, activity: 1812, unit: 'L', reason: '补录 7 月 18 日测试运行用油', actor: '设备保障部 · 姜婷', recordedAt: '2026-08-05T05:50:00+08:00', impactsCalculation: true }),
      revision(record, { revision: 3, activity: 1868, unit: 'L', reason: '按加油小票重新汇总', actor: '核验员 · 沈楠', recordedAt: '2026-08-08T02:45:00+08:00', impactsCalculation: true }),
      revision(record, { revision: 4, activity: 1846, unit: 'L', reason: '扣除非项目用途油 22L 并附说明', actor: '核验员 · 沈楠', recordedAt: '2026-08-10T01:30:00+08:00', impactsCalculation: true })
    ];
    return record;
  })(),
  (() => {
    const base = {
      id: 'ACT-0331', source: '光伏逆变器阵列 PV-2', activity: 182460, unit: 'kWh',
      factor: 0.5568, factorUnit: 'tCO2/MWh', timeRange: '2026-07-01 至 07-31',
      evidenceCount: 5, anomaly: -1.2, owner: '新能源运维', status: '已核验' as const
    };
    const record: CarbonRecord = { ...base, revision: 1, pendingRevision: null, revisions: [] };
    record.revisions = [
      revision(record, { revision: 1, activity: 182460, unit: 'kWh', reason: '逆变器发电量月报录入', actor: '新能源运维 · 高远', recordedAt: '2026-08-02T02:40:00+08:00', impactsCalculation: false })
    ];
    return record;
  })(),
  (() => {
    const base = {
      id: 'ACT-0337', source: '天然气流量计 NG-02', activity: 62.8, unit: 'kNm3',
      factor: 2.1622, factorUnit: 'tCO2/kNm3', timeRange: '2026-07-01 至 07-31',
      evidenceCount: 1, anomaly: 12.4, owner: '热力站', status: '待核验' as const
    };
    const record: CarbonRecord = { ...base, revision: 1, pendingRevision: null, revisions: [] };
    record.revisions = [
      revision(record, { revision: 1, activity: 62.8, unit: 'kNm3', reason: '天然气流量计月报录入', actor: '热力站 · 韩跃', recordedAt: '2026-08-02T03:10:00+08:00', impactsCalculation: false })
    ];
    return record;
  })()
];

const seedFindings: Finding[] = [
  { id: 'F-104', recordId: 'ACT-0337', kind: '缺失证据', title: '缺少天然气流量计校验证书', detail: '计量记录已提交，但校准有效期证明不足。', assignee: '热力站 · 韩跃', due: '09-30', status: '开放' },
  { id: 'F-105', recordId: 'ACT-0325', kind: '异常波动', title: '柴油消耗较上期上升 18.6%', detail: '项目方尚未说明测试运行时长变化。', assignee: '设备保障部 · 姜婷', due: '10-02', status: '补证中' },
  { id: 'F-106', recordId: 'ACT-0318', kind: '单位不一致', title: '原始表单位为 MWh，台账记录为 kWh', detail: '需补充单位换算链并保留原始记录。', assignee: '项目现场 · 徐璐', due: '09-30', status: '开放' }
];

const globalForStore = globalThis as unknown as { __yy60EvidenceStore?: EvidenceStore };

// 开发模式下 Next 会热替换模块，挂在 globalThis 上保证修订数据在进程内只初始化一次。
export function getEvidenceStore(): EvidenceStore {
  if (!globalForStore.__yy60EvidenceStore) {
    globalForStore.__yy60EvidenceStore = {
      records: seedRecords,
      findings: seedFindings,
      findingSeq: 106
    };
  }
  return globalForStore.__yy60EvidenceStore;
}

export function nextFindingId(store: EvidenceStore): string {
  store.findingSeq += 1;
  return `F-${store.findingSeq}`;
}
