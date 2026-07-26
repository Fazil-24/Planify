import type { LineString } from "geojson";
import { withRetry } from "../utils/retry";
import { matrixCache } from "../utils/cache";

const TOMTOM_MATRIX_URL = "https://api.tomtom.com/routing/matrix/2";
const TOMTOM_ROUTE_URL = "https://api.tomtom.com/routing/1/calculateRoute";

export interface LatLng {
  lat: number;
  lng: number;
}

interface TomTomMatrixResponse {
  data: Array<{
    originIndex: number;
    destinationIndex: number;
    routeSummary?: { travelTimeInSeconds: number };
  }>;
}

/**
 * Builds a live-traffic travel-time matrix (minutes) between all locations.
 * locations[0] must be the start location; the rest are task locations in
 * the same order the caller wants them addressable by index.
 * Cached with a short TTL since traffic conditions are time-sensitive.
 */
export async function buildTravelTimeMatrix(locations: LatLng[]): Promise<number[][]> {
  const cacheKey = JSON.stringify(locations);

  const result = await matrixCache.getOrCompute(cacheKey, async () => {
    const apiKey = process.env.TOMTOM_API_KEY;
    if (!apiKey) throw new Error("TOMTOM_API_KEY is not set");

    const body = {
      origins: locations.map((l) => ({ point: { latitude: l.lat, longitude: l.lng } })),
      destinations: locations.map((l) => ({ point: { latitude: l.lat, longitude: l.lng } })),
    };

    const data = await withRetry(
      async () => {
        const res = await fetch(`${TOMTOM_MATRIX_URL}?key=${apiKey}&routeType=fastest&traffic=live`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`TomTom Matrix API error ${res.status}`);
        return (await res.json()) as TomTomMatrixResponse;
      },
      { label: "tomtom-matrix", timeoutMs: 15_000 }
    );

    const n = locations.length;
    const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
    for (const cell of data.data) {
      const seconds = cell.routeSummary?.travelTimeInSeconds ?? 0;
      matrix[cell.originIndex][cell.destinationIndex] = Math.round(seconds / 60);
    }
    return matrix;
  }, 5 * 60 * 1000);
  return result as number[][];
}

/**
 * Fetches the actual road-route geometry through an ordered sequence of
 * locations, for drawing the route line on the map.
 */
export async function buildRouteGeometry(orderedLocations: LatLng[]): Promise<LineString> {
  const apiKey = process.env.TOMTOM_API_KEY;
  if (!apiKey) throw new Error("TOMTOM_API_KEY is not set");

  if (orderedLocations.length < 2) {
    return {
      type: "LineString",
      coordinates: orderedLocations.map((l) => [l.lng, l.lat]),
    };
  }

  const locationsParam = orderedLocations.map((l) => `${l.lat},${l.lng}`).join(":");
  const url = `${TOMTOM_ROUTE_URL}/${locationsParam}/json?key=${apiKey}&traffic=true`;

  interface TomTomRouteResponse {
    routes: Array<{ legs: Array<{ points: Array<{ latitude: number; longitude: number }> }> }>;
  }

  const data = await withRetry(
    async () => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`TomTom Routing API error ${res.status}`);
      return (await res.json()) as TomTomRouteResponse;
    },
    { label: "tomtom-route", timeoutMs: 15_000 }
  );

  const coordinates: [number, number][] = [];
  for (const leg of data.routes[0]?.legs ?? []) {
    for (const point of leg.points) {
      coordinates.push([point.longitude, point.latitude]);
    }
  }

  return { type: "LineString", coordinates };
}
