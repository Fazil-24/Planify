"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import TaskInput from "./components/TaskInput";
import LocationInput, { type StartLocation } from "./components/LocationInput";
import JourneyStrip from "./components/JourneyStrip";
import LoadingSkeleton from "./components/LoadingSkeleton";
import ErrorState from "./components/ErrorState";
import EmptyState from "./components/EmptyState";
import ExplanationPanel from "./components/ExplanationPanel";
import StopDetailPanel from "./components/StopDetailPanel";
import ConfettiBurst from "./components/ConfettiBurst";
import { requestPlan, PlanApiRequestError } from "./lib/api";
import type { PlanResponse } from "./lib/types";

// Map pulls in maplibre-gl, which is browser-only and non-trivial in size — lazy-load it.
const MapView = dynamic(() => import("./components/MapView"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-72 sm:h-96 rounded-2xl skeleton-shimmer dark:skeleton-shimmer-dark animate-shimmer" />
  ),
});

function estimateExpectedTaskCount(freeText: string): number {
  const segments = freeText
    .split(/,| and then | then |;/i)
    .map((s) => s.trim())
    .filter(Boolean);
  return segments.length;
}

export default function Home() {
  const [freeText, setFreeText] = useState("");
  const [startLocation, setStartLocation] = useState<StartLocation | null>(null);
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string[] | undefined>(undefined);
  const [hasPlannedOnce, setHasPlannedOnce] = useState(false);
  const [isFirstReveal, setIsFirstReveal] = useState(true);
  const [missingPlaceWarning, setMissingPlaceWarning] = useState<string | null>(null);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [celebrateKey, setCelebrateKey] = useState<string | null>(null);
  const [completedStopIds, setCompletedStopIds] = useState<Set<string>>(new Set());

  function toggleComplete(id: string) {
    setCompletedStopIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handlePlan() {
    if (!freeText.trim()) return;

    if (!startLocation) {
      setErrorMessage("Add a starting location first — auto-detect it or search for an address above.");
      setErrorDetails(undefined);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setErrorDetails(undefined);
    setMissingPlaceWarning(null);
    setIsFirstReveal(!hasPlannedOnce);
    setSelectedStopId(null);
    setCompletedStopIds(new Set());

    try {
      const response = await requestPlan({
        freeText,
        startLocation: { lat: startLocation.lat, lng: startLocation.lng, label: startLocation.label },
      });
      setPlan(response);
      if (!hasPlannedOnce) setCelebrateKey(response.generated_at);
      setHasPlannedOnce(true);

      const expected = estimateExpectedTaskCount(freeText);
      if (response.stops.length < expected) {
        setMissingPlaceWarning(
          `We planned ${response.stops.length} of what looks like ${expected} tasks — anything without a clear place name gets skipped. Add a specific place and try again to include it.`
        );
      }
    } catch (err) {
      if (err instanceof PlanApiRequestError) {
        setErrorMessage(err.body?.error ?? err.message);
        setErrorDetails(err.body?.failures?.map((f) => `"${f.place_name}" (${f.task_id}): ${f.message}`));
      } else {
        setErrorMessage("Something went wrong generating your plan. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:py-12 flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="font-display font-bold text-3xl sm:text-4xl text-ink neon-text tracking-tight">PlanIFY</h1>
        <p className="text-sm text-ink/60">Plan Intelligently For You</p>
      </header>

      <section aria-label="Plan input" className="flex flex-col gap-5 rounded-2xl glass-card p-5 shadow-card">
        <LocationInput value={startLocation} onChange={setStartLocation} />
        <TaskInput value={freeText} onChange={setFreeText} onSubmit={handlePlan} isSubmitting={isLoading} />
      </section>

      {errorMessage && (
        <ErrorState message={errorMessage} details={errorDetails} onRetry={handlePlan} />
      )}

      {missingPlaceWarning && (
        <div role="status" className="text-sm text-clayDark bg-clay/10 rounded-xl px-4 py-3">
          {missingPlaceWarning}
        </div>
      )}

      {isLoading && <LoadingSkeleton />}

      {!isLoading && !plan && !errorMessage && <EmptyState />}

      {!isLoading && plan && (
        <div className="flex flex-col lg:flex-row gap-6 lg:items-start">
          <div className="flex flex-col gap-6 order-2 lg:order-1 lg:flex-1 lg:min-w-0">
            <MapView
              startLocation={{ lat: startLocation!.lat, lng: startLocation!.lng }}
              stops={plan.stops}
              routeGeometry={plan.route_geometry}
              revealKey={plan.generated_at}
              selectedStopId={selectedStopId}
              onSelectStop={(id) => setSelectedStopId((current) => (current === id ? null : id))}
            />
            <ExplanationPanel
              explanation={plan.explanation}
              conflicts={plan.conflicts}
              totalDurationMin={plan.total_duration_min}
            />
          </div>
          <div className="order-1 lg:order-2 lg:w-80 lg:shrink-0">
            <JourneyStrip
              stops={plan.stops}
              isFirstReveal={isFirstReveal}
              selectedStopId={selectedStopId}
              onSelectStop={(id) => setSelectedStopId((current) => (current === id ? null : id))}
              completedStopIds={completedStopIds}
              onToggleComplete={toggleComplete}
            />
          </div>
        </div>
      )}

      <StopDetailPanel
        stop={plan?.stops.find((s) => s.id === selectedStopId) ?? null}
        onClose={() => setSelectedStopId(null)}
        isCompleted={selectedStopId ? completedStopIds.has(selectedStopId) : false}
        onToggleComplete={toggleComplete}
      />
      <ConfettiBurst triggerKey={celebrateKey} />
    </main>
  );
}
