import { useState } from 'react';

export function Counter() {
  const [count, setCount] = useState(0);

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => setCount((c) => c + 1)}
        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
      >
        Increment
      </button>
      <p aria-live="polite" className="text-muted">
        Count: <span className="font-medium text-ink">{count}</span>
      </p>
    </div>
  );
}
