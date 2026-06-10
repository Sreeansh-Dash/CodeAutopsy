import { create } from 'zustand'

export const useAnalysisStore = create((set) => ({
  selectedNodeId: null,
  setSelectedNode: (id) => set({ selectedNodeId: id }),

  filterLanguage: 'all',
  setFilterLanguage: (lang) => set({ filterLanguage: lang }),

  activeTab: 'insights',
  setActiveTab: (tab) => set({ activeTab: tab }),
}))
