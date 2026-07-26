"use client";

import { useEffect, useRef } from "react";
import maplibregl, { Map as MapLibreMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { LineString } from "geojson";
import type { PlannedStop } from "../lib/types";

interface MapViewProps {
  startLocation: { lat: number; lng: number };
  stops: PlannedStop[];
  routeGeometry: LineString;
  /** Changes whenever a new plan is generated, used to re-trigger the route draw-on animation. */
  revealKey: string;
  selectedStopId: string | null;
  onSelectStop: (id: string) => void;
}

// Free vector tile source — no Mapbox token required.
const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

const ROUTE_SOURCE_ID = "planify-route";
const ROUTE_LAYER_ID = "planify-route-line";

const MARKER_BASE_CLASS =
  "flex items-center justify-center rounded-full bg-gradient-to-br from-clay to-clayDark text-white text-xs font-semibold border-2 border-white shadow-glow cursor-pointer transition-transform duration-200";

const ROUTE_LINE_COLOR = "#22d3ee";
const ROUTE_GLOW_LAYER_ID = "planify-route-glow";

function interpolateLine(coords: [number, number][], t: number): [number, number][] {
  if (coords.length < 2 || !Number.isFinite(t) || t >= 1) return coords;
  const totalSegments = coords.length - 1;
  const scaled = Math.max(0, t) * totalSegments;
  const fullSegments = Math.floor(scaled);
  const partial = scaled - fullSegments;

  const result = coords.slice(0, fullSegments + 1);
  const p1 = coords[fullSegments];
  const p2 = coords[fullSegments + 1];
  if (fullSegments < totalSegments && p1 && p2) {
    const [x1, y1] = p1;
    const [x2, y2] = p2;
    result.push([x1 + (x2 - x1) * partial, y1 + (y2 - y1) * partial]);
  }
  return result;
}

export default function MapView({
  startLocation,
  stops,
  routeGeometry,
  revealKey,
  selectedStopId,
  onSelectStop,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const startMarkerRef = useRef<Marker | null>(null);
  const stopMarkersRef = useRef<Map<string, { marker: Marker; el: HTMLDivElement }>>(new Map());
  const animationFrameRef = useRef<number | null>(null);
  const routeDrawGenerationRef = useRef(0);
  const onSelectStopRef = useRef(onSelectStop);
  onSelectStopRef.current = onSelectStop;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: [startLocation.lng, startLocation.lat],
      zoom: 12,
    });
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    mapRef.current = map;

    // The map lives inside a flex layout (sidebar next to it), so its
    // container's final width isn't necessarily known at construction time.
    // Without this, MapLibre computes marker/pixel positions against a
    // stale (often near-zero) size, and every marker clusters near the
    // top-left corner until something — a zoom, a drag — forces a resize.
    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    function render() {
      map!.resize();
      startMarkerRef.current?.remove();
      stopMarkersRef.current.forEach(({ marker }) => marker.remove());
      stopMarkersRef.current = new Map();

      const bounds = new maplibregl.LngLatBounds();
      bounds.extend([startLocation.lng, startLocation.lat]);

      const startEl = document.createElement("div");
      startEl.setAttribute("role", "img");
      startEl.setAttribute("aria-label", "Starting location");
      startEl.className = "flex h-4 w-4 rounded-full bg-moss border-2 border-white shadow-glowCyan";
      startMarkerRef.current = new maplibregl.Marker({ element: startEl })
        .setLngLat([startLocation.lng, startLocation.lat])
        .addTo(map!);

      stops.forEach((stop, i) => {
        const el = document.createElement("div");
        el.setAttribute("role", "button");
        el.setAttribute("tabindex", "0");
        el.setAttribute("aria-label", `Stop ${i + 1}: ${stop.label}. Press enter for details.`);
        el.style.opacity = "0";
        el.style.transform = "translateY(-8px)";
        el.style.transition = `opacity 0.35s ease-out ${i * 0.09}s, transform 0.35s ease-out ${i * 0.09}s`;
        el.className = `${MARKER_BASE_CLASS} h-7 w-7`;
        el.textContent = String(i + 1);

        const select = () => onSelectStopRef.current(stop.id);
        el.addEventListener("click", select);
        el.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            select();
          }
        });

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([stop.location.lng, stop.location.lat])
          .addTo(map!);
        stopMarkersRef.current.set(stop.id, { marker, el });
        bounds.extend([stop.location.lng, stop.location.lat]);

        requestAnimationFrame(() => {
          el.style.opacity = "1";
          el.style.transform = "translateY(0)";
        });
      });

      if (!bounds.isEmpty()) {
        map!.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 600 });
      }

      animateRouteDraw(map!, routeGeometry);
    }

    if (map.isStyleLoaded()) {
      render();
    } else {
      map.once("load", render);
    }

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startLocation.lat, startLocation.lng, stops, routeGeometry, revealKey]);

  // Toggle the selected marker's visual style without touching the others —
  // keeps this independent of the drop-in animation effect above.
  useEffect(() => {
    stopMarkersRef.current.forEach(({ el }, id) => {
      const isSelected = id === selectedStopId;
      el.style.transform = isSelected ? "scale(1.35) translateY(-2px)" : "scale(1) translateY(0)";
      el.style.zIndex = isSelected ? "10" : "0";
      el.classList.toggle("ring-4", isSelected);
      el.classList.toggle("ring-clay/40", isSelected);
    });
  }, [selectedStopId]);

  function animateRouteDraw(map: MapLibreMap, geometry: LineString) {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    routeDrawGenerationRef.current += 1;
    const myGeneration = routeDrawGenerationRef.current;
    const coords = geometry.coordinates as [number, number][];

    const emptySource = { type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: [] as [number, number][] } };

    const existing = map.getSource(ROUTE_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    if (!existing) {
      map.addSource(ROUTE_SOURCE_ID, { type: "geojson", data: emptySource });
      // Wide, blurred, low-opacity line underneath the crisp one — a cheap
      // way to fake a neon glow around the route without a shader.
      map.addLayer({
        id: ROUTE_GLOW_LAYER_ID,
        type: "line",
        source: ROUTE_SOURCE_ID,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": ROUTE_LINE_COLOR, "line-width": 14, "line-opacity": 0.35, "line-blur": 6 },
      });
      map.addLayer({
        id: ROUTE_LAYER_ID,
        type: "line",
        source: ROUTE_SOURCE_ID,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": ROUTE_LINE_COLOR, "line-width": 4, "line-opacity": 0.95 },
      });
    }

    const source = map.getSource(ROUTE_SOURCE_ID) as maplibregl.GeoJSONSource;
    if (coords.length < 2) {
      source.setData({ type: "Feature", properties: {}, geometry });
      return;
    }

    const durationMs = 900;
    const start = performance.now();

    function step(now: number) {
      if (myGeneration !== routeDrawGenerationRef.current || !map.getSource(ROUTE_SOURCE_ID)) return;
      const t = Math.min((now - start) / durationMs, 1);
      const partial = interpolateLine(coords, t);
      source.setData({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: partial } });
      if (t < 1) {
        animationFrameRef.current = requestAnimationFrame(step);
      }
    }

    animationFrameRef.current = requestAnimationFrame(step);
  }

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label="Map showing today's route"
      className="w-full h-72 sm:h-96 rounded-2xl overflow-hidden border border-sand dark:border-ink/40"
    />
  );
}
