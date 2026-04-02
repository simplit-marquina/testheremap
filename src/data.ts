const VEHICLE_COLORS = [
  '#2A16DA',
  '#E91E63',
  '#4CAF50',
  '#FF9800',
  '#00BCD4',
  '#9C27B0',
  '#F44336',
  '#3F51B5',
  '#009688',
  '#FF5722',
]

function darkenColor(hex: string, amount: number): string {
  const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - Math.round(255 * amount))
  const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - Math.round(255 * amount))
  const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - Math.round(255 * amount))
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

export interface MockVisit {
  id: number
  latitude: number
  longitude: number
  vehicleId: number
  routeId: string
  order: number
  fillColor: string
  strokeColor: string
  hasWarning: boolean
}

export interface MockVehicle {
  id: number
  name: string
  color: string
  originLat: number
  originLng: number
}

function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return s / 2147483647
  }
}

export const MARKER_COUNT_OPTIONS = [100, 200, 350, 600, 1000, 1500, 2000, 2500, 3600] as const

export function generateMockData(totalVisits: number = 200) {
  const rand = seededRandom(42)

  const CENTER_LAT = -33.4489
  const CENTER_LNG = -70.6693
  const SPREAD_LAT = 0.12
  const SPREAD_LNG = 0.15

  const NUM_VEHICLES = 10
  const visitsPerVehicle = Math.ceil(totalVisits / NUM_VEHICLES)

  const vehicles: MockVehicle[] = Array.from({ length: NUM_VEHICLES }, (_, i) => ({
    id: i + 1,
    name: `Vehículo ${i + 1}`,
    color: VEHICLE_COLORS[i],
    originLat: CENTER_LAT + (rand() - 0.5) * SPREAD_LAT * 0.5,
    originLng: CENTER_LNG + (rand() - 0.5) * SPREAD_LNG * 0.5,
  }))

  const visits: MockVisit[] = []
  let visitId = 1

  for (let v = 0; v < NUM_VEHICLES; v++) {
    const vehicle = vehicles[v]
    const routeId = `route-${v + 1}`
    const baseAngle = (v / NUM_VEHICLES) * Math.PI * 2
    const count = Math.min(visitsPerVehicle, totalVisits - visits.length)

    for (let j = 0; j < count; j++) {
      const angle = baseAngle + (rand() - 0.5) * 1.2
      const distance = 0.3 + rand() * 0.7
      const lat = CENTER_LAT + Math.sin(angle) * SPREAD_LAT * distance + (rand() - 0.5) * 0.02
      const lng = CENTER_LNG + Math.cos(angle) * SPREAD_LNG * distance + (rand() - 0.5) * 0.02

      visits.push({
        id: visitId++,
        latitude: lat,
        longitude: lng,
        vehicleId: vehicle.id,
        routeId,
        order: j + 1,
        fillColor: vehicle.color,
        strokeColor: darkenColor(vehicle.color, 0.3),
        hasWarning: rand() < 0.08,
      })
    }
  }

  return { vehicles, visits }
}
