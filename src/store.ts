import { create } from 'zustand'

interface MapStore {
  selectedVisits: number[]
  setSelectedVisits: (visits: number[]) => void
  clearSelectedVisits: () => void
  toggleVisit: (visitId: number) => void
}

export const useMapStore = create<MapStore>((set, get) => ({
  selectedVisits: [],
  setSelectedVisits: (visits) => set({ selectedVisits: visits }),
  clearSelectedVisits: () => set({ selectedVisits: [] }),
  toggleVisit: (visitId) => {
    const { selectedVisits } = get()
    if (selectedVisits.includes(visitId)) {
      set({ selectedVisits: selectedVisits.filter((id) => id !== visitId) })
    } else {
      set({ selectedVisits: [...selectedVisits, visitId] })
    }
  },
}))
