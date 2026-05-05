"use client";

import { useEffect, useRef } from "react";

export type PLevels = { p1: string; p2: string; p3: string; p4: string };

export const EMPTY_LEVELS: PLevels = { p1: "", p2: "", p3: "", p4: "" };

export function serializeLevels(levels: PLevels): string {
  const parts: string[] = [];
  for (const [key, label] of [
    ["p1", "P1"],
    ["p2", "P2"],
    ["p3", "P3"],
    ["p4", "P4"],
  ] as const) {
    const content = levels[key].trim();
    if (content.length > 0) parts.push(label, content);
  }
  return parts.join("\n");
}

type Props = {
  levels: PLevels;
  onChange: (next: PLevels) => void;
  onSubmit: () => void;
  loading: boolean;
  error: string | null;
};

const SECTIONS: Array<{
  key: keyof PLevels;
  tag: string;
  label: string;
  placeholder: string;
}> = [
  { key: "p1", tag: "P1", label: "Critical", placeholder: "submit notion event proposal by may 7th" },
  { key: "p2", tag: "P2", label: "Important", placeholder: "install mom's wipers friday" },
  { key: "p3", tag: "P3", label: "Normal", placeholder: "buy protein powder saturday" },
  { key: "p4", tag: "P4", label: "Low", placeholder: "find new gym shoes next month" },
];

export function DumpForm({ levels, onChange, onSubmit, loading, error }: Props) {
  const firstRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    firstRef.current?.focus();
  }, []);

  const canSubmit =
    !loading && Object.values(levels).some((v) => v.trim().length > 0);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && canSubmit) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-6">
        <h1 className="font-serif text-2xl font-semibold tracking-tight text-warm-fg">
          What&apos;s on your mind?
        </h1>
        <p className="mt-1 text-sm text-warm-muted">
          Drop items by priority. One per line. Empty levels are skipped.
        </p>
      </header>

      {error && (
        <div className="mb-4 rounded-warm border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-5">
        {SECTIONS.map((section, idx) => (
          <div key={section.key}>
            <div className="mb-1.5 flex items-baseline gap-2">
              <span className="rounded bg-warm-chip px-2 py-0.5 font-mono text-xs font-semibold text-warm-sage">
                {section.tag}
              </span>
              <span className="text-sm text-warm-muted">{section.label}</span>
            </div>
            <textarea
              ref={idx === 0 ? firstRef : undefined}
              value={levels[section.key]}
              onChange={(e) => onChange({ ...levels, [section.key]: e.target.value })}
              onKeyDown={handleKeyDown}
              disabled={loading}
              rows={3}
              placeholder={section.placeholder}
              className="w-full rounded-warm border border-warm-border bg-warm-surface px-4 py-3 font-mono text-[14px] leading-6 text-warm-fg shadow-warm placeholder:text-warm-muted focus:border-warm-sage focus:outline-none focus:ring-1 focus:ring-warm-sage disabled:opacity-60"
            />
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <span className="text-xs text-warm-muted">
          {canSubmit ? "⌘ ↵ to process" : " "}
        </span>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          className="rounded-md bg-warm-sage px-5 py-2 text-sm font-medium text-white shadow-warm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Processing…" : "Process"}
        </button>
      </div>
    </div>
  );
}
