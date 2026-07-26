"use client";

import { useEffect, useRef, useState } from "react";
import { searchPlaces } from "../lib/api";
import type { GeocodeSearchResult } from "../lib/types";

export interface StartLocation {
  lat: number;
  lng: number;
  label?: string;
}

interface LocationInputProps {
  value: StartLocation | null;
  onChange: (location: StartLocation) => void;
}

type GeoStatus = "idle" | "locating" | "granted" | "denied" | "unsupported";

export default function LocationInput({ value, onChange }: LocationInputProps) {
  const [geoStatus, setGeoStatus] = useState<GeoStatus>("idle");
  const [query, setQuery] = useState(value?.label ?? "");
  const [suggestions, setSuggestions] = useState<GeocodeSearchResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function detectLocation() {
    if (!("geolocation" in navigator)) {
      setGeoStatus("unsupported");
      return;
    }
    setGeoStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeoStatus("granted");
        const loc = { lat: position.coords.latitude, lng: position.coords.longitude, label: "Current location" };
        setQuery(loc.label);
        onChange(loc);
      },
      () => setGeoStatus("denied"),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 3 || query === value?.label) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        setSearchError(null);
        const results = await searchPlaces(query);
        setSuggestions(results);
      } catch {
        setSearchError("Couldn't search for places right now.");
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="start-location" className="text-sm font-medium text-ink/80 dark:text-paper/80">
        Starting from
      </label>
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <input
            id="start-location"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search an address or place…"
            className="w-full rounded-lg border border-sand bg-glass/70 px-3 py-2 text-sm text-ink placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-clay focus:shadow-glow transition-shadow"
            aria-autocomplete="list"
            aria-expanded={suggestions.length > 0}
          />
          {suggestions.length > 0 && (
            <ul
              role="listbox"
              className="absolute z-10 mt-1 w-full rounded-lg border border-sand bg-nightElevated shadow-card overflow-hidden"
            >
              {suggestions.map((s, i) => (
                <li key={`${s.label}-${i}`}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    className="w-full text-left px-3 py-2 text-sm text-ink hover:bg-clay/15 transition-colors"
                    onClick={() => {
                      setQuery(s.label);
                      setSuggestions([]);
                      onChange({ lat: s.lat, lng: s.lng, label: s.label });
                    }}
                  >
                    {s.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          type="button"
          onClick={detectLocation}
          className="whitespace-nowrap rounded-lg border border-clay text-clay px-3 py-2 text-sm font-medium hover:bg-clay hover:text-white hover:shadow-glow transition-all"
        >
          {geoStatus === "locating" ? "Locating…" : "Use my location"}
        </button>
      </div>
      {geoStatus === "denied" && (
        <p className="text-xs text-clayDark" role="status">
          Location access was denied — search for your starting address above instead.
        </p>
      )}
      {geoStatus === "unsupported" && (
        <p className="text-xs text-clayDark" role="status">
          Geolocation isn&apos;t available in this browser — search for your starting address above.
        </p>
      )}
      {searchError && (
        <p className="text-xs text-clayDark" role="status">
          {searchError}
        </p>
      )}
    </div>
  );
}
