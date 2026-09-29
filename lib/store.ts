import { create } from 'zustand';

type State = {
  selectedRecordId: string;
  sampledIds: string[];
  issuanceChecks: Record<'evidence' | 'calculation' | 'revisions' | 'methodology', boolean>;
  selectRecord: (id: string) => void;
  toggleSample: (id: string) => void;
  toggleIssuanceCheck: (id: 'evidence' | 'calculation' | 'revisions' | 'methodology') => void;
};

export const useCarbonStore = create<State>()((set) => ({
  selectedRecordId: 'ACT-0318',
  sampledIds: ['ACT-0318', 'ACT-0337'],
  issuanceChecks: { evidence: false, calculation: true, revisions: true, methodology: false },
  selectRecord: (id) => set({ selectedRecordId: id }),
  toggleSample: (id) => set((state) => ({ sampledIds: state.sampledIds.includes(id) ? state.sampledIds.filter((item) => item !== id) : [...state.sampledIds, id] })),
  toggleIssuanceCheck: (id) => set((state) => ({ issuanceChecks: { ...state.issuanceChecks, [id]: !state.issuanceChecks[id] } }))
}));
