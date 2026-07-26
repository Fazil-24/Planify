interface ErrorStateProps {
  message: string;
  details?: string[];
  onRetry?: () => void;
}

export default function ErrorState({ message, details, onRetry }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-2xl border border-clay/40 glass-card px-5 py-4 shadow-glow"
    >
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="text-clay text-lg leading-none mt-0.5">
          ⚠
        </span>
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-ink dark:text-paper">{message}</p>
          {details && details.length > 0 && (
            <ul className="text-xs text-ink/70 dark:text-paper/70 list-disc list-inside">
              {details.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="self-start rounded-lg border border-clay text-clay px-4 py-1.5 text-sm font-medium hover:bg-clay hover:text-white transition-colors"
        >
          Try again
        </button>
      )}
    </div>
  );
}
