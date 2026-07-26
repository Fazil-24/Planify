import type { GeocodeSearchResult, PlanApiError, PlanResponse, RawTaskInput } from "./types";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

export class PlanApiRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: PlanApiError
  ) {
    super(message);
    this.name = "PlanApiRequestError";
  }
}

export async function requestPlan(input: RawTaskInput): Promise<PlanResponse> {
  const res = await fetch(`${BACKEND_URL}/plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => undefined)) as PlanApiError | undefined;
    throw new PlanApiRequestError(body?.error ?? `Request failed with status ${res.status}`, res.status, body);
  }

  return (await res.json()) as PlanResponse;
}

export async function searchPlaces(query: string): Promise<GeocodeSearchResult[]> {
  const res = await fetch(`${BACKEND_URL}/geocode-search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new PlanApiRequestError(`Place search failed with status ${res.status}`, res.status);
  const data = (await res.json()) as { results: GeocodeSearchResult[] };
  return data.results;
}
