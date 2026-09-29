// 客户端与接口共用的数据类型，对应 /api/evidence 返回结构。

export type RecordStatus = '待核验' | '复核中' | '已核验' | '需补证';

export type RevisionEntry = {
  /** 版本号，从 1 开始；每次修订产生一条新版本 */
  revision: number;
  activity: number;
  unit: string;
  reason: string;
  actor: string;
  recordedAt: string;
  /** 是否影响计算结果（减排量） */
  impactsCalculation: boolean;
  /** 修订前活动数据，用于计算偏差值 */
  previousActivity: number | null;
  previousUnit: string | null;
};

export type CarbonRecord = {
  id: string;
  source: string;
  activity: number;
  unit: string;
  factor: number;
  factorUnit: string;
  timeRange: string;
  evidenceCount: number;
  anomaly: number;
  owner: string;
  status: RecordStatus;
  revision: number;
  /** 完整修订链：V1 原始录入到当前版本，旧值持续可查 */
  revisions: RevisionEntry[];
  /** 影响计算结果的修订后等待重新核验的版本；null 表示无待办 */
  pendingRevision: number | null;
};

export type FindingKind =
  | '缺失证据'
  | '单位不一致'
  | '时间范围'
  | '异常波动'
  | '数据修订';

export type Finding = {
  id: string;
  recordId: string;
  kind: FindingKind;
  title: string;
  detail: string;
  assignee: string;
  due: string;
  status: '开放' | '补证中' | '已关闭';
  /** 由影响计算结果的修订自动生成；关闭前对应记录不得重新核验通过、签发不得放行 */
  fromRevision?: number;
  closedAt?: string;
  closedBy?: string;
};
