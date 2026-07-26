"use client";

import { motion } from "framer-motion";

interface ExplanationPanelProps {
  explanation: string;
  conflicts: string[];
  totalDurationMin: number;
}

export default function ExplanationPanel({ explanation, conflicts, totalDurationMin }: ExplanationPanelProps) {
  const hours = Math.floor(totalDurationMin / 60);
  const minutes = totalDurationMin % 60;
  const durationLabel = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.4, ease: "easeOut" }}
      aria-label="Plan explanation"
      className="rounded-2xl glass-card shadow-card px-5 py-4 flex flex-col gap-3"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg text-ink">Why this order</h2>
        <span className="text-xs text-moss font-medium">Total: {durationLabel}</span>
      </div>
      <p className="text-sm leading-relaxed text-ink/80">{explanation}</p>
      {conflicts.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-lg bg-clay/10 border border-clay/20 px-3 py-2.5">
          <p className="text-xs font-semibold text-clay uppercase tracking-wide">Heads up</p>
          <ul className="text-xs text-ink/80 list-disc list-inside">
            {conflicts.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}
    </motion.section>
  );
}
