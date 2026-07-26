"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { PlannedStop } from "../lib/types";

interface StopDetailPanelProps {
  stop: PlannedStop | null;
  onClose: () => void;
  isCompleted: boolean;
  onToggleComplete: (id: string) => void;
}

const URGENCY_LABEL = (score: number) => {
  if (score >= 80) return "High priority";
  if (score >= 50) return "Moderate";
  return "Flexible";
};

export default function StopDetailPanel({ stop, onClose, isCompleted, onToggleComplete }: StopDetailPanelProps) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!stop) return;
    closeButtonRef.current?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [stop, onClose]);

  return (
    <AnimatePresence>
      {stop && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            aria-hidden="true"
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[3px]"
          />
          <motion.div
            key="panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="stop-detail-heading"
            initial={{ opacity: 0, y: 40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.93 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="fixed z-50 inset-x-4 bottom-4 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-96 rounded-2xl border border-clay/30 bg-nightElevated shadow-elevated shadow-glow p-5 flex flex-col gap-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                    isCompleted ? "bg-moss text-night shadow-glowCyan" : "bg-gradient-to-br from-clay to-clayDark text-white shadow-glow"
                  }`}
                >
                  {isCompleted ? "✓" : stop.order_index + 1}
                </span>
                <h2
                  id="stop-detail-heading"
                  className={`font-display text-xl text-ink leading-tight ${isCompleted ? "line-through" : ""}`}
                >
                  {stop.label}
                </h2>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={onClose}
                aria-label="Close stop details"
                className="shrink-0 flex h-8 w-8 items-center justify-center rounded-full text-ink/50 hover:bg-clay/15 hover:text-ink transition-colors focus:outline-none focus:ring-2 focus:ring-clay"
              >
                <span aria-hidden="true">&times;</span>
              </button>
            </div>

            <p className="text-sm text-ink/70">{stop.place_name}</p>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-black/25 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-moss">Arrival</p>
                <p className="font-medium text-ink">{stop.arrival_time_estimate}</p>
              </div>
              <div className="rounded-lg bg-black/25 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-moss">Duration</p>
                <p className="font-medium text-ink">{stop.duration_min} min</p>
              </div>
              <div className="rounded-lg bg-black/25 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-moss">Travel from prev</p>
                <p className="font-medium text-ink">+{stop.travel_time_from_prev_min} min</p>
              </div>
              <div className="rounded-lg bg-black/25 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-moss">Priority</p>
                <p className="font-medium text-ink">{URGENCY_LABEL(stop.urgency_score)}</p>
              </div>
            </div>

            {stop.time_window && (
              <div className="rounded-lg bg-clay/10 border border-clay/20 px-3 py-2 text-sm text-clay">
                Time window: {stop.time_window.start}–{stop.time_window.end}
              </div>
            )}

            <p className="text-sm leading-relaxed text-ink/80">{stop.urgency_reason}</p>

            <button
              type="button"
              onClick={() => onToggleComplete(stop.id)}
              aria-pressed={isCompleted}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-clay ${
                isCompleted
                  ? "bg-moss/15 text-moss hover:bg-moss/25"
                  : "bg-gradient-to-r from-clay to-clayDark text-white hover:shadow-glow"
              }`}
            >
              {isCompleted ? "✓ Marked done — undo?" : "Mark as done"}
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
