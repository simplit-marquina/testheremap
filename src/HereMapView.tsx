import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  generateMockData,
  MARKER_COUNT_OPTIONS,
  type MockVehicle,
  type MockVisit,
} from "./data";
import { HERE_MAP_STYLES } from "./hereMapStyles";
import { vehicleOriginMarkerSvg, visitMarkerWithLabelSvg } from "./markers";
import { useMapStore } from "./store";

const HERE_API_KEY = "qp89sQpjzWvFRSgy0BA4w7BGI4_quDgIRuEYEq_eU3Y";

interface HereMarkerData {
  marker: H.map.Marker;
  visitId: number;
  vehicleId: number;
  routeId: string;
  originalFillColor: string;
  originalStrokeColor: string;
  order: number;
  hasWarning: boolean;
}

const ICON_SIZE = { w: 20, h: 29 };
const ICON_ANCHOR = { x: 10, y: 29 };

function fitBoundsToMarkers(map: H.Map, currentVisits: MockVisit[]) {
  if (currentVisits.length === 0) return;
  const first = currentVisits[0];
  let rect = new H.geo.Rect(
    first.latitude,
    first.longitude,
    first.latitude,
    first.longitude,
  );
  currentVisits.forEach((v) => {
    rect = rect.mergePoint(new H.geo.Point(v.latitude, v.longitude));
  });
  const pad = 0.1;
  const expanded = new H.geo.Rect(
    rect.getTop() + (rect.getTop() - rect.getBottom()) * pad,
    rect.getLeft() - (rect.getRight() - rect.getLeft()) * pad,
    rect.getBottom() - (rect.getTop() - rect.getBottom()) * pad,
    rect.getRight() + (rect.getRight() - rect.getLeft()) * pad,
  );
  map.getViewModel().setLookAtData({ bounds: expanded }, true);
}

export function HereMapView() {
  const mapRef = useRef<HTMLDivElement>(null);
  const hereMapRef = useRef<H.Map | null>(null);
  const markersGroupRef = useRef<H.map.Group | null>(null);
  const originsGroupRef = useRef<H.map.Group | null>(null);
  const hereMarkersRef = useRef<HereMarkerData[]>([]);
  const currentlySelectedRef = useRef<Set<number>>(new Set());
  const selectedVehicleIdRef = useRef<number | null>(null);
  const showAllRoutesRef = useRef(true);

  const [markerCount, setMarkerCount] = useState(200);
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(
    null,
  );
  const [showAllRoutes, setShowAllRoutes] = useState(true);

  const selectedVisits = useMapStore((s) => s.selectedVisits);
  const clearSelectedVisits = useMapStore((s) => s.clearSelectedVisits);

  const { vehicles, visits } = useMemo(
    () => generateMockData(markerCount),
    [markerCount],
  );

  useEffect(() => {
    selectedVehicleIdRef.current = selectedVehicleId;
  }, [selectedVehicleId]);

  useEffect(() => {
    showAllRoutesRef.current = showAllRoutes;
  }, [showAllRoutes]);

  const handleMarkerCountChange = useCallback((count: number) => {
    useMapStore.getState().clearSelectedVisits();
    setSelectedVehicleId(null);
    setShowAllRoutes(true);
    setMarkerCount(count);
  }, []);

  const createMarkers = useCallback(
    (
      map: H.Map,
      currentVisits: MockVisit[],
      currentVehicles: MockVehicle[],
    ) => {
      if (markersGroupRef.current) {
        map.removeObject(markersGroupRef.current);
      }
      if (originsGroupRef.current) {
        map.removeObject(originsGroupRef.current);
      }

      const visitGroup = new H.map.Group({ volatility: true } as never);
      const originGroup = new H.map.Group({ volatility: true } as never);

      const newMarkers: HereMarkerData[] = currentVisits.map((visit, index) => {
        const svgString = visitMarkerWithLabelSvg({
          fillColor: visit.fillColor,
          strokeColor: visit.strokeColor,
          label: visit.order,
          hasWarning: visit.hasWarning,
        });

        const icon = new H.map.Icon(svgString, {
          size: { ...ICON_SIZE, ...(visit.hasWarning ? { w: 23 } : {}) },
          anchor: ICON_ANCHOR,
        });

        const marker = new H.map.Marker(
          new H.geo.Point(visit.latitude, visit.longitude),
          {
            icon,
            volatility: true,
            data: {
              id: `marker-${index}`,
              vehicleId: visit.vehicleId,
              visitId: visit.id,
            },
          } as never,
        );

        marker.addEventListener("tap", () => {
          useMapStore.getState().toggleVisit(visit.id);
        });

        marker.addEventListener("pointerenter", () => {
          const el = map.getViewPort().element as HTMLElement | null;
          if (el?.style) el.style.cursor = "pointer";
        });
        marker.addEventListener("pointerleave", () => {
          const el = map.getViewPort().element as HTMLElement | null;
          if (el?.style) el.style.cursor = "grab";
        });

        visitGroup.addObject(marker);

        return {
          marker,
          visitId: visit.id,
          vehicleId: visit.vehicleId,
          routeId: visit.routeId,
          originalFillColor: visit.fillColor,
          originalStrokeColor: visit.strokeColor,
          order: visit.order,
          hasWarning: visit.hasWarning,
        };
      });

      currentVehicles.forEach((vehicle) => {
        const svgString = vehicleOriginMarkerSvg({ fillColor: vehicle.color });
        const icon = new H.map.Icon(svgString, {
          size: { w: 21, h: 30 },
          anchor: { x: 10, y: 30 },
        });
        const marker = new H.map.Marker(
          new H.geo.Point(vehicle.originLat, vehicle.originLng),
          {
            icon,
            volatility: true,
            data: { type: "origin", vehicleId: vehicle.id },
          } as never,
        );
        marker.setZIndex(100);
        originGroup.addObject(marker);
      });

      map.addObject(visitGroup);
      map.addObject(originGroup);

      markersGroupRef.current = visitGroup;
      originsGroupRef.current = originGroup;
      hereMarkersRef.current = newMarkers;
      currentlySelectedRef.current = new Set();

      fitBoundsToMarkers(map, currentVisits);
    },
    [],
  );

  useLayoutEffect(() => {
    if (!mapRef.current || hereMapRef.current) return;

    const platform = new H.service.Platform({ apikey: HERE_API_KEY });
    const engineType = (H.Map.EngineType as unknown as Record<string, number>)[
      "HARP"
    ];

    const style = new (H.map.render as any).harp.Style(HERE_MAP_STYLES);
    const vectorTileService = (platform as any).getOMVService();
    const vectorTileProvider = new (H.service as any).omv.Provider(
      vectorTileService,
      style,
      { engineType },
    );
    const vectorTileLayer = new H.map.layer.TileLayer(vectorTileProvider, {
      max: 22,
      min: 0,
    } as never);

    const map = new H.Map(mapRef.current, vectorTileLayer, {
      engineType,
      center: { lat: -33.4489, lng: -70.6693 },
      zoom: 12,
      pixelRatio: window.devicePixelRatio || 1,
    });

    new H.mapevents.Behavior(new H.mapevents.MapEvents(map));

    const defaultLayers = platform.createDefaultLayers({
      engineType,
      pois: true,
    } as never);
    H.ui.UI.createDefault(map, defaultLayers as never);

    const handleResize = () => map.getViewPort().resize();
    window.addEventListener("resize", handleResize);

    hereMapRef.current = map;
    createMarkers(map, visits, vehicles);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hereMapRef.current) return;
    createMarkers(hereMapRef.current, visits, vehicles);
  }, [visits, vehicles, createMarkers]);

  // Subscribe to Zustand store for selection changes - diff-only updates
  useEffect(() => {
    const unsubscribe = useMapStore.subscribe((state, prevState) => {
      if (state.selectedVisits === prevState.selectedVisits) return;

      const newSelectedSet = new Set(state.selectedVisits);
      const oldSelectedSet = currentlySelectedRef.current;

      const changedVisitIds = new Set<number>();

      newSelectedSet.forEach((id) => {
        if (!oldSelectedSet.has(id)) changedVisitIds.add(id);
      });
      oldSelectedSet.forEach((id) => {
        if (!newSelectedSet.has(id)) changedVisitIds.add(id);
      });

      if (changedVisitIds.size === 0) {
        currentlySelectedRef.current = newSelectedSet;
        return;
      }

      hereMarkersRef.current.forEach((md) => {
        if (!changedVisitIds.has(md.visitId)) return;

        const isSelected = newSelectedSet.has(md.visitId);
        const isDimmed =
          !showAllRoutesRef.current &&
          selectedVehicleIdRef.current != null &&
          md.vehicleId !== selectedVehicleIdRef.current &&
          !isSelected;

        let fill = md.originalFillColor;
        let stroke = md.originalStrokeColor;
        if (isSelected) {
          fill = darkenHex(fill, 0.3);
          stroke = darkenHex(stroke, 0.3);
        }

        const svgString = visitMarkerWithLabelSvg({
          fillColor: isDimmed ? hexToRgba(fill, 0.25) : fill,
          strokeColor: isDimmed ? hexToRgba(stroke, 0.25) : stroke,
          label: md.order,
          hasWarning: md.hasWarning,
        });

        const icon = new H.map.Icon(svgString, {
          size: { ...ICON_SIZE, ...(md.hasWarning ? { w: 23 } : {}) },
          anchor: ICON_ANCHOR,
        });
        md.marker.setIcon(icon);
      });

      currentlySelectedRef.current = newSelectedSet;
    });

    return unsubscribe;
  }, []);

  // Vehicle filter: update ALL markers opacity/zIndex
  useEffect(() => {
    const selectedSet = currentlySelectedRef.current;

    hereMarkersRef.current.forEach((md) => {
      const isSelected = selectedSet.has(md.visitId);
      const isDimmed =
        !showAllRoutes &&
        selectedVehicleId != null &&
        md.vehicleId !== selectedVehicleId &&
        !isSelected;

      let fill = md.originalFillColor;
      let stroke = md.originalStrokeColor;
      if (isSelected) {
        fill = darkenHex(fill, 0.3);
        stroke = darkenHex(stroke, 0.3);
      }

      const svgString = visitMarkerWithLabelSvg({
        fillColor: isDimmed ? hexToRgba(fill, 0.25) : fill,
        strokeColor: isDimmed ? hexToRgba(stroke, 0.25) : stroke,
        label: md.order,
        hasWarning: md.hasWarning,
      });

      const icon = new H.map.Icon(svgString, {
        size: { ...ICON_SIZE, ...(md.hasWarning ? { w: 23 } : {}) },
        anchor: ICON_ANCHOR,
      });
      md.marker.setIcon(icon);

      if (!showAllRoutes && selectedVehicleId != null) {
        md.marker.setZIndex(md.vehicleId === selectedVehicleId ? 50 : 1);
      } else {
        md.marker.setZIndex(10);
      }
    });
  }, [selectedVehicleId, showAllRoutes]);

  const vehicleVisitCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    visits.forEach((v) => {
      counts[v.vehicleId] = (counts[v.vehicleId] || 0) + 1;
    });
    return counts;
  }, [visits]);

  const handleVehicleClick = (vehicle: MockVehicle) => {
    if (selectedVehicleId === vehicle.id) {
      setSelectedVehicleId(null);
      setShowAllRoutes(true);
    } else {
      setSelectedVehicleId(vehicle.id);
      setShowAllRoutes(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <Sidebar
        vehicles={vehicles}
        selectedVehicleId={selectedVehicleId}
        showAllRoutes={showAllRoutes}
        selectedVisitCount={selectedVisits.length}
        vehicleVisitCounts={vehicleVisitCounts}
        markerCount={markerCount}
        onMarkerCountChange={handleMarkerCountChange}
        onVehicleClick={handleVehicleClick}
        onToggleShowAll={() => {
          setShowAllRoutes((prev) => !prev);
          if (!showAllRoutes) setSelectedVehicleId(null);
        }}
        onClearSelection={clearSelectedVisits}
      />
      <div ref={mapRef} style={{ flex: 1, height: "100%" }} />
    </div>
  );
}

function Sidebar({
  vehicles,
  selectedVehicleId,
  showAllRoutes,
  selectedVisitCount,
  vehicleVisitCounts,
  markerCount,
  onMarkerCountChange,
  onVehicleClick,
  onToggleShowAll,
  onClearSelection,
}: {
  vehicles: MockVehicle[];
  selectedVehicleId: number | null;
  showAllRoutes: boolean;
  selectedVisitCount: number;
  vehicleVisitCounts: Record<number, number>;
  markerCount: number;
  onMarkerCountChange: (count: number) => void;
  onVehicleClick: (v: MockVehicle) => void;
  onToggleShowAll: () => void;
  onClearSelection: () => void;
}) {
  return (
    <div
      style={{
        width: 300,
        background: "#1a1a2e",
        color: "#e0e0e0",
        padding: 16,
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <h2 style={{ margin: 0, fontSize: 18, color: "#fff" }}>HERE Maps Test</h2>
      <p style={{ margin: 0, fontSize: 13, color: "#888" }}>
        {markerCount} markers / 10 vehículos
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label style={{ fontSize: 13, color: "#aaa" }}>
          Cantidad de markers
        </label>
        <select
          value={markerCount}
          onChange={(e) => onMarkerCountChange(Number(e.target.value))}
          style={{
            padding: "6px 10px",
            borderRadius: 6,
            border: "1px solid #333",
            background: "#16213e",
            color: "#e0e0e0",
            fontSize: 13,
            cursor: "pointer",
            outline: "none",
          }}
        >
          {MARKER_COUNT_OPTIONS.map((count) => (
            <option key={count} value={count}>
              {count.toLocaleString()} markers
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <label
          style={{
            fontSize: 13,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <input
            type="checkbox"
            checked={showAllRoutes}
            onChange={onToggleShowAll}
          />
          Mostrar todas las rutas
        </label>
      </div>

      {selectedVisitCount > 0 && (
        <div
          style={{
            background: "#16213e",
            borderRadius: 8,
            padding: "8px 12px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 13 }}>
            {selectedVisitCount} visitas seleccionadas
          </span>
          <button
            onClick={onClearSelection}
            style={{
              background: "#e94560",
              border: "none",
              color: "#fff",
              padding: "4px 10px",
              borderRadius: 4,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Limpiar
          </button>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <h3 style={{ margin: 0, fontSize: 14, color: "#aaa" }}>Vehículos</h3>
        {vehicles.map((vehicle) => (
          <button
            key={vehicle.id}
            onClick={() => onVehicleClick(vehicle)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 12px",
              border:
                selectedVehicleId === vehicle.id
                  ? `2px solid ${vehicle.color}`
                  : "2px solid transparent",
              borderRadius: 8,
              background:
                selectedVehicleId === vehicle.id ? "#16213e" : "transparent",
              color: "#e0e0e0",
              cursor: "pointer",
              textAlign: "left",
              transition: "all 0.15s ease",
            }}
          >
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: vehicle.color,
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 13, flex: 1 }}>{vehicle.name}</span>
            <span style={{ fontSize: 12, color: "#888" }}>
              {vehicleVisitCounts[vehicle.id] || 0}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function darkenHex(hex: string, amount: number): string {
  const r = Math.max(
    0,
    parseInt(hex.slice(1, 3), 16) - Math.round(255 * amount),
  );
  const g = Math.max(
    0,
    parseInt(hex.slice(3, 5), 16) - Math.round(255 * amount),
  );
  const b = Math.max(
    0,
    parseInt(hex.slice(5, 7), 16) - Math.round(255 * amount),
  );
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function hexToRgba(hex: string, alpha: number): string {
  if (hex.startsWith("rgba") || hex.startsWith("rgb")) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
