"use client";

import type { WriteFailure } from "@/lib/types";

type Props = {
  failures: WriteFailure[];
  onRetry: (fromIndex: number) => void;
  onDiscard: () => void;
};

export function PartialFailureCallout({ failures, onRetry, onDiscard }: Props) {
  if (failures.length === 0) return null;
  const first = failures[0];

  return (
    <div className="mt-4 rounded-warm border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
      <div className="font-medium">
        Item {first.index + 1} failed: {first.item.title}
      </div>
      <div className="mt-1 font-mono text-xs text-red-700">
        {first.error}
      </div>
      <div className="mt-3 flex gap-3">
        <button
          type="button"
          onClick={() => onRetry(first.index)}
          className="rounded-md bg-red-700 px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90"
        >
          Retry from #{first.index + 1}
        </button>
        <button
          type="button"
          onClick={onDiscard}
          className="rounded-md border border-red-300 bg-transparent px-3 py-1.5 text-xs text-red-700 transition hover:bg-red-100"
        >
          Discard remaining
        </button>
      </div>
    </div>
  );
}
