export default function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-4 rounded-2xl border border-dashed border-sand glass-card py-16 px-6">
      <svg width="160" height="90" viewBox="0 0 160 90" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="empty-route-gradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#ff3d81" />
          </linearGradient>
        </defs>
        <path
          d="M8 70C28 70 30 40 50 40C70 40 68 20 90 20C112 20 112 55 135 55C148 55 150 45 152 38"
          stroke="url(#empty-route-gradient)"
          strokeWidth="2.5"
          strokeDasharray="1 8"
          strokeLinecap="round"
          opacity="0.8"
        />
        <circle cx="8" cy="70" r="4" fill="#22d3ee" />
        <circle cx="90" cy="20" r="4" fill="#22d3ee" opacity="0.7" />
        <g transform="translate(140, 26)">
          <path
            d="M12 0C5.5 0 0 5.4 0 12c0 9 12 22 12 22s12-13 12-22c0-6.6-5.5-12-12-12z"
            fill="#ff3d81"
          />
          <circle cx="12" cy="12" r="4.5" className="fill-night" />
        </g>
      </svg>
      <h2 className="font-display text-xl text-ink">No plan yet</h2>
      <p className="max-w-sm text-sm text-ink/60">
        Tell us what&apos;s on your to-do list and where each thing is — we&apos;ll figure out the smartest order to
        get it all done.
      </p>
    </div>
  );
}
