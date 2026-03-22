import { create } from 'zustand'
import { useShallow } from 'zustand/shallow'
import type { Filters } from '../data/types'

interface FilterState extends Filters {
  setDateRange: (from: string | null, to: string | null) => void
  setProject: (project: string | null) => void
  setModel: (model: string | null) => void
  setMinCost: (minCost: number) => void
  setExcludeSubagents: (exclude: boolean) => void
  setLastNDays: (n: number) => void
  resetFilters: () => void
}

const defaultFilters: Filters = {
  dateFrom: null,
  dateTo: null,
  project: null,
  model: null,
  minCost: 0,
  excludeSubagents: true,
}

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

export const useFilterStore = create<FilterState>((set) => ({
  ...defaultFilters,
  setDateRange: (dateFrom, dateTo) => set({ dateFrom, dateTo }),
  setProject: (project) => set({ project }),
  setModel: (model) => set({ model }),
  setMinCost: (minCost) => set({ minCost }),
  setExcludeSubagents: (excludeSubagents) => set({ excludeSubagents }),
  setLastNDays: (n) => set({ dateFrom: daysAgo(n), dateTo: null }),
  resetFilters: () => set(defaultFilters),
}))

export function useFilters(): Filters {
  return useFilterStore(
    useShallow((s) => ({
      dateFrom: s.dateFrom,
      dateTo: s.dateTo,
      project: s.project,
      model: s.model,
      minCost: s.minCost,
      excludeSubagents: s.excludeSubagents,
    }))
  )
}
