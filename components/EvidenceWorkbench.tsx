'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  AppBar,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Drawer,
  IconButton,
  LinearProgress,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Toolbar,
  Tooltip,
  Typography
} from '@mui/material';
import {
  AccountTreeOutlined,
  AssessmentOutlined,
  CloudUploadOutlined,
  DashboardOutlined,
  FactCheckOutlined,
  FindInPageOutlined,
  MenuOutlined,
  MoreHorizOutlined,
  NotificationsNoneOutlined,
  ScienceOutlined,
  TaskAltOutlined
} from '@mui/icons-material';
import { fetchEvidence, getApiError, submitEvidenceCorrection, submitIssuance, updateFinding, verifyEvidenceRecord } from '@/lib/api';
import { project } from '@/lib/default-evidence';
import { useCarbonStore } from '@/lib/store';
import type { EvidenceFinding, EvidenceRecord, EvidenceResponse } from '@/lib/schema';

const drawerWidth = 232;
const queryKey = ['evidence'] as const;
const actor = '沈楠';

type View = 'overview' | 'verify' | 'issuance';
type ActionMessage = { severity: 'success' | 'info' | 'warning' | 'error'; text: string };

const fallbackData: EvidenceResponse = {
  project,
  summary: { period: '2026 年第三监测期', reduction: 0, evidenceRate: 0, openFindings: 0, sampled: 18 },
  records: [],
  findings: [],
  revisions: [],
  readiness: { ready: false, blockers: ['证据数据加载中'] }
};

const unitOptions = ['kWh', 'MWh', 'GJ', 'L', 'kNm3', 'Nm3', 't'];

function getUnitDivisor(record: Pick<EvidenceRecord, 'unit' | 'factorUnit'>) {
  return record.unit === 'kWh' && record.factorUnit.includes('MWh') || record.factorUnit.startsWith('kg') ? 1000 : 1;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'short', timeStyle: 'short', hour12: false }).format(new Date(value));
}

function getEmission(record: Pick<EvidenceRecord, 'activity' | 'factor' | 'unit' | 'factorUnit'>) {
  return record.activity * record.factor / getUnitDivisor(record);
}

export default function EvidenceWorkbench({ initialView }: { initialView: View }) {
  const [view] = useState<View>(initialView);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [recordFilter, setRecordFilter] = useState('全部');
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correctionValue, setCorrectionValue] = useState('');
  const [correctionUnit, setCorrectionUnit] = useState('kWh');
  const [correctionReason, setCorrectionReason] = useState('');
  const [message, setMessage] = useState<ActionMessage | null>(null);

  const queryClient = useQueryClient();
  const { data: serverData, isLoading } = useQuery({ queryKey, queryFn: fetchEvidence });
  const data = serverData ?? fallbackData;
  const store = useCarbonStore();
  const selected = data.records.find((record) => record.id === store.selectedRecordId) ?? data.records[0];

  const selectedRevisions = useMemo(
    () => selected ? data.revisions.filter((revision) => revision.recordId === selected.id).sort((a, b) => b.version - a.version) : [],
    [data.revisions, selected]
  );
  const visibleRecords = useMemo(() => recordFilter === '全部' || !selected ? data.records : data.records.filter((record) => record.status === recordFilter), [data.records, recordFilter, selected]);
  const openFindings = data.findings.filter((item) => item.status !== '已关闭');
  const allManualChecks = Object.values(store.issuanceChecks).every(Boolean);
  const uncheckedLabels = [
    !store.issuanceChecks.evidence && '证据与计算链完整',
    !store.issuanceChecks.calculation && '计算过程复核通过',
    !store.issuanceChecks.revisions && '历史修订可追溯',
    !store.issuanceChecks.methodology && '方法学与监测计划匹配'
  ].filter((item): item is string => Boolean(item));
  const issuanceReady = data.readiness.ready && allManualChecks;

  const applyEvidence = (evidence: EvidenceResponse) => queryClient.setQueryData(queryKey, evidence);

  const correctionMutation = useMutation({
    mutationFn: submitEvidenceCorrection,
    onSuccess: (response) => {
      applyEvidence(response.evidence);
      setCorrectionOpen(false);
      setCorrectionReason('');
      setMessage({ severity: 'success', text: `已生成新版本 V${response.revision.version}。${response.finding ? '该修订影响计算结果，记录已退回复核并生成待关闭发现项。' : '修订未影响计算结果。'}` });
    },
    onError: async (error) => setMessage({ severity: 'error', text: await getApiError(error) })
  });

  const verifyMutation = useMutation({
    mutationFn: (recordId: string) => verifyEvidenceRecord(recordId, actor),
    onSuccess: (response) => {
      applyEvidence(response.evidence);
      setMessage({ severity: 'success', text: '重新核验已通过，签发门禁将重新计算。' });
    },
    onError: async (error) => setMessage({ severity: 'error', text: await getApiError(error) })
  });

  const findingMutation = useMutation({
    mutationFn: ({ findingId, status }: { findingId: string; status: EvidenceFinding['status'] }) => updateFinding(findingId, status, actor),
    onSuccess: (response, variables) => {
      applyEvidence(response.evidence);
      setMessage({ severity: variables.status === '已关闭' ? 'success' : 'info', text: variables.status === '已关闭' ? '发现项已关闭；如修订发现项均已关闭，可执行重新核验。' : '已发起补证流程。' });
    },
    onError: async (error) => setMessage({ severity: 'error', text: await getApiError(error) })
  });

  const issuanceMutation = useMutation({
    mutationFn: () => submitIssuance(store.issuanceChecks),
    onSuccess: (response) => {
      applyEvidence(response.evidence);
      setMessage({ severity: 'success', text: `签发准备已于 ${formatTime(response.submittedAt ?? new Date().toISOString())} 通过服务端门禁。` });
    },
    onError: async (error) => setMessage({ severity: 'error', text: await getApiError(error) })
  });

  const nav = [
    { id: 'overview', label: '监测期总览', href: '/', icon: DashboardOutlined },
    { id: 'verify', label: '证据与抽样核验', href: '/verify', icon: FindInPageOutlined },
    { id: 'issuance', label: '签发准备', href: '/issuance', icon: AssessmentOutlined }
  ];

  const navDrawer = (
    <Box sx={{ width: drawerWidth, bgcolor: '#f8faf9', height: '100%' }}>
      <Box sx={{ p: 2.2, pt: 3 }}>
        <Typography variant="overline" color="text.secondary">当前项目</Typography>
        <Typography fontWeight={800} fontSize={13} mt={.5}>{data.project.name}</Typography>
        <Typography variant="caption" color="text.secondary">{data.project.id}</Typography>
      </Box>
      <Divider />
      <List sx={{ px: 1, py: 1.2 }}>
        {nav.map(({ id, label, href, icon: Icon }) => (
          <ListItemButton key={id} component={Link} href={href} selected={view === id} sx={{ borderRadius: 1, mb: .4, '&.Mui-selected': { bgcolor: '#e4f1ec', color: '#12664f' } }}>
            <ListItemIcon sx={{ minWidth: 36, color: 'inherit' }}><Icon fontSize="small" /></ListItemIcon>
            <ListItemText primary={label} primaryTypographyProps={{ fontSize: 13, fontWeight: view === id ? 750 : 500 }} />
          </ListItemButton>
        ))}
      </List>
      <Box sx={{ p: 2, mt: 2 }}>
        <Box sx={{ p: 1.3, border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'white' }}>
          <Stack direction="row" alignItems="center" spacing={1} mb={1}><ScienceOutlined color="primary" fontSize="small" /><Typography fontSize={12} fontWeight={750}>核验状态</Typography></Stack>
          <LinearProgress variant="determinate" value={78} sx={{ height: 5, borderRadius: 2 }} />
          <Typography variant="caption" color="text.secondary" display="block" mt={1}>78% 证据已完成初审</Typography>
        </Box>
      </Box>
    </Box>
  );

  const openCorrection = () => {
    if (!selected) return;
    setCorrectionValue(String(selected.activity));
    setCorrectionUnit(selected.unit);
    setCorrectionReason('');
    setCorrectionOpen(true);
  };

  const submitCorrection = () => {
    if (!selected || !correctionValid) return;
    correctionMutation.mutate({ recordId: selected.id, value: Number(correctionValue), unit: correctionUnit, reason: correctionReason.trim(), actor });
  };

  const handleBatchVerify = async () => {
    const results = await Promise.allSettled(store.sampledIds.map((id) => verifyEvidenceRecord(id, actor)));
    const fulfilled = results.filter((result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof verifyEvidenceRecord>>> => result.status === 'fulfilled');
    const rejected = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
    if (fulfilled.length > 0) applyEvidence(fulfilled[fulfilled.length - 1].value.evidence);
    if (rejected.length > 0) setMessage({ severity: 'warning', text: `${rejected.length} 条记录因仍有开放发现项或未满足条件而未通过；请先关闭发现项。` });
    else setMessage({ severity: 'success', text: '抽样记录已全部完成核验。' });
  };

  const parsedCorrectionValue = Number(correctionValue);
  const correctionValid = selected !== undefined && Number.isFinite(parsedCorrectionValue) && parsedCorrectionValue > 0
    && correctionUnit.trim().length > 0 && correctionReason.trim().length >= 2
    && (parsedCorrectionValue !== selected.activity || correctionUnit !== selected.unit);

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar position="fixed" elevation={0} sx={{ zIndex: (theme) => theme.zIndex.drawer + 1, bgcolor: '#173a31', borderBottom: '1px solid rgba(255,255,255,.12)' }}>
        <Toolbar sx={{ minHeight: '62px !important', gap: 1.4 }}>
          <IconButton color="inherit" sx={{ display: { md: 'none' } }} onClick={() => setMobileOpen(true)}><MenuOutlined /></IconButton>
          <Box sx={{ width: 36, height: 36, borderRadius: 1, border: '1px solid #80b6a6', display: 'grid', placeItems: 'center' }}>
            <AccountTreeOutlined fontSize="small" />
          </Box>
          <Box>
            <Typography fontSize={15} fontWeight={800}>碳减排项目监测核验</Typography>
            <Typography fontSize={10} color="#a9c5bc">MRV Evidence & Issuance Readiness</Typography>
          </Box>
          <Box sx={{ flex: 1 }} />
          <Chip size="small" label={`${openFindings.length} 项发现开放`} sx={{ color: '#ffdda7', borderColor: '#a87935', bgcolor: 'rgba(255,255,255,.05)' }} variant="outlined" />
          <IconButton color="inherit"><NotificationsNoneOutlined /></IconButton>
          <Avatar sx={{ width: 30, height: 30, bgcolor: '#e1a45d', fontSize: 12 }}>沈</Avatar>
        </Toolbar>
      </AppBar>
      <Drawer variant="permanent" sx={{ width: drawerWidth, flexShrink: 0, display: { xs: 'none', md: 'block' }, '& .MuiDrawer-paper': { width: drawerWidth, pt: '62px', boxSizing: 'border-box', borderRightColor: '#dce4e0' } }}>{navDrawer}</Drawer>
      <Drawer variant="temporary" open={mobileOpen} onClose={() => setMobileOpen(false)} ModalProps={{ keepMounted: true }} sx={{ display: { xs: 'block', md: 'none' }, '& .MuiDrawer-paper': { width: drawerWidth, pt: '62px' } }}>{navDrawer}</Drawer>

      <Box component="main" sx={{ flexGrow: 1, minWidth: 0, bgcolor: '#f2f5f3', pt: '62px' }}>
        <Box sx={{ p: { xs: 1.5, md: 3 }, maxWidth: 1640, mx: 'auto' }}>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={2} mb={2.4}>
            <Box>
              <Typography variant="overline" color="text.secondary" fontWeight={750}>{data.project.id} / {data.summary.period}</Typography>
              <Typography variant="h5" fontWeight={850} mt={.3}>{view === 'overview' ? '监测期总览' : view === 'verify' ? '证据与抽样核验' : '签发准备'}</Typography>
              <Typography variant="body2" color="text.secondary" mt={.5}>{view === 'overview' ? '汇总活动数据、排放因子、证据完整度和异常波动。' : view === 'verify' ? '逐项核对来源、单位、时间范围，并保留修订链。' : '关闭发现项并完成签发前完整性门禁。'}</Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              <Button variant="outlined" startIcon={<CloudUploadOutlined />}>导入监测数据</Button>
              <Button variant="contained" startIcon={issuanceMutation.isPending ? <CircularProgress size={15} color="inherit" /> : <TaskAltOutlined />} disabled={view !== 'issuance' || !issuanceReady || issuanceMutation.isPending} onClick={() => issuanceMutation.mutate()}>提交签发准备</Button>
            </Stack>
          </Stack>
          {isLoading && <LinearProgress sx={{ mb: 1.5 }} />}
          {message && <Alert severity={message.severity} sx={{ mb: 1.5 }} onClose={() => setMessage(null)}>{message.text}</Alert>}

          {selected && view === 'overview' && (
            <>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(4, 1fr)' }, gap: 1.4, mb: 2 }}>
                {[
                  { label: '减排量', value: data.summary.reduction.toLocaleString(), unit: 'tCO₂e', note: '按服务端最新版本实时重算' },
                  { label: '证据完整度', value: `${data.summary.evidenceRate}%`, unit: '', note: '5 份证据待补充' },
                  { label: '开放发现项', value: `${openFindings.length}`, unit: '项', note: data.readiness.ready ? '无签发阻塞项' : '存在签发阻塞项' },
                  { label: '抽样任务', value: `${store.sampledIds.length} / ${data.summary.sampled}`, unit: '', note: '完成率 67%' }
                ].map((item) => <Card elevation={0} variant="outlined" key={item.label}><CardContent sx={{ p: 1.8, '&:last-child': { pb: 1.8 } }}><Typography variant="caption" color="text.secondary">{item.label}</Typography><Stack direction="row" alignItems="baseline" spacing={.6} mt={.5}><Typography variant="h5" fontWeight={850}>{item.value}</Typography><Typography fontSize={12} color="text.secondary">{item.unit}</Typography></Stack><Typography fontSize={11} color="text.secondary" mt={.7}>{item.note}</Typography></CardContent></Card>)}
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1.55fr) minmax(360px, .85fr)' }, gap: 1.5 }}>
                <Card elevation={0} variant="outlined">
                  <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ p: 1.6 }}>
                    <Box><Typography fontWeight={800} fontSize={14}>活动数据与计算链</Typography><Typography fontSize={11} color="text.secondary">选择记录查看公式、来源证据和修订版本</Typography></Box>
                    <Tabs value={recordFilter} onChange={(_, value) => setRecordFilter(value)} variant="scrollable"><Tab value="全部" label="全部" /><Tab value="待核验" label="待核验" /><Tab value="需补证" label="需补证" /><Tab value="已核验" label="已核验" /></Tabs>
                  </Stack>
                  <Divider />
                  <Box sx={{ overflowX: 'auto' }}>
                    <Box sx={{ minWidth: 840 }}>
                      <Box sx={{ display: 'grid', gridTemplateColumns: '1.7fr .9fr .8fr 1fr .7fr .7fr', gap: 1, px: 1.7, py: 1, bgcolor: '#f7f9f8', color: 'text.secondary', fontSize: 11, fontWeight: 750 }}>
                        <span>数据来源</span><span>活动数据</span><span>排放因子</span><span>时间范围</span><span>证据</span><span>状态</span>
                      </Box>
                      {visibleRecords.map((record) => (
                        <Box key={record.id} role="button" tabIndex={0} onClick={() => store.selectRecord(record.id)} sx={{ display: 'grid', gridTemplateColumns: '1.7fr .9fr .8fr 1fr .7fr .7fr', gap: 1, px: 1.7, py: 1.25, borderTop: '1px solid #e8ecea', cursor: 'pointer', bgcolor: selected.id === record.id ? '#eff7f3' : 'white', '&:hover': { bgcolor: '#f6faf8' } }}>
                          <Box><Typography fontSize={12.5} fontWeight={700}>{record.source}</Typography><Typography fontSize={10} color="text.secondary">{record.id} · {record.owner} · V{record.revision}</Typography></Box>
                          <Box><Typography fontSize={12}>{record.activity.toLocaleString()} {record.unit}</Typography><Typography fontSize={10} color={record.anomaly > 5 ? 'secondary.main' : 'text.secondary'}>异常 {record.anomaly > 0 ? '+' : ''}{record.anomaly}%</Typography></Box>
                          <Typography fontSize={12}>{record.factor} <small>{record.factorUnit}</small></Typography>
                          <Typography fontSize={11}>{record.timeRange}</Typography>
                          <Typography fontSize={12}>{record.evidenceCount} 项</Typography>
                          <Chip size="small" label={record.status} color={record.status === '已核验' ? 'success' : record.status === '需补证' ? 'warning' : 'default'} variant={record.status === '已核验' ? 'filled' : 'outlined'} />
                        </Box>
                      ))}
                    </Box>
                  </Box>
                </Card>
                <Stack spacing={1.5}>
                  <Card elevation={0} variant="outlined"><CardContent>
                    <Stack direction="row" justifyContent="space-between" alignItems="center"><Typography fontWeight={800} fontSize={14}>计算链展开</Typography><Chip size="small" label={`${selected.id} · V${selected.revision}`} /></Stack>
                    <Box sx={{ mt: 1.5, p: 1.3, bgcolor: '#f4f7f5', fontFamily: 'monospace', borderRadius: 1, fontSize: 11 }}>
                      <Box>活动数据 = {selected.activity.toLocaleString()} {selected.unit}</Box>
                      <Box mt={.6}>排放因子 = {selected.factor} {selected.factorUnit}</Box>
                      <Box mt={.6}>换算系数 = {getUnitDivisor(selected) === 1000 ? '0.001' : '1'}</Box>
                      <Divider sx={{ my: 1 }} />
                      <Box sx={{ color: '#14644f', fontWeight: 800 }}>排放量 = {getEmission(selected).toFixed(2)} tCO₂e</Box>
                    </Box>
                    {selected.requiresReverification && <Alert severity="warning" sx={{ mt: 1.2, py: 0 }}>计算结果受修订影响，必须关闭发现项并重新核验。</Alert>}
                    <Stack direction="row" spacing={1} mt={1.5}><Button size="small" variant="outlined" onClick={openCorrection}>修订数据</Button><Button size="small">查看证据</Button></Stack>
                  </CardContent></Card>
                  <Card elevation={0} variant="outlined"><CardContent>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}><Typography fontWeight={800} fontSize={14}>修订链</Typography><Chip size="small" label={`${selectedRevisions.length} 个版本`} /></Stack>
                    <Box sx={{ maxHeight: 265, overflow: 'auto' }}>
                      {selectedRevisions.map((revision) => (
                        <Box key={revision.id} sx={{ py: 1.1, borderTop: '1px solid #edf0ef' }}>
                          <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                            <Chip size="small" color={revision.affectsCalculation ? 'secondary' : 'default'} variant={revision.affectsCalculation ? 'outlined' : 'filled'} label={`V${revision.version}`} />
                            <Typography fontSize={10} color="text.secondary">{formatTime(revision.createdAt)}</Typography>
                          </Stack>
                          <Typography fontSize={11.5} fontWeight={750} mt={.6}>{revision.previousActivity === null ? '初始版本' : `${revision.previousActivity.toLocaleString()} ${revision.previousUnit} → ${revision.activity.toLocaleString()} ${revision.unit}`}</Typography>
                          <Typography fontSize={10.5} color="text.secondary" mt={.35}>{revision.reason}</Typography>
                          <Typography fontSize={10} color="text.secondary" mt={.25}>提交人：{revision.actor}{revision.affectsCalculation ? ' · 影响计算' : ' · 不影响计算'}</Typography>
                        </Box>
                      ))}
                    </Box>
                  </CardContent></Card>
                  <Card elevation={0} variant="outlined"><CardContent><Typography fontWeight={800} fontSize={14} mb={1.2}>核验发现项</Typography>{openFindings.slice(0, 3).map((finding) => <Box key={finding.id} sx={{ py: 1, borderTop: '1px solid #edf0ef' }}><Stack direction="row" spacing={1}><Alert severity={finding.status === '补证中' ? 'warning' : 'error'} sx={{ p: .2, '& .MuiAlert-icon': { mr: .3, fontSize: 17 } }} /><Box><Typography fontSize={12} fontWeight={700}>{finding.id} · {finding.title}</Typography><Typography fontSize={10} color="text.secondary" mt={.3}>{finding.assignee} · {finding.due}</Typography></Box></Stack></Box>)}</CardContent></Card>
                </Stack>
              </Box>
            </>
          )}

          {view === 'verify' && (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1fr) 360px' }, gap: 1.5 }}>
              <Card elevation={0} variant="outlined">
                <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} spacing={1} sx={{ p: 1.6}}>
                  <Box><Typography fontWeight={800} fontSize={14}>证据矩阵与抽样任务</Typography><Typography fontSize={11} color="text.secondary">已抽取 {store.sampledIds.length} 条高价值记录；重新核验由服务端门禁校验</Typography></Box>
                  <Stack direction="row" spacing={1}><Button variant="outlined" onClick={() => useCarbonStore.setState({ sampledIds: data.records.filter((item) => Math.abs(item.anomaly) > 5).map((item) => item.id) })}>按异常抽样</Button><Button variant="contained" onClick={handleBatchVerify}>批量核验</Button></Stack>
                </Stack><Divider />
                {data.records.map((record) => {
                  const recordOpenFindings = data.findings.filter((finding) => finding.recordId === record.id && finding.status !== '已关闭');
                  return (
                    <Box key={record.id} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '22px minmax(210px, 1.3fr) .8fr .8fr .8fr auto' }, alignItems: 'center', gap: 1.2, px: 1.6, py: 1.3, borderTop: '1px solid #edf0ef' }}>
                      <input type="checkbox" checked={store.sampledIds.includes(record.id)} onChange={() => store.toggleSample(record.id)} aria-label={`抽样 ${record.id}`} />
                      <Box><Typography fontSize={12.5} fontWeight={700}>{record.source}</Typography><Typography fontSize={10} color="text.secondary">{record.id} · 证据 {record.evidenceCount} 份 · V{record.revision}</Typography>{record.requiresReverification && <Chip size="small" color="warning" variant="outlined" label="待重新核验" sx={{ mt: .4, height: 20 }} />}</Box>
                      <Box><Typography variant="caption" color="text.secondary">来源</Typography><Typography fontSize={11}>原始计量记录</Typography></Box>
                      <Box><Typography variant="caption" color="text.secondary">单位</Typography><Typography fontSize={11}>{record.unit} / {record.factorUnit}</Typography></Box>
                      <Box><Typography variant="caption" color="text.secondary">时间范围</Typography><Typography fontSize={11}>{record.timeRange.includes('至') ? '已覆盖整期' : '待检查'}</Typography>{record.verifiedAt && <Typography fontSize={10} color="success.main">{record.verifiedBy} · {formatTime(record.verifiedAt)}</Typography>}</Box>
                      <Button size="small" variant="contained" disabled={recordOpenFindings.length > 0 || verifyMutation.isPending} onClick={() => verifyMutation.mutate(record.id)}>{record.status === '已核验' && !record.requiresReverification ? '已核验' : '重新核验'}</Button>
                    </Box>
                  );
                })}
              </Card>
              <Stack spacing={1.5}>
                <Card elevation={0} variant="outlined"><CardContent><Typography fontWeight={800} fontSize={14} mb={1.3}>发现项闭环</Typography>{data.findings.map((finding) => <Box key={finding.id} sx={{ borderTop: '1px solid #edf0ef', py: 1.2 }}><Stack direction="row" justifyContent="space-between" spacing={1}><Typography fontSize={12} fontWeight={700}>{finding.id} · {finding.title}</Typography><Chip size="small" label={finding.status} color={finding.status === '已关闭' ? 'success' : finding.status === '补证中' ? 'warning' : 'error'} /></Stack><Typography fontSize={10.5} color="text.secondary" mt={.5}>{finding.detail}</Typography>{finding.revisionId && <Chip size="small" label={`关联 ${finding.revisionId}`} variant="outlined" sx={{ mt: .7, height: 20 }} />}<Stack direction="row" spacing={.7} mt={1}><Button size="small" disabled={finding.status === '已关闭' || findingMutation.isPending} onClick={() => findingMutation.mutate({ findingId: finding.id, status: '补证中' })}>发起补证</Button><Button size="small" color="primary" variant="contained" disabled={finding.status === '已关闭' || findingMutation.isPending} onClick={() => findingMutation.mutate({ findingId: finding.id, status: '已关闭' })}>关闭</Button></Stack></Box>)}</CardContent></Card>
                <Alert severity="info">影响计算结果的修订会保存旧值新版本、退回复核并生成发现项；发现项关闭后才能重新核验。</Alert>
              </Stack>
            </Box>
          )}

          {view === 'issuance' && (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 400px' }, gap: 1.5 }}>
              <Card elevation={0} variant="outlined">
                <CardContent>
                  <Typography fontWeight={800} fontSize={14}>签发前完整性检查</Typography>
                  <Typography fontSize={11} color="text.secondary" mb={1.5}>服务端会同时校验重新核验、发现项关闭和人工门禁。</Typography>
                  {[
                    { id: 'evidence', title: '证据与计算链完整', detail: '活动数据、排放因子、来源证据与修订说明可追溯。' },
                    { id: 'calculation', title: '计算过程复核通过', detail: '单位和换算系数一致，关键公式由核验员确认。' },
                    { id: 'revisions', title: '历史修订未覆盖原始数据', detail: '所有数据均有版本号、旧值、原因、提交人和提交时间。' },
                    { id: 'methodology', title: '方法学与监测计划匹配', detail: `项目采用 ${data.project.methodology}。` }
                  ].map((item) => <Box key={item.id} component="label" sx={{ display: 'flex', gap: 1.3, alignItems: 'flex-start', borderTop: '1px solid #edf0ef', py: 1.5, cursor: 'pointer' }}><input type="checkbox" checked={store.issuanceChecks[item.id as keyof typeof store.issuanceChecks]} onChange={() => store.toggleIssuanceCheck(item.id as keyof typeof store.issuanceChecks)} /><Box><Typography fontSize={12.5} fontWeight={700}>{item.title}</Typography><Typography fontSize={10.5} color="text.secondary" mt={.4}>{item.detail}</Typography></Box></Box>)}
                </CardContent>
              </Card>
              <Stack spacing={1.5}>
                <Card elevation={0} variant="outlined"><CardContent><Typography fontWeight={800} fontSize={14}>签发就绪度</Typography><Stack direction="row" alignItems="baseline" spacing={1} mt={1}><Typography variant="h4" fontWeight={850}>{Math.round(Object.values(store.issuanceChecks).filter(Boolean).length / 4 * 70 + (data.readiness.ready ? 30 : 0))}%</Typography><Typography fontSize={11} color="text.secondary">完成度</Typography></Stack><LinearProgress variant="determinate" value={Object.values(store.issuanceChecks).filter(Boolean).length / 4 * 100} sx={{ height: 7, borderRadius: 3, mt: 1 }} /><Box sx={{ mt: 1.2 }}>{data.readiness.ready && uncheckedLabels.length === 0 ? <Typography fontSize={11} color="success.main">服务端门禁和人工检查均已满足。</Typography> : <>{data.readiness.blockers.slice(0, 5).map((blocker) => <Typography key={blocker} fontSize={11} color="warning.main">• {blocker}</Typography>)}{uncheckedLabels.map((label) => <Typography key={label} fontSize={11} color="warning.main">• {label}检查未确认</Typography>)}</>}</Box></CardContent></Card>
                <Card elevation={0} variant="outlined"><CardContent><Stack direction="row" justifyContent="space-between"><Typography fontWeight={800} fontSize={14}>版本与核验意见</Typography><IconButton size="small"><MoreHorizOutlined /></IconButton></Stack><Box sx={{ maxHeight: 330, overflow: 'auto' }}>{[...data.revisions].sort((a, b) => b.version - a.version).slice(0, 8).map((item) => <Stack key={item.id} direction="row" spacing={1.2} sx={{ borderTop: '1px solid #edf0ef', py: 1.2 }}><Chip size="small" color={item.affectsCalculation ? 'secondary' : 'default'} variant="outlined" label={`${item.recordId} V${item.version}`} /><Box><Typography fontSize={11.5} fontWeight={700}>{item.actor} · {formatTime(item.createdAt)}</Typography><Typography fontSize={10.5} color="text.secondary">{item.reason}</Typography><Typography fontSize={10} color={item.affectsCalculation ? 'secondary.main' : 'text.secondary'}>{item.previousActivity === null ? '初始版本' : `${item.previousActivity} ${item.previousUnit} → ${item.activity} ${item.unit}`}</Typography></Box></Stack>)}</Box></CardContent></Card>
                <Alert severity={issuanceReady ? 'success' : 'warning'}>{issuanceReady ? '全部门禁已完成，可提交签发准备。' : '影响计算的修订须重新核验，且发现项关闭后才可提交。'}</Alert>
              </Stack>
            </Box>
          )}
        </Box>
      </Box>

      <Tooltip title="核验记录会写入审计链"><Button sx={{ position: 'fixed', bottom: 18, right: 18, zIndex: 5 }} variant="contained" size="small" startIcon={<FactCheckOutlined />}>操作均留痕</Button></Tooltip>
      {correctionOpen && selected && (
        <Box sx={{ position: 'fixed', inset: 0, zIndex: 60, bgcolor: 'rgba(15,25,22,.4)', display: 'grid', placeItems: 'center', p: 2 }} onMouseDown={() => setCorrectionOpen(false)}>
          <Card sx={{ width: 'min(560px, 100%)' }} onMouseDown={(event) => event.stopPropagation()}><CardContent sx={{ p: 2.2 }}>
            <Typography variant="h6" fontWeight={800}>修订活动数据</Typography>
            <Typography variant="body2" color="text.secondary" mt={.5}>当前值 {selected.activity.toLocaleString()} {selected.unit}。提交后保存为 V{selectedRevisions.length + 1}，旧版本继续保留可查。</Typography>
            <TextField fullWidth size="small" label="提交人" value={actor} margin="normal" disabled />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} mt={1}>
              <TextField fullWidth size="small" label="修订后的偏差值" type="number" value={correctionValue} onChange={(event) => setCorrectionValue(event.target.value)} />
              <Select size="small" value={correctionUnit} onChange={(event) => setCorrectionUnit(event.target.value)} sx={{ minWidth: 145 }}>
                {(unitOptions.includes(selected.unit) ? unitOptions : [selected.unit, ...unitOptions]).map((unit) => <MenuItem key={unit} value={unit}>{unit}</MenuItem>)}
              </Select>
            </Stack>
            <TextField fullWidth size="small" label="修订原因" multiline rows={3} value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} margin="normal" />
            {!correctionReason.trim() && <Alert severity="warning">必须填写至少 2 个字符的修订原因。</Alert>}
            {(parsedCorrectionValue === selected.activity && correctionUnit === selected.unit) && <Alert severity="info" sx={{ mt: 1 }}>偏差值或单位至少修改一项才会生成新版本。</Alert>}
            <Stack direction="row" spacing={1} justifyContent="flex-end" mt={2}><Button onClick={() => setCorrectionOpen(false)}>取消</Button><Button variant="contained" disabled={!correctionValid || correctionMutation.isPending} startIcon={correctionMutation.isPending ? <CircularProgress size={15} color="inherit" /> : undefined} onClick={submitCorrection}>保存新版本</Button></Stack>
          </CardContent></Card>
        </Box>
      )}
    </Box>
  );
}
