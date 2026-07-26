import { withRetry } from "../utils/retry";
import { geocodeCache } from "../utils/cache";

const GEOAPIFY_BASE_URL = "https://api.geoapify.com/v1/geocode";

export class GeocodeFailedError extends Error {
  constructor(public readonly placeName: string) {
    super(`Couldn't find "${placeName}" — try a more specific name or address.`);
    this.name = "GeocodeFailedError";
  }
}

interface GeoapifyFeature {
  properties: { lat: number; lon: number; formatted?: string };
}
interface GeoapifyResponse {
  features: GeoapifyFeature[];
}

/**
 * Geocodes a single place name to lat/lng, biased toward a reference point
 * (the user's start location). Without a proximity bias, Geoapify resolves
 * ambiguous place names (e.g. a generic clinic/store chain name) against
 * its global index, which can return a same-named place on another
 * continent — silently breaking the matrix/routing calls downstream.
 * Cached per place+bias since geocode results rarely change.
 */
export async function geocodePlace(
  placeName: string,
  biasLocation?: { lat: number; lng: number }
): Promise<{ lat: number; lng: number }> {
  const cacheKey = biasLocation
    ? `${placeName.toLowerCase().trim()}@${biasLocation.lat.toFixed(2)},${biasLocation.lng.toFixed(2)}`
    : placeName.toLowerCase().trim();

  return geocodeCache.getOrCompute(cacheKey, async () => {
    const apiKey = process.env.GEOAPIFY_API_KEY;
    if (!apiKey) throw new Error("GEOAPIFY_API_KEY is not set");

    const params = new URLSearchParams({ text: placeName, limit: "1", apiKey });
    if (biasLocation) {
      // Bias ranks nearby results higher; the filter hard-excludes anything
      // more than ~75km away so a same-named place on another continent
      // (a real failure mode of unbiased free-text geocoding) is rejected
      // outright rather than silently accepted as a wrong match.
      params.set("bias", `proximity:${biasLocation.lng},${biasLocation.lat}`);
      params.set("filter", `circle:${biasLocation.lng},${biasLocation.lat},75000`);
    }
    const url = `${GEOAPIFY_BASE_URL}/search?${params.toString()}`;

    const data = await withRetry(
      async () => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Geoapify error ${res.status}`);
        return (await res.json()) as GeoapifyResponse;
      },
      { label: `geocode:${placeName}` }
    );

    const feature = data.features?.[0];
    if (!feature) throw new GeocodeFailedError(placeName);

    return { lat: feature.properties.lat, lng: feature.properties.lon };
  });
}

/** Autocomplete search, used by the /geocode-search backend proxy so the API key stays server-side. */
export async function searchPlaces(
  query: string,
  biasLocation?: { lat: number; lng: number }
): Promise<Array<{ label: string; lat: number; lng: number }>> {
  const apiKey = process.env.GEOAPIFY_API_KEY;
  if (!apiKey) throw new Error("GEOAPIFY_API_KEY is not set");

  const params = new URLSearchParams({ text: query, limit: "5", apiKey });
  if (biasLocation) {
    params.set("bias", `proximity:${biasLocation.lng},${biasLocation.lat}`);
  }
  const url = `${GEOAPIFY_BASE_URL}/autocomplete?${params.toString()}`;
  // Note: no hard filter here (unlike geocodePlace) — this backs the start-location
  // search box, which should let a user search anywhere, not just near a bias point.

  const data = await withRetry(
    async () => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Geoapify error ${res.status}`);
      return (await res.json()) as GeoapifyResponse;
    },
    { label: `geocode-search:${query}` }
  );

  return (data.features ?? []).map((f) => ({
    label: f.properties.formatted ?? query,
    lat: f.properties.lat,
    lng: f.properties.lon,
  }));
}
