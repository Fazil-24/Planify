"use client";

import { useEffect, useState } from "react";

const MESSAGES = [
  "Zooming through backstreets…",
  "Bribing traffic lights to turn green…",
  "Consulting the urgency oracle…",
  "Untangling your to-do spaghetti…",
  "Racing the algorithm around the block…",
];

export default function LoadingSkeleton() {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((i) => (i + 1) % MESSAGES.length);
    }, 1600);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-live="polite">
      <div className="relative h-20 rounded-2xl glass-card overflow-hidden">
        <svg viewBox="0 0 360 80" className="absolute inset-0 h-full w-full" aria-hidden="true">
          <path
            d="M2,40 C 60,4 120,76 180,40 S 300,4 358,40"
            fill="none"
            stroke="#22d3ee"
            strokeOpacity="0.35"
            strokeWidth="3"
            strokeDasharray="6 8"
            strokeLinecap="round"
          />
        </svg>
        <div className="drive-car absolute text-2xl -translate-x-1/2 -translate-y-1/2" style={{ top: 0, left: 0 }}>
          🚗
        </div>
      </div>
      <p className="text-sm text-clay font-medium neon-text">{MESSAGES[messageIndex]}</p>
      <div className="flex gap-4 overflow-x-hidden pb-2">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{ animationDelay: `${i * 120}ms` }}
            className="skeleton-shimmer animate-shimmer shrink-0 w-56 h-32 rounded-2xl glass-card"
          />
        ))}
      </div>
      <div className="skeleton-shimmer animate-shimmer w-full h-72 sm:h-96 rounded-2xl glass-card" />
      <div className="flex flex-col gap-2">
        <div className="skeleton-shimmer animate-shimmer h-4 w-3/4 rounded" />
        <div className="skeleton-shimmer animate-shimmer h-4 w-1/2 rounded" />
      </div>
    </div>
  );
}
