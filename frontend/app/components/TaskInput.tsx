"use client";

import { useState } from "react";
import { motion } from "framer-motion";

interface TaskInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}

const EXAMPLE =
  "pick up dry cleaning at Clean Express Marina, dentist at Aster Clinic JLT around 4pm, grab groceries at Spinneys Al Wasl before dinner";

export default function TaskInput({ value, onChange, onSubmit, isSubmitting }: TaskInputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="flex flex-col gap-2"
    >
      <label htmlFor="task-input" className="text-sm font-medium text-ink/80 dark:text-paper/80">
        What&apos;s on your plate today?
      </label>
      <textarea
        id="task-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={`Try: "${EXAMPLE}"`}
        rows={4}
        className="w-full rounded-xl border border-sand bg-glass/70 px-4 py-3 text-base leading-relaxed text-ink placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-clay focus:shadow-glow transition-shadow resize-none"
      />
      {!value && !focused && (
        <p className="text-xs text-ink/50 dark:text-paper/50">
          Include where each task is — a specific place name helps us plan the route.
        </p>
      )}
      <motion.button
        type="submit"
        disabled={isSubmitting || !value.trim()}
        whileTap={{ scale: 0.96 }}
        whileHover={{ scale: 1.02 }}
        className="self-start rounded-lg bg-gradient-to-r from-clay to-clayDark hover:shadow-glow disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none text-white font-medium px-5 py-2.5 transition-shadow"
      >
        {isSubmitting ? "Planning your day…" : "Plan my day"}
      </motion.button>
    </form>
  );
}
