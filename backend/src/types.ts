import type { LineString } from "geojson";

export interface RawTaskInput {
  freeText: string;
  startLocation: { lat: number; lng: number; label?: string };
  /** "HH:MM" 24hr; if omitted, backend defaults to current server time */
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

/** Raised when a specific downstream step fails for an identifiable reason (e.g. one place fails to geocode). */
export class PlanPipelineError extends Error {
  constructor(
    message: string,
    public readonly stage: "parse" | "geocode" | "matrix" | "score" | "optimize" | "explain",
    public readonly detail?: Record<string, unknown>
  ) {
    super(message);
    this.name = "PlanPipelineError";
  }
}
