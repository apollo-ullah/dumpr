"use client";

import { useEffect, useRef, type ChangeEvent, type ClipboardEvent, type KeyboardEvent } from "react";
import { DOMAIN_VALUES } from "@/lib/types";

export type PLevels = { p1: string; p2: string; p3: string; p4: string };

export const EMPTY_LEVELS: PLevels = { p1: "", p2: "", p3: "", p4: "" };

const BULLET = "- ";

const STRIP_BULLET = /^\s*[-*•]\s+/;

export function serializeLevels(levels: PLevels): string {
  const parts: string[] = [];
  for (const [key, label] of [
    ["p1", "P1"],
    ["p2", "P2"],
    ["p3", "P3"],
    ["p4", "P4"],
  ] as const) {
    const lines = levels[key]
      .split("\n")
      .map((l) => l.replace(STRIP_BULLET, "").trim())
      .filter((l) => l.length > 0);
    if (lines.length > 0) parts.push(label, ...lines);
  }
  return parts.join("\n");
}

function applyBulletRules(
  prev: string,
  next: string,
  cursor: number
): { value: string; cursor: number } {
  // Empty → first character that isn't already a bullet: prefix with "- "
  if (prev === "" && next.length > 0 && !next.startsWith(BULLET)) {
    return { value: BULLET + next, cursor: cursor + BULLET.length };
  }

  // User just pressed Enter (added a newline at cursor - 1)
  if (cursor > 0 && next[cursor - 1] === "\n") {
    const beforeNewline = next.slice(0, cursor - 1);
    const prevLineStart = beforeNewline.lastIndexOf("\n") + 1;
    const prevLine = next.slice(prevLineStart, cursor - 1);

    // Empty bullet on its own → exit list mode (remove the line + newline)
    if (prevLine === "- ") {
      const value = next.slice(0, prevLineStart) + next.slice(cursor);
      return { value, cursor: prevLineStart };
    }

    // Previous line was a bullet → start a new one
    if (prevLine.startsWith(BULLET)) {
      const value = next.slice(0, cursor) + BULLET + next.slice(cursor);
      return { value, cursor: cursor + BULLET.length };
    }
  }

  return { value: next, cursor };
}

function formatPasteAsBullets(pasted: string): string {
  return pasted
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((l) => (l.match(STRIP_BULLET) ? l : BULLET + l))
    .join("\n");
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
  { key: "p1", tag: "P1", label: "Critical", placeholder: "- submit notion event proposal by may 7th" },
  { key: "p2", tag: "P2", label: "Important", placeholder: "- install mom's wipers friday" },
  { key: "p3", tag: "P3", label: "Normal", placeholder: "- buy protein powder saturday" },
  { key: "p4", tag: "P4", label: "Low", placeholder: "- find new gym shoes next month" },
];

const DATE_HINTS = ["by may 7", "friday", "this week", "tomorrow", "next month", "eventually"];
const VERB_HINTS = ["submit", "install", "buy", "draft", "build", "ship", "review"];

export function DumpForm({ levels, onChange, onSubmit, loading, error }: Props) {
  const refs = useRef<Record<keyof PLevels, HTMLTextAreaElement | null>>({
    p1: null,
    p2: null,
    p3: null,
    p4: null,
  });
  const pendingCursor = useRef<{ key: keyof PLevels; pos: number } | null>(null);

  useEffect(() => {
    refs.current.p1?.focus();
  }, []);

  useEffect(() => {
    const pending = pendingCursor.current;
    if (!pending) return;
    const el = refs.current[pending.key];
    if (el) {
      el.selectionStart = el.selectionEnd = pending.pos;
    }
    pendingCursor.current = null;
  });

  const canSubmit = !loading && Object.values(levels).some((v) => v.trim().length > 0);

  const handleChange = (key: keyof PLevels, e: ChangeEvent<HTMLTextAreaElement>) => {
    const result = applyBulletRules(levels[key], e.target.value, e.target.selectionStart);
    pendingCursor.current = { key, pos: result.cursor };
    onChange({ ...levels, [key]: result.value });
  };

  const handlePaste = (key: keyof PLevels, e: ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = e.clipboardData.getData("text");
    if (!pasted.includes("\n")) return;
    e.preventDefault();
    const target = e.currentTarget;
    const cursor = target.selectionStart;
    const formatted = formatPasteAsBullets(pasted);
    const value = levels[key];
    const next = value.slice(0, cursor) + formatted + value.slice(cursor);
    pendingCursor.current = { key, pos: cursor + formatted.length };
    onChange({ ...levels, [key]: next });
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && canSubmit) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-5">
        <h1 className="font-serif text-2xl font-semibold tracking-tight text-warm-fg">
          What&apos;s on your mind?
        </h1>
        <p className="mt-1 text-sm text-warm-muted">
          Drop items by priority. Hit ↵ for a new bullet. Empty levels are skipped.
        </p>
      </header>

      <div className="mb-6 rounded-warm border border-warm-border bg-warm-surface px-5 py-4 shadow-warm">
        <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-warm-muted">
          Cues to spark memory
        </div>
        <div className="space-y-3 text-xs">
          <div className="flex items-baseline gap-3">
            <span className="w-16 shrink-0 text-warm-muted">Dates</span>
            <span className="font-mono text-warm-fg/80">
              {DATE_HINTS.join("  ·  ")}
            </span>
          </div>
          <div className="flex items-baseline gap-3">
            <span className="w-16 shrink-0 text-warm-muted">Verbs</span>
            <span className="font-mono text-warm-fg/80">
              {VERB_HINTS.join("  ·  ")}
            </span>
          </div>
          <div className="flex gap-3">
            <span className="w-16 shrink-0 pt-0.5 text-warm-muted">Domains</span>
            <span className="flex flex-wrap gap-1.5">
              {DOMAIN_VALUES.map((d) => (
                <span
                  key={d}
                  className="rounded bg-warm-chip px-2 py-0.5 text-[11px] text-warm-sage"
                >
                  {d}
                </span>
              ))}
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-warm border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-5">
        {SECTIONS.map((section) => (
          <div key={section.key}>
            <div className="mb-1.5 flex items-baseline gap-2">
              <span className="rounded bg-warm-chip px-2 py-0.5 font-mono text-xs font-semibold text-warm-sage">
                {section.tag}
              </span>
              <span className="text-sm text-warm-muted">{section.label}</span>
            </div>
            <textarea
              ref={(el) => {
                refs.current[section.key] = el;
              }}
              value={levels[section.key]}
              onChange={(e) => handleChange(section.key, e)}
              onPaste={(e) => handlePaste(section.key, e)}
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
        <span className="text-xs text-warm-muted">{canSubmit ? "⌘ ↵ to process" : " "}</span>
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
