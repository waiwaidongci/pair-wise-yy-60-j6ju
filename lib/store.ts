import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CarbonRecord, Finding } from './types';

// 记录与发现项由 /api/evidence 统一持久化（进程内数据源），这里只保留页面交互状态，
// 避免出现“修订只改本机、刷新回到原值、修订链丢失”的情况。
type State = {
  records: CarbonRecord[];
  findings: Finding[];
  selectedRecordId: string;
  sampledIds: string[];
  issuanceChecks: Record<string, boolean>;
  hydrated: boolean;
  hydrate: (payload: { records: CarbonRecord[]; findings: Finding[] }) => void;
  selectRecord: (id: string) => void;
  toggleSample: (id: string) => void;
  autoSample: (ids: string[]) => void;
  toggleIssuanceCheck: (id: string) => void;
};

export const useCarbonStore = create<State>()(
  persist(
    (set) => ({
      records: [],
      findings: [],
      selectedRecordId: 'ACT-0318',
      sampledIds: ['ACT-0318', 'ACT-0337'],
      issuanceChecks: { evidence: false, calculation: true, revisions: true, methodology: false },
      hydrated: false,
      hydrate: ({ records, findings }) =>
        set((state) => ({
          records,
          findings,
          hydrated: true,
          // 服务端数据回来后，若之前选中的记录已不存在则回落到第一条
          selectedRecordId: records.some((record) => record.id === state.selectedRecordId)
            ? state.selectedRecordId
            : records[0]?.id ?? '',
          sampledIds: state.sampledIds.filter((id) => records.some((record) => record.id === id))
        })),
      selectRecord: (id) => set({ selectedRecordId: id }),
      toggleSample: (id) =>
        set((state) => ({
          sampledIds: state.sampledIds.includes(id)
            ? state.sampledIds.filter((item) => item !== id)
            : [...state.sampledIds, id]
        })),
      autoSample: (ids) => set({ sampledIds: Array.from(new Set(ids)) }),
      toggleIssuanceCheck: (id) =>
        set((state) => ({ issuanceChecks: { ...state.issuanceChecks, [id]: !state.issuanceChecks[id] } }))
    }),
    {
      name: 'yy60-carbon-evidence-v2',
      version: 2,
      // 记录、发现项和水合标记不落本机；服务端才是唯一数据源
      partialize: (state) => ({
        selectedRecordId: state.selectedRecordId,
        sampledIds: state.sampledIds,
        issuanceChecks: state.issuanceChecks
      })
    }
  )
);
