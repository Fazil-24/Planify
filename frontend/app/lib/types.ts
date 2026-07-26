import type { LineString } from "geojson";

// Mirrors backend/src/types.ts exactly — the frontend and backend both
// depend on this contract staying in sync.

export interface RawTaskInput {
  freeText: string;
  startLocation: { lat: number; lng: number; label?: string };
  planStartTime?: string;
}

export interface ParsedTask {
  id: string;
  label: string;
  place_name: string;
  duration_min: number;
  time_window: { start: string; end: string } | null;
  flexibility: "fixed" | "flexible";
}

export interface ScoredTask extends ParsedTask {
  urgency_score: number;
  urgency_reason: string;
  location: { lat: number; lng: number };
}

export interface PlannedStop extends ScoredTask {
  order_index: number;
  arrival_time_estimate: string;
  travel_time_from_prev_min: number;
}

export interface PlanResponse {
  stops: PlannedStop[];
  route_geometry: LineString;
  total_duration_min: number;
  explanation: string;
  conflicts: string[];
  generated_at: string;
}

export interface GeocodeSearchResult {
  label: string;
  lat: number;
  lng: number;
}

export interface PlanApiError {
  error: string;
  failures?: Array<{ task_id: string; place_name: string; message: string }>;
  detail?: string;
}
