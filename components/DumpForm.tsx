"use client";

import { useEffect, useRef } from "react";

type Props = {
  value: string;
  onChange: (next: string) => void;
  onSubmit: () => void;
  loading: boolean;
  error: string | null;
};

export function DumpForm({ value, onChange, onSubmit, loading, error }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const canSubmit = value.trim().length > 0 && !loading;

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-6">
        <h1 className="font-serif text-2xl font-semibold tracking-tight text-warm-fg">
          What's on your mind?
        </h1>
        <p className="mt-1 text-sm text-warm-muted">
          Group items under P1 / P2 / P3 / P4. I'll route them.
        </p>
      </header>

      {error && (
        <div className="mb-4 rounded-warm border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && canSubmit) {
            e.preventDefault();
            onSubmit();
          }
        }}
        disabled={loading}
        rows={12}
        placeholder={"P1\nneed to submit notion event proposal by may 7th\nP2\n..."}
        className="w-full rounded-warm border border-warm-border bg-warm-surface px-5 py-4 font-mono text-[15px] leading-7 text-warm-fg shadow-warm placeholder:text-warm-muted focus:border-warm-sage focus:outline-none focus:ring-1 focus:ring-warm-sage disabled:opacity-60"
      />

      <div className="mt-4 flex items-center justify-between">
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
