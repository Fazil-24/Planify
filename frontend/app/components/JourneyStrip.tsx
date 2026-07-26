"use client";

import { useRef } from "react";
import { LayoutGroup, motion } from "framer-motion";
import type { PlannedStop } from "../lib/types";
import StopCard from "./StopCard";

interface JourneyStripProps {
  stops: PlannedStop[];
  isFirstReveal: boolean;
  selectedStopId: string | null;
  onSelectStop: (id: string) => void;
  completedStopIds: Set<string>;
  onToggleComplete: (id: string) => void;
}

function Connector({ minutes }: { minutes: number }) {
  return (
    <div
      aria-hidden="true"
      className="flex h-8 w-full shrink-0 items-center justify-center gap-2 pl-3 text-ink/40"
    >
      <div className="h-full w-0 border-l-2 border-dashed border-clay/30" />
      <span className="text-[10px] whitespace-nowrap font-medium">{minutes}m</span>
    </div>
  );
}

export default function JourneyStrip({
  stops,
  isFirstReveal,
  selectedStopId,
  onSelectStop,
  completedStopIds,
  onToggleComplete,
}: JourneyStripProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!scrollRef.current) return;
    if (e.key === "ArrowDown") {
      scrollRef.current.scrollBy({ top: 160, behavior: "smooth" });
    } else if (e.key === "ArrowUp") {
      scrollRef.current.scrollBy({ top: -160, behavior: "smooth" });
    }
  }

  const completedCount = stops.filter((s) => completedStopIds.has(s.id)).length;

  return (
    <section aria-label="Journey timeline" className="flex flex-col gap-2">
      {stops.length > 0 && (
        <div className="flex items-center justify-between text-xs text-ink/50">
          <span>
            {completedCount} of {stops.length} done
          </span>
          <div className="h-1.5 w-24 rounded-full bg-sand/40 overflow-hidden">
            <motion.div
              className="h-full bg-moss"
              initial={false}
              animate={{ width: `${stops.length ? (completedCount / stops.length) * 100 : 0}%` }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            />
          </div>
        </div>
      )}
      <LayoutGroup>
        <motion.div
          layout
          ref={scrollRef}
          onKeyDown={handleKeyDown}
          className="journey-strip flex flex-col gap-0 overflow-y-auto max-h-[32rem] pr-2 snap-y snap-mandatory"
          role="list"
          tabIndex={0}
          aria-label="Scrollable list of stops, use up and down arrow keys to scroll"
        >
          {stops.map((stop, i) => (
            <div key={stop.id} className="flex flex-col">
              {i > 0 && <Connector minutes={stop.travel_time_from_prev_min} />}
              <StopCard
                stop={stop}
                index={i}
                isFirstReveal={isFirstReveal}
                isSelected={selectedStopId === stop.id}
                onSelect={onSelectStop}
                isCompleted={completedStopIds.has(stop.id)}
                onToggleComplete={onToggleComplete}
              />
            </div>
          ))}
        </motion.div>
      </LayoutGroup>
    </section>
  );
}
