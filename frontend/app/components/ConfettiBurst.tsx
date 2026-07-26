"use client";

import { useEffect, useState } from "react";

interface ConfettiBurstProps {
  /** Bump this to a new value (e.g. a timestamp) each time a burst should fire. */
  triggerKey: string | null;
}

const COLORS = ["#ff3d81", "#22d3ee", "#ffd23d", "#a78bfa", "#4ade80"];
const PIECE_COUNT = 28;

interface Piece {
  id: number;
  left: number;
  color: string;
  driftX: number;
  driftY: number;
  spin: number;
  delay: number;
  duration: number;
  size: number;
}

function makePieces(): Piece[] {
  return Array.from({ length: PIECE_COUNT }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    color: COLORS[i % COLORS.length],
    driftX: (Math.random() - 0.5) * 240,
    driftY: 260 + Math.random() * 160,
    spin: (Math.random() - 0.5) * 720,
    delay: Math.random() * 0.15,
    duration: 1.1 + Math.random() * 0.6,
    size: 6 + Math.random() * 6,
  }));
}

export default function ConfettiBurst({ triggerKey }: ConfettiBurstProps) {
  const [pieces, setPieces] = useState<Piece[] | null>(null);

  useEffect(() => {
    if (!triggerKey) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    setPieces(makePieces());
    const timeout = setTimeout(() => setPieces(null), 2000);
    return () => clearTimeout(timeout);
  }, [triggerKey]);

  if (!pieces) return null;

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      {pieces.map((p) => (
        <span
          key={p.id}
          style={
            {
              position: "absolute",
              top: "-5%",
              left: `${p.left}%`,
              width: p.size,
              height: p.size * 0.4,
              backgroundColor: p.color,
              borderRadius: 2,
              animation: `confetti-fall ${p.duration}s ease-in ${p.delay}s forwards`,
              "--drift-x": `${p.driftX}px`,
              "--drift-y": `${p.driftY}px`,
              "--spin": `${p.spin}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
