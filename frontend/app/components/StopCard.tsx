"use client";

import { motion } from "framer-motion";
import type { PlannedStop } from "../lib/types";

interface StopCardProps {
  stop: PlannedStop;
  index: number;
  isFirstReveal: boolean;
  isSelected: boolean;
  onSelect: (id: string) => void;
  isCompleted: boolean;
  onToggleComplete: (id: string) => void;
}

const URGENCY_LABEL = (score: number) => {
  if (score >= 80) return "High priority";
  if (score >= 50) return "Moderate";
  return "Flexible";
};

export default function StopCard({
  stop,
  index,
  isFirstReveal,
  isSelected,
  onSelect,
  isCompleted,
  onToggleComplete,
}: StopCardProps) {
  return (
    <motion.article
      layout
      layoutId={stop.id}
      initial={isFirstReveal ? { opacity: 0, y: 24 } : false}
      animate={{ opacity: isCompleted ? 0.55 : 1, y: 0 }}
      transition={
        isFirstReveal
          ? { delay: index * 0.09, duration: 0.4, ease: "easeOut" }
          : { type: "spring", stiffness: 350, damping: 32 }
      }
      whileHover={{ y: -6, rotate: -1 }}
      whileTap={{ scale: 0.96, rotate: 0 }}
      onClick={() => onSelect(stop.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(stop.id);
        }
      }}
      role="button"
      aria-pressed={isSelected}
      tabIndex={0}
      aria-label={`Stop ${index + 1}: ${stop.label} at ${stop.place_name}, arriving ${stop.arrival_time_estimate}${
        isCompleted ? ", completed" : ""
      }. Press enter for details.`}
      className={`w-full shrink-0 cursor-pointer rounded-2xl border glass-card px-4 py-3 flex flex-col gap-2 snap-start focus:outline-none focus:ring-2 focus:ring-clay transition-shadow ${
        isSelected ? "border-clay shadow-glow" : "border-sand shadow-soft"
      }`}
    >
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleComplete(stop.id);
          }}
          aria-pressed={isCompleted}
          aria-label={isCompleted ? `Mark stop ${index + 1} as not done` : `Mark stop ${index + 1} as done`}
          className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-clay ${
            isCompleted
              ? "bg-moss text-night shadow-glowCyan"
              : "bg-gradient-to-br from-clay to-clayDark text-white shadow-glow"
          }`}
        >
          {isCompleted ? "✓" : index + 1}
        </button>
        <span
          className={`text-[10px] uppercase tracking-wide font-medium rounded-full px-2 py-0.5 ${
            stop.flexibility === "fixed" ? "bg-clay/15 text-clay" : "bg-moss/15 text-moss"
          }`}
        >
          {URGENCY_LABEL(stop.urgency_score)}
        </span>
      </div>
      <h3 className={`font-display text-base leading-tight text-ink ${isCompleted ? "line-through" : ""}`}>
        {stop.label}
      </h3>
      <p className="text-xs text-ink/60 truncate" title={stop.place_name}>
        {stop.place_name}
      </p>
      <div className="mt-auto flex items-center justify-between text-xs text-ink/70">
        <span>{stop.arrival_time_estimate}</span>
        <span>+{stop.travel_time_from_prev_min} min travel</span>
      </div>
    </motion.article>
  );
}
