'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
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
  Divider,
  Drawer,
  IconButton,
  LinearProgress,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Snackbar,
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
  HistoryOutlined,
  LockOutlined,
  MenuOutlined,
  NotificationsNoneOutlined,
  PersonOutline,
  ReplayOutlined,
  ScienceOutlined,
  TaskAltOutlined
} from '@mui/icons-material';
import {
  fetchEvidence,
  returnToReviewRemote,
  submitEvidenceCorrection,
  updateFindingRemote,
  verifyRecordRemote
} from '@/lib/api';
import { emissionsFor } from '@/lib/calc';
import { formatDateTime, formatSigned } from '@/lib/format';
import { useCarbonStore } from '@/lib/store';
import type { CarbonRecord } from '@/lib/types';

const drawerWidth = 232;

// 当前登录核验员；所有修订、核验和关闭动作均以该身份写入审计链。
const CURRENT_USER = '核验员 · 沈楠';
const UNIT_CHOICES = ['kWh', 'MWh', 'GJ', 'L', 'kNm3', 't'];

type View = 'overview' | 'verify' | 'issuance';

export default function EvidenceWorkbench({ initialView }: { initialView: View }) {
  const [view] = useState<View>(initialView);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [recordFilter, setRecordFilter] = useState('全部');
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correctionValue, setCorrectionValue] = useState('');
  const [correctionUnit, setCorrectionUnit] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');
  const [toast, setToast] = useState<{ severity: 'success' | 'warning' | 'error'; text: string } | null>(null);

  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['carbon-api'], queryFn: fetchEvidence });
  const store = useCarbonStore();

  // 服务端数据是唯一数据源：接口返回后水合进 store，刷新页面后修订链和状态仍在。
  useEffect(() => {
    if (data) store.hydrate({ records: data.records, findings: data.findings });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const records = store.records;
  const findings = store.findings;
  const selected = records.find((record) => record.id === store.selectedRecordId) ?? records[0];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['carbon-api'] });

  const revisionMutation = useMutation({
    mutationFn: submitEvidenceCorrection,
    onSuccess: (result) => {
      invalidate();
      setCorrectionOpen(false);
      setCorrectionReason('');
      setToast(
        result.impactsCalculation
          ? {
              severity: 'warning',
              text: `V${result.revision} 已保存：该修订影响计算结果，记录已退回复核，发现项 ${result.findingId ?? ''} 待关闭`
            }
          : { severity: 'success', text: `V${result.revision} 已保存，计算结果未受影响，修订链可查回` }
      );
    },
    onError: (error: Error) => setToast({ severity: 'error', text: error.message })
  });

  const verifyMutation = useMutation({
    mutationFn: (recordId: string) => verifyRecordRemote(recordId),
    onSuccess: () => invalidate(),
    onError: (error: Error) => setToast({ severity: 'error', text: error.message })
  });

  const reviewMutation = useMutation({
    mutationFn: (recordId: string) => returnToReviewRemote(recordId),
    onSuccess: () => {
      invalidate();
      setToast({ severity: 'success', text: '记录已退回复核' });
    },
    onError: (error: Error) => setToast({ severity: 'error', text: error.message })
  });

  const findingMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'request' | 'close' }) =>
      updateFindingRemote(id, action, CURRENT_USER),
    onSuccess: (_data, variables) => {
      invalidate();
      setToast({
        severity: 'success',
        text: variables.action === 'close' ? `发现项 ${variables.id} 已关闭并记录关闭人` : `发现项 ${variables.id} 已发起补证`
      });
    },
    onError: (error: Error) => setToast({ severity: 'error', text: error.message })
  });

  const visibleRecords = useMemo(
    () => (recordFilter === '全部' ? records : records.filter((record) => record.status === recordFilter)),
    [recordFilter, records]
  );
  const openFindings = findings.filter((item) => item.status !== '已关闭');
  const pendingRecords = records.filter((record) => record.pendingRevision !== null);

  const blockingFindingFor = (record: CarbonRecord) =>
    record.pendingRevision !== null
      ? openFindings.find((item) => item.recordId === record.id && item.fromRevision === record.pendingRevision)
      : undefined;

  // 签发门禁：检查项全过 + 无开放发现项 + 无等待重新核验的修订记录。
  const allIssuanceChecked =
    Object.values(store.issuanceChecks).every(Boolean) &&
    openFindings.length === 0 &&
    pendingRecords.length === 0;

  const parsedValue = Number(correctionValue);
  const valueValid = correctionValue.trim() !== '' && Number.isFinite(parsedValue) && parsedValue >= 0;
  const unitValid = correctionUnit.trim().length > 0;
  const reasonValid = correctionReason.trim().length > 0;
  const previewEmissions = selected && valueValid && unitValid
    ? emissionsFor(parsedValue, correctionUnit.trim(), selected.factor)
    : null;
  const currentEmissions = selected ? emissionsFor(selected.activity, selected.unit, selected.factor) : 0;
  const willImpact = previewEmissions !== null && Math.abs(previewEmissions - currentEmissions) > 1e-9;

  const openCorrection = (record: CarbonRecord) => {
    store.selectRecord(record.id);
    setCorrectionValue(String(record.activity));
    setCorrectionUnit(record.unit);
    setCorrectionReason('');
    setCorrectionOpen(true);
  };

  const submitCorrection = () => {
    if (!selected) return;
    revisionMutation.mutate({
      recordId: selected.id,
      value: parsedValue,
      unit: correctionUnit.trim(),
      reason: correctionReason.trim(),
      actor: CURRENT_USER
    });
  };

  const handleVerify = (record: CarbonRecord) => {
    const blocking = blockingFindingFor(record);
    if (blocking) {
      setToast({ severity: 'error', text: `请先重新核验并关闭修订发现项 ${blocking.id}，记录才能核验通过` });
      return;
    }
    verifyMutation.mutate(record.id);
  };

  const handleBatchVerify = () => {
    const sampled = records.filter((record) => store.sampledIds.includes(record.id));
    const skipped = sampled.filter(
      (record) => record.status !== '已核验' && Boolean(blockingFindingFor(record))
    );
    const verifiable = sampled.filter(
      (record) => record.status !== '已核验' && !blockingFindingFor(record) && record.status !== '需补证'
    );
    verifiable.forEach((record) => verifyMutation.mutate(record.id));
    if (skipped.length > 0) {
      setToast({
        severity: 'warning',
        text: `${skipped.map((record) => record.id).join('、')} 存在未关闭的修订发现项，已跳过`
      });
    }
  };

  const nav = [
    { id: 'overview', label: '监测期总览', href: '/', icon: DashboardOutlined },
    { id: 'verify', label: '证据与抽样核验', href: '/verify', icon: FindInPageOutlined },
    { id: 'issuance', label: '签发准备', href: '/issuance', icon: AssessmentOutlined }
  ];

  const navDrawer = (
    <Box sx={{ width: drawerWidth, bgcolor: '#f8faf9', height: '100%' }}>
      <Box sx={{ p: 2.2, pt: 3 }}>
        <Typography variant="overline" color="text.secondary">当前项目</Typography>
        <Typography fontWeight={800} fontSize={13} mt={.5}>{data?.project.name ?? '临港工业园区能效提升项目'}</Typography>
        <Typography variant="caption" color="text.secondary">{data?.project.id ?? 'CN-ER-2026-041'}</Typography>
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
          <Tooltip title={CURRENT_USER}><Avatar sx={{ width: 30, height: 30, bgcolor: '#e1a45d', fontSize: 12 }}>沈</Avatar></Tooltip>
        </Toolbar>
      </AppBar>
      <Drawer variant="permanent" sx={{ width: drawerWidth, flexShrink: 0, display: { xs: 'none', md: 'block' }, '& .MuiDrawer-paper': { width: drawerWidth, pt: '62px', boxSizing: 'border-box', borderRightColor: '#dce4e0' } }}>{navDrawer}</Drawer>
      <Drawer variant="temporary" open={mobileOpen} onClose={() => setMobileOpen(false)} ModalProps={{ keepMounted: true }} sx={{ display: { xs: 'block', md: 'none' }, '& .MuiDrawer-paper': { width: drawerWidth, pt: '62px' } }}>{navDrawer}</Drawer>

      <Box component="main" sx={{ flexGrow: 1, minWidth: 0, bgcolor: '#f2f5f3', pt: '62px' }}>
        <Box sx={{ p: { xs: 1.5, md: 3 }, maxWidth: 1640, mx: 'auto' }}>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={2} mb={2.4}>
            <Box>
              <Typography variant="overline" color="text.secondary" fontWeight={750}>CN-ER-2026-041 / {data?.summary.period ?? '第三监测期'}</Typography>
              <Typography variant="h5" fontWeight={850} mt={.3}>{view === 'overview' ? '监测期总览' : view === 'verify' ? '证据与抽样核验' : '签发准备'}</Typography>
              <Typography variant="body2" color="text.secondary" mt={.5}>{view === 'overview' ? '汇总活动数据、排放因子、证据完整度和异常波动。' : view === 'verify' ? '逐项核对来源、单位、时间范围，并保留修订链。' : '关闭发现项并完成签发前完整性门禁。'}</Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              <Button variant="outlined" startIcon={<CloudUploadOutlined />}>导入监测数据</Button>
              <Tooltip title={allIssuanceChecked ? '' : '所有检查项通过、发现项关闭且修订记录重新核验后才能提交'}>
                <span>
                  <Button variant="contained" startIcon={<TaskAltOutlined />} disabled={view !== 'issuance' || !allIssuanceChecked}>提交签发准备</Button>
                </span>
              </Tooltip>
            </Stack>
          </Stack>
          {(isLoading || !store.hydrated) && <LinearProgress sx={{ mb: 2 }} />}

          {view === 'overview' && selected && (
            <>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(4, 1fr)' }, gap: 1.4, mb: 2 }}>
                {[
                  { label: '减排量', value: data?.summary.reduction.toLocaleString() ?? '18,426', unit: 'tCO₂e', note: '较上期 +6.4%' },
                  { label: '证据完整度', value: `${data?.summary.evidenceRate ?? 92}%`, unit: '', note: '5 份证据待补充' },
                  { label: '开放发现项', value: `${openFindings.length}`, unit: '项', note: pendingRecords.length ? `${pendingRecords.length} 条记录待重新核验` : '无修订阻塞项' },
                  { label: '抽样任务', value: `${store.sampledIds.length} / 18`, unit: '', note: '完成率 67%' }
                ].map((item) => <Card elevation={0} variant="outlined" key={item.label}><CardContent sx={{ p: 1.8, '&:last-child': { pb: 1.8 } }}><Typography variant="caption" color="text.secondary">{item.label}</Typography><Stack direction="row" alignItems="baseline" spacing={.6} mt={.5}><Typography variant="h5" fontWeight={850}>{item.value}</Typography><Typography fontSize={12} color="text.secondary">{item.unit}</Typography></Stack><Typography fontSize={11} color="text.secondary" mt={.7}>{item.note}</Typography></CardContent></Card>)}
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1.55fr) minmax(320px, .7fr)' }, gap: 1.5 }}>
                <Card elevation={0} variant="outlined">
                  <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ p: 1.6 }}>
                    <Box><Typography fontWeight={800} fontSize={14}>活动数据与计算链</Typography><Typography fontSize={11} color="text.secondary">选择记录查看公式、来源证据和修订版本</Typography></Box>
                    <Tabs value={recordFilter} onChange={(_, value) => setRecordFilter(value)} variant="scrollable"><Tab value="全部" label="全部" /><Tab value="待核验" label="待核验" /><Tab value="需补证" label="需补证" /><Tab value="复核中" label="复核中" /><Tab value="已核验" label="已核验" /></Tabs>
                  </Stack>
                  <Divider />
                  <Box sx={{ overflowX: 'auto' }}>
                    <Box sx={{ minWidth: 840 }}>
                      <Box sx={{ display: 'grid', gridTemplateColumns: '1.7fr .9fr .8fr 1fr .7fr .7fr', gap: 1, px: 1.7, py: 1, bgcolor: '#f7f9f8', color: 'text.secondary', fontSize: 11, fontWeight: 750 }}>
                        <span>数据来源</span><span>活动数据</span><span>排放因子</span><span>时间范围</span><span>证据</span><span>状态</span>
                      </Box>
                      {visibleRecords.map((record) => (
                        <Box key={record.id} role="button" tabIndex={0} onClick={() => store.selectRecord(record.id)} sx={{ display: 'grid', gridTemplateColumns: '1.7fr .9fr .8fr 1fr .7fr .7fr', gap: 1, px: 1.7, py: 1.25, borderTop: '1px solid #e8ecea', cursor: 'pointer', bgcolor: selected.id === record.id ? '#eff7f3' : 'white', '&:hover': { bgcolor: '#f6faf8' } }}>
                          <Box><Typography fontSize={12.5} fontWeight={700}>{record.source}</Typography><Typography fontSize={10} color="text.secondary">{record.id} · {record.owner} · V{record.revision}</Typography>{record.pendingRevision !== null && <Chip size="small" color="warning" variant="outlined" sx={{ mt: .3, height: 18, fontSize: 9 }} label={`V${record.pendingRevision} 待重新核验`} />}</Box>
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
                    <Stack direction="row" justifyContent="space-between" alignItems="center"><Typography fontWeight={800} fontSize={14}>计算链展开</Typography><Chip size="small" label={selected.id} /></Stack>
                    <Box sx={{ mt: 1.5, p: 1.3, bgcolor: '#f4f7f5', fontFamily: 'monospace', borderRadius: 1, fontSize: 11 }}>
                      <Box>活动数据 = {selected.activity.toLocaleString()} {selected.unit}</Box>
                      <Box mt={.6}>排放因子 = {selected.factor} {selected.factorUnit}</Box>
                      <Box mt={.6}>换算系数 = {selected.unit === 'kWh' || selected.unit === 'L' ? '0.001' : '1'}</Box>
                      <Divider sx={{ my: 1 }} />
                      <Box sx={{ color: '#14644f', fontWeight: 800 }}>减排量 = {(selected.activity * selected.factor / (selected.unit === 'kWh' || selected.unit === 'L' ? 1000 : 1)).toFixed(2)} tCO₂e</Box>
                    </Box>
                    {selected.pendingRevision !== null && (
                      <Alert severity="warning" icon={<LockOutlined fontSize="small" />} sx={{ mt: 1.2, py: .2, fontSize: 11 }}>
                        V{selected.pendingRevision} 修订影响计算结果，已退回复核；重新核验通过且发现项关闭后才放行签发。
                      </Alert>
                    )}
                    <Stack direction="row" spacing={1} mt={1.5}><Button size="small" variant="contained" onClick={() => openCorrection(selected)}>修订数据</Button><Button size="small">查看证据</Button></Stack>
                  </CardContent></Card>

                  <Card elevation={0} variant="outlined"><CardContent>
                    <Stack direction="row" spacing={.8} alignItems="center" mb={1}>
                      <HistoryOutlined fontSize="small" color="primary" />
                      <Typography fontWeight={800} fontSize={14}>修订链 · {selected.id}</Typography>
                      <Chip size="small" label={`V1 - V${selected.revision}`} variant="outlined" />
                    </Stack>
                    <Typography fontSize={10.5} color="text.secondary" mb={.6}>新版本只追加、不覆盖，提交人、时间和旧值均可查回。</Typography>
                    {[...selected.revisions].reverse().map((item) => {
                      const relatedFinding = item.impactsCalculation
                        ? findings.find((finding) => finding.recordId === selected.id && finding.fromRevision === item.revision)
                        : undefined;
                      return (
                        <Box key={item.revision} sx={{ py: 1, borderTop: '1px solid #edf0ef' }}>
                          <Stack direction="row" spacing={.8} alignItems="center" flexWrap="wrap">
                            <Chip size="small" color={item.revision === selected.revision ? 'success' : 'default'} variant={item.revision === selected.revision ? 'filled' : 'outlined'} label={`V${item.revision}`} />
                            <Typography fontSize={11.5} fontWeight={750}>{item.activity.toLocaleString()} {item.unit}</Typography>
                            {item.impactsCalculation
                              ? <Chip size="small" color="warning" sx={{ height: 18, fontSize: 9 }} label="影响计算" />
                              : <Chip size="small" sx={{ height: 18, fontSize: 9 }} label="不影响计算" />}
                            {item.revision === selected.revision && selected.pendingRevision === item.revision && <Chip size="small" color="warning" variant="outlined" sx={{ height: 18, fontSize: 9 }} label="待重新核验" />}
                          </Stack>
                          <Typography fontSize={11} color="text.secondary" mt={.4}>{item.reason}</Typography>
                          <Stack direction="row" spacing={1} mt={.3} flexWrap="wrap">
                            <Typography fontSize={10} color="text.secondary"><PersonOutline sx={{ fontSize: 11, verticalAlign: -1 }} /> {item.actor}</Typography>
                            <Typography fontSize={10} color="text.secondary">{formatDateTime(item.recordedAt)}</Typography>
                          </Stack>
                          {item.previousActivity !== null && (
                            <Typography fontSize={10} color="text.secondary" mt={.2}>
                              旧值 {item.previousActivity.toLocaleString()} {item.previousUnit}
                              （偏差 {formatSigned(item.activity - item.previousActivity)} {item.previousUnit === item.unit ? item.unit : `${item.previousUnit} → ${item.unit}`}）
                            </Typography>
                          )}
                          {relatedFinding && (
                            <Chip
                              size="small"
                              sx={{ mt: .5, height: 18, fontSize: 9 }}
                              color={relatedFinding.status === '已关闭' ? 'success' : 'warning'}
                              variant="outlined"
                              label={`发现项 ${relatedFinding.id} · ${relatedFinding.status}`}
                            />
                          )}
                        </Box>
                      );
                    })}
                  </CardContent></Card>

                  <Card elevation={0} variant="outlined"><CardContent><Typography fontWeight={800} fontSize={14} mb={1.2}>核验发现项</Typography>{openFindings.slice(0, 3).map((finding) => <Box key={finding.id} sx={{ py: 1, borderTop: '1px solid #edf0ef' }}><Stack direction="row" spacing={1}><Alert severity={finding.status === '补证中' ? 'warning' : 'error'} sx={{ p: .2, '& .MuiAlert-icon': { mr: .3, fontSize: 17 } }} /><Box><Typography fontSize={12} fontWeight={700}>{finding.kind === '数据修订' ? <Chip size="small" color="warning" sx={{ mr: .5, height: 17, fontSize: 9 }} label="数据修订" /> : null}{finding.title}</Typography><Typography fontSize={10} color="text.secondary" mt={.3}>{finding.assignee} · {finding.due}</Typography></Box></Stack></Box>)}
                    {openFindings.length === 0 && <Typography fontSize={11.5} color="text.secondary">当前无开放发现项。</Typography>}
                  </CardContent></Card>
                </Stack>
              </Box>
            </>
          )}

          {view === 'verify' && (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1fr) 340px' }, gap: 1.5 }}>
              <Card elevation={0} variant="outlined">
                <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} spacing={1} sx={{ p: 1.6 }}>
                  <Box><Typography fontWeight={800} fontSize={14}>证据矩阵与抽样任务</Typography><Typography fontSize={11} color="text.secondary">已抽取 {store.sampledIds.length} 条高价值记录；影响计算的修订须重新核验</Typography></Box>
                  <Stack direction="row" spacing={1}><Button variant="outlined" onClick={() => store.autoSample(records.filter((item) => Math.abs(item.anomaly) > 5).map((item) => item.id))}>按异常抽样</Button><Button variant="contained" onClick={handleBatchVerify}>批量核验</Button></Stack>
                </Stack><Divider />
                {records.map((record) => {
                  const blocking = blockingFindingFor(record);
                  return (
                    <Box key={record.id} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '22px minmax(210px, 1.3fr) .8fr .8fr .8fr auto' }, alignItems: 'center', gap: 1.2, px: 1.6, py: 1.3, borderTop: '1px solid #edf0ef' }}>
                      <input type="checkbox" checked={store.sampledIds.includes(record.id)} onChange={() => store.toggleSample(record.id)} aria-label={`抽样 ${record.id}`} />
                      <Box>
                        <Typography fontSize={12.5} fontWeight={700}>{record.source}</Typography>
                        <Typography fontSize={10} color="text.secondary">{record.id} · 证据 {record.evidenceCount} 份 · V{record.revision}</Typography>
                        {record.pendingRevision !== null && <Chip size="small" color="warning" variant="outlined" sx={{ mt: .3, height: 18, fontSize: 9 }} icon={<ReplayOutlined sx={{ fontSize: 11 }} />} label={`V${record.pendingRevision} 修订待重新核验`} />}
                      </Box>
                      <Box><Typography variant="caption" color="text.secondary">来源</Typography><Typography fontSize={11}>原始计量记录</Typography></Box>
                      <Box><Typography variant="caption" color="text.secondary">单位</Typography><Typography fontSize={11}>{record.unit} / {record.factorUnit}</Typography></Box>
                      <Box><Typography variant="caption" color="text.secondary">时间范围</Typography><Typography fontSize={11}>{record.timeRange.includes('至') ? '已覆盖整期' : '待检查'}</Typography></Box>
                      <Stack direction="row" spacing={.7}>
                        <Button size="small" variant="outlined" disabled={reviewMutation.isPending} onClick={() => reviewMutation.mutate(record.id)}>退回复核</Button>
                        <Tooltip title={blocking ? `发现项 ${blocking.id} 未关闭，不能核验通过` : ''}>
                          <span><Button size="small" variant="contained" disabled={record.status === '需补证' || Boolean(blocking)} onClick={() => handleVerify(record)}>通过</Button></span>
                        </Tooltip>
                      </Stack>
                    </Box>
                  );
                })}
              </Card>
              <Stack spacing={1.5}>
                <Card elevation={0} variant="outlined"><CardContent><Typography fontWeight={800} fontSize={14} mb={1.3}>发现项闭环</Typography>{findings.map((finding) => <Box key={finding.id} sx={{ borderTop: '1px solid #edf0ef', py: 1.2 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography fontSize={12} fontWeight={700}>
                      {finding.kind === '数据修订' && <Chip size="small" color="warning" sx={{ mr: .5, height: 17, fontSize: 9 }} label="数据修订" />}
                      {finding.title}
                    </Typography>
                    <Chip size="small" label={finding.status} color={finding.status === '已关闭' ? 'success' : finding.status === '补证中' ? 'warning' : 'error'} />
                  </Stack>
                  <Typography fontSize={10.5} color="text.secondary" mt={.5}>{finding.detail}</Typography>
                  <Typography fontSize={10} color="text.secondary" mt={.4}>{finding.recordId}{finding.fromRevision ? ` · V${finding.fromRevision}` : ''} · {finding.assignee} · {finding.due}</Typography>
                  {finding.status === '已关闭' && finding.closedAt && <Typography fontSize={10} color="success.main" mt={.3}>由 {finding.closedBy} 于 {formatDateTime(finding.closedAt)} 关闭</Typography>}
                  <Stack direction="row" spacing={.7} mt={1}><Button size="small" disabled={finding.status === '已关闭' || findingMutation.isPending} onClick={() => findingMutation.mutate({ id: finding.id, action: 'request' })}>发起补证</Button><Button size="small" color="primary" variant="contained" disabled={finding.status === '已关闭' || findingMutation.isPending} onClick={() => findingMutation.mutate({ id: finding.id, action: 'close' })}>关闭</Button></Stack>
                </Box>)}</CardContent></Card>
                <Alert severity="info">影响计算结果的修订会追加新版本、退回复核并生成“数据修订”发现项；关闭发现项并重新核验后，签发准备才允许通过。</Alert>
              </Stack>
            </Box>
          )}

          {view === 'issuance' && (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 380px' }, gap: 1.5 }}>
              <Stack spacing={1.5}>
                <Card elevation={0} variant="outlined">
                  <CardContent>
                    <Typography fontWeight={800} fontSize={14}>签发前完整性检查</Typography>
                    <Typography fontSize={11} color="text.secondary" mb={1.5}>所有门禁项必须确认，开放发现项必须关闭，修订记录必须重新核验通过。</Typography>
                    {[
                      { id: 'evidence', title: '证据与计算链完整', detail: '活动数据、排放因子、来源证据与修订说明可追溯。' },
                      { id: 'calculation', title: '计算过程复核通过', detail: '单位和换算系数一致，关键公式由核验员确认。' },
                      { id: 'revisions', title: '历史修订未覆盖原始数据', detail: '所有数据均有版本号和修订原因，旧值可查回。' },
                      { id: 'methodology', title: '方法学与监测计划匹配', detail: `项目采用 ${data?.project.methodology ?? 'CMS-052-V01'}。` }
                    ].map((item) => <Box key={item.id} component="label" sx={{ display: 'flex', gap: 1.3, alignItems: 'flex-start', borderTop: '1px solid #edf0ef', py: 1.5, cursor: 'pointer' }}><input type="checkbox" checked={store.issuanceChecks[item.id]} onChange={() => store.toggleIssuanceCheck(item.id)} /><Box><Typography fontSize={12.5} fontWeight={700}>{item.title}</Typography><Typography fontSize={10.5} color="text.secondary" mt={.4}>{item.detail}</Typography></Box></Box>)}
                  </CardContent>
                </Card>

                <Card elevation={0} variant="outlined">
                  <CardContent>
                    <Stack direction="row" spacing={.8} alignItems="center"><LockOutlined color={pendingRecords.length || openFindings.length ? 'warning' : 'success'} fontSize="small" /><Typography fontWeight={800} fontSize={14}>修订闭环门禁</Typography></Stack>
                    <Typography fontSize={11} color="text.secondary" mt={.3}>影响计算结果的修订须完成“退回复核 → 重新核验 → 关闭发现项”，记录当前值与历史版本都保留。</Typography>
                    <Box sx={{ mt: 1.2 }}>
                      {pendingRecords.length === 0 && openFindings.filter((item) => item.kind === '数据修订').length === 0 && (
                        <Alert severity="success" sx={{ py: .2 }}>没有等待重新核验的修订记录。</Alert>
                      )}
                      {pendingRecords.map((record) => {
                        const blocking = blockingFindingFor(record);
                        return (
                          <Box key={record.id} sx={{ borderTop: '1px solid #edf0ef', py: 1.1 }}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                              <Box>
                                <Typography fontSize={12} fontWeight={700}>{record.id} · {record.source}</Typography>
                                <Typography fontSize={10.5} color="text.secondary">V{record.pendingRevision} 修订后停留在“{record.status}”，需重新核验通过</Typography>
                              </Box>
                              <Button size="small" variant="outlined" disabled={Boolean(blocking) || verifyMutation.isPending} onClick={() => handleVerify(record)}>
                                {blocking ? `先关闭 ${blocking.id}` : '标记重新核验通过'}
                              </Button>
                            </Stack>
                            {blocking && <Alert severity="warning" sx={{ mt: .8, py: .1, fontSize: 10.5 }}>发现项 {blocking.id} 尚未关闭：{blocking.title}</Alert>}
                          </Box>
                        );
                      })}
                      {openFindings.filter((item) => item.kind === '数据修订').filter((item) => !pendingRecords.some((record) => record.id === item.recordId && record.pendingRevision === item.fromRevision)).map((finding) => (
                        <Alert key={finding.id} severity="warning" sx={{ mt: .8, py: .1, fontSize: 10.5 }}>遗留修订发现项 {finding.id}（{finding.recordId}）仍为{finding.status}</Alert>
                      ))}
                    </Box>
                  </CardContent>
                </Card>
              </Stack>

              <Stack spacing={1.5}>
                <Card elevation={0} variant="outlined"><CardContent>
                  <Typography fontWeight={800} fontSize={14}>签发就绪度</Typography>
                  <Stack direction="row" alignItems="baseline" spacing={1} mt={1}><Typography variant="h4" fontWeight={850}>{Math.round(Object.values(store.issuanceChecks).filter(Boolean).length / 4 * 50 + (openFindings.length === 0 ? 25 : 0) + (pendingRecords.length === 0 ? 25 : 0))}%</Typography><Typography fontSize={11} color="text.secondary">完成度（检查 50% · 发现项 25% · 重新核验 25%）</Typography></Stack>
                  <LinearProgress variant="determinate" value={Object.values(store.issuanceChecks).filter(Boolean).length / 4 * 50 + (openFindings.length === 0 ? 25 : 0) + (pendingRecords.length === 0 ? 25 : 0)} sx={{ height: 7, borderRadius: 3, mt: 1 }} />
                  <Typography fontSize={11} color="text.secondary" mt={1.2}>开放发现项 {openFindings.length} 个；待重新核验记录 {pendingRecords.length} 条。</Typography>
                </CardContent></Card>

                <Card elevation={0} variant="outlined"><CardContent>
                  <Typography fontWeight={800} fontSize={14} mb={.6}>修订记录与核验意见</Typography>
                  <Typography fontSize={10.5} color="text.secondary" mb={.6}>提交人、提交时间与版本直接查回自修订链。</Typography>
                  {records.flatMap((record) => record.revisions.map((item) => ({ record, item })))
                    .sort((a, b) => new Date(b.item.recordedAt).getTime() - new Date(a.item.recordedAt).getTime())
                    .slice(0, 9)
                    .map(({ record, item }) => (
                      <Stack key={`${record.id}-${item.revision}`} direction="row" spacing={1.2} sx={{ borderTop: '1px solid #edf0ef', py: 1.1 }}>
                        <Chip size="small" color={item.impactsCalculation ? 'warning' : 'default'} variant={item.impactsCalculation ? 'outlined' : 'filled'} label={`V${item.revision}`} />
                        <Box sx={{ minWidth: 0 }}>
                          <Typography fontSize={11.5} fontWeight={700} noWrap>{record.id} · {item.actor}</Typography>
                          <Typography fontSize={10.5} color="text.secondary" noWrap>{item.reason}</Typography>
                          <Typography fontSize={10} color="text.secondary">{formatDateTime(item.recordedAt)} · {item.activity.toLocaleString()} {item.unit}{item.impactsCalculation ? ' · 影响计算' : ''}</Typography>
                        </Box>
                      </Stack>
                    ))}
                </CardContent></Card>

                <Alert severity={allIssuanceChecked ? 'success' : 'warning'}>{allIssuanceChecked ? '全部门禁已完成，可提交签发准备。' : `尚不能提交：${Object.values(store.issuanceChecks).every(Boolean) ? '' : '存在未确认检查项；'}${openFindings.length ? `${openFindings.length} 个发现项未关闭；` : ''}${pendingRecords.length ? `${pendingRecords.length} 条修订记录未重新核验；` : ''}`.replace(/；$/, '')}</Alert>
              </Stack>
            </Box>
          )}
        </Box>
      </Box>

      <Tooltip title="核验记录会写入审计链"><Button sx={{ position: 'fixed', bottom: 18, right: 18, zIndex: 5 }} variant="contained" size="small" startIcon={<FactCheckOutlined />}>操作均留痕</Button></Tooltip>

      {correctionOpen && selected && (
        <Box sx={{ position: 'fixed', inset: 0, zIndex: 60, bgcolor: 'rgba(15,25,22,.4)', display: 'grid', placeItems: 'center', p: 2 }} onMouseDown={() => !revisionMutation.isPending && setCorrectionOpen(false)}>
          <Card sx={{ width: 'min(560px, 100%)' }} onMouseDown={(event) => event.stopPropagation()}><CardContent sx={{ p: 2.2 }}>
            <Typography variant="h6" fontWeight={800}>修订活动数据 · {selected.id}</Typography>
            <Typography variant="body2" color="text.secondary" mt={.5}>当前值 {selected.activity.toLocaleString()} {selected.unit}，提交后保存为 V{selected.revision + 1}；旧版本与计算链继续保留可查。</Typography>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} mt={1.5}>
              <TextField
                sx={{ flex: 1.4 }}
                size="small"
                label="修订后偏差值（活动数据）"
                type="number"
                value={correctionValue}
                onChange={(event) => setCorrectionValue(event.target.value)}
                margin="none"
                inputProps={{ min: 0, step: 'any' }}
                error={correctionValue !== '' && !valueValid}
                helperText={correctionValue !== '' && !valueValid ? '请输入不小于 0 的数字' : ' '}
              />
              <TextField
                sx={{ flex: .8 }}
                size="small"
                label="单位"
                value={correctionUnit}
                onChange={(event) => setCorrectionUnit(event.target.value)}
                margin="none"
                select
                SelectProps={{ native: true }}
                error={!unitValid}
                helperText={unitValid ? ' ' : '单位必填'}
              >
                {UNIT_CHOICES.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                {!UNIT_CHOICES.includes(correctionUnit) && correctionUnit && <option value={correctionUnit}>{correctionUnit}</option>}
              </TextField>
            </Stack>
            <TextField fullWidth size="small" label="修订原因（必填）" multiline rows={3} value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} margin="normal" />

            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1} alignItems={{ sm: 'center' }}>
              <Typography fontSize={11} color="text.secondary">
                <PersonOutline sx={{ fontSize: 13, verticalAlign: -2 }} /> 提交人：{CURRENT_USER}
                {valueValid && unitValid && (
                  <Box component="span" ml={1.5}>
                    偏差 {formatSigned(parsedValue - selected.activity)} {correctionUnit.trim() === selected.unit ? selected.unit : `${selected.unit} → ${correctionUnit.trim()}`}
                  </Box>
                )}
              </Typography>
              {previewEmissions !== null && (
                <Chip
                  size="small"
                  color={willImpact ? 'warning' : 'success'}
                  variant={willImpact ? 'outlined' : 'filled'}
                  label={willImpact
                    ? `减排量 ${currentEmissions.toFixed(2)} → ${previewEmissions.toFixed(2)} tCO₂e，将退回复核并生成发现项`
                    : '减排量未变化，无需退回复核'}
                />
              )}
            </Stack>

            {revisionMutation.isError && <Alert severity="error" sx={{ mt: 1 }}>{revisionMutation.error.message}</Alert>}
            <Stack direction="row" spacing={1} justifyContent="flex-end" mt={2}>
              <Button onClick={() => setCorrectionOpen(false)} disabled={revisionMutation.isPending}>取消</Button>
              <Button variant="contained" loading={revisionMutation.isPending} disabled={!valueValid || !unitValid || !reasonValid} onClick={submitCorrection}>提交并生成新版本</Button>
            </Stack>
          </CardContent></Card>
        </Box>
      )}

      <Snackbar
        open={toast !== null}
        autoHideDuration={5000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {toast ? <Alert severity={toast.severity} onClose={() => setToast(null)} variant="filled" sx={{ maxWidth: 560 }}>{toast.text}</Alert> : undefined}
      </Snackbar>
    </Box>
  );
}
