import type { EvidenceState } from './schema';

export const initialEvidenceState: EvidenceState = {
  records: [
    { id: 'ACT-0318', source: '电表 E-17 / 四号压缩机组', activity: 428650, unit: 'kWh', factor: 0.5568, factorUnit: 'tCO2/MWh', timeRange: '2026-07-01 至 07-31', evidenceCount: 4, anomaly: 2.3, owner: '项目现场 O2', status: '复核中', revision: 3, requiresReverification: true, verifiedAt: null, verifiedBy: null },
    { id: 'ACT-0321', source: '蒸汽流量计 ST-04', activity: 2038.4, unit: 'GJ', factor: 0.1100, factorUnit: 'tCO2/GJ', timeRange: '2026-07-01 至 07-31', evidenceCount: 3, anomaly: 0, owner: '能源中心', status: '已核验', revision: 2, requiresReverification: false, verifiedAt: '2026-09-18T03:20:00.000Z', verifiedBy: '沈楠' },
    { id: 'ACT-0325', source: '柴油消耗台账 / 应急泵', activity: 1846, unit: 'L', factor: 2.6800, factorUnit: 'kgCO2/L', timeRange: '2026-07-01 至 07-31', evidenceCount: 2, anomaly: 8.6, owner: '设备保障部', status: '需补证', revision: 4, requiresReverification: true, verifiedAt: null, verifiedBy: null },
    { id: 'ACT-0331', source: '光伏逆变器阵列 PV-2', activity: 182460, unit: 'kWh', factor: 0.5568, factorUnit: 'tCO2/MWh', timeRange: '2026-07-01 至 07-31', evidenceCount: 5, anomaly: -1.2, owner: '新能源运维', status: '已核验', revision: 1, requiresReverification: false, verifiedAt: '2026-09-16T07:40:00.000Z', verifiedBy: '沈楠' },
    { id: 'ACT-0337', source: '天然气流量计 NG-02', activity: 62.8, unit: 'kNm3', factor: 2.1622, factorUnit: 'tCO2/kNm3', timeRange: '2026-07-01 至 07-31', evidenceCount: 1, anomaly: 12.4, owner: '热力站', status: '待核验', revision: 1, requiresReverification: false, verifiedAt: null, verifiedBy: null }
  ],
  findings: [
    { id: 'F-104', recordId: 'ACT-0337', type: '缺失证据', title: '缺少天然气流量计校验证书', detail: '计量记录已提交，但校准有效期证明不足。', assignee: '热力站 · 韩跃', due: '09-30', status: '开放', revisionId: null },
    { id: 'F-105', recordId: 'ACT-0325', type: '异常波动', title: '柴油消耗较上期上升 18.6%', detail: '项目方尚未说明测试运行时长变化。', assignee: '设备保障部 · 姜婷', due: '10-02', status: '补证中', revisionId: null },
    { id: 'F-106', recordId: 'ACT-0318', type: '单位不一致', title: '原始表单位为 MWh，台账记录为 kWh', detail: '需补充单位换算链并保留原始记录。', assignee: '项目现场 · 徐璐', due: '09-30', status: '开放', revisionId: null }
  ],
  revisions: [
    { id: 'R-0001', recordId: 'ACT-0318', version: 1, activity: 435200, unit: 'kWh', previousActivity: null, previousUnit: null, reason: '初始导入电表 E-17 七月计量数据。', actor: '徐璐', createdAt: '2026-08-02T01:10:00.000Z', affectsCalculation: true },
    { id: 'R-0002', recordId: 'ACT-0318', version: 2, activity: 431800, unit: 'kWh', previousActivity: 435200, previousUnit: 'kWh', reason: '扣除停机维护时段重复计量。', actor: '徐璐', createdAt: '2026-08-12T06:35:00.000Z', affectsCalculation: true },
    { id: 'R-0003', recordId: 'ACT-0318', version: 3, activity: 428650, unit: 'kWh', previousActivity: 431800, previousUnit: 'kWh', reason: '按校准后的电表倍率修正台账汇总值。', actor: '沈楠', createdAt: '2026-09-03T08:15:00.000Z', affectsCalculation: true },
    { id: 'R-0004', recordId: 'ACT-0321', version: 1, activity: 2062.8, unit: 'GJ', previousActivity: null, previousUnit: null, reason: '初始导入蒸汽流量计月度读数。', actor: '韩跃', createdAt: '2026-08-03T02:20:00.000Z', affectsCalculation: true },
    { id: 'R-0005', recordId: 'ACT-0321', version: 2, activity: 2038.4, unit: 'GJ', previousActivity: 2062.8, previousUnit: 'GJ', reason: '按温度压力补偿后的结算口径修订。', actor: '韩跃', createdAt: '2026-08-20T05:55:00.000Z', affectsCalculation: true },
    { id: 'R-0006', recordId: 'ACT-0325', version: 1, activity: 1788, unit: 'L', previousActivity: null, previousUnit: null, reason: '初始导入应急泵柴油台账。', actor: '姜婷', createdAt: '2026-08-04T09:05:00.000Z', affectsCalculation: true },
    { id: 'R-0007', recordId: 'ACT-0325', version: 2, activity: 1812, unit: 'L', previousActivity: 1788, previousUnit: 'L', reason: '补充 7 月 18 日加油票据。', actor: '姜婷', createdAt: '2026-08-22T08:30:00.000Z', affectsCalculation: true },
    { id: 'R-0008', recordId: 'ACT-0325', version: 3, activity: 1835, unit: 'L', previousActivity: 1812, previousUnit: 'L', reason: '并入应急试运行加油记录。', actor: '姜婷', createdAt: '2026-09-05T10:10:00.000Z', affectsCalculation: true },
    { id: 'R-0009', recordId: 'ACT-0325', version: 4, activity: 1846, unit: 'L', previousActivity: 1835, previousUnit: 'L', reason: '修正月末盘点差异并保留原始票据。', actor: '沈楠', createdAt: '2026-09-11T07:25:00.000Z', affectsCalculation: true },
    { id: 'R-0010', recordId: 'ACT-0331', version: 1, activity: 182460, unit: 'kWh', previousActivity: null, previousUnit: null, reason: '初始导入光伏逆变器阵列发电量。', actor: '何青', createdAt: '2026-08-03T03:00:00.000Z', affectsCalculation: true },
    { id: 'R-0011', recordId: 'ACT-0337', version: 1, activity: 62.8, unit: 'kNm3', previousActivity: null, previousUnit: null, reason: '初始导入天然气流量计月度读数。', actor: '韩跃', createdAt: '2026-08-04T01:45:00.000Z', affectsCalculation: true }
  ]
};

export const project = {
  id: 'CN-ER-2026-041',
  name: '临港工业园区能效提升项目',
  methodology: 'CMS-052-V01',
  vintage: '2026 监测年度',
  verifier: '华碳认证 · 核验组 B'
};
