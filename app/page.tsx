"use client";

import { useState } from "react";
import {
  DumpForm,
  EMPTY_LEVELS,
  serializeLevels,
  type PLevels,
} from "@/components/DumpForm";
import { PreviewTable } from "@/components/PreviewTable";
import { WriteBar } from "@/components/WriteBar";
import { PartialFailureCallout } from "@/components/PartialFailureCallout";
import { TopProgressBar } from "@/components/TopProgressBar";
import { DashboardStrip } from "@/components/DashboardStrip";
import type { Item, WriteFailure } from "@/lib/types";

type Phase = "input" | "processing" | "preview" | "writing" | "done";

type DoneState = {
  written: number;
  failures: WriteFailure[];
};

export default function Page() {
  const [levels, setLevels] = useState<PLevels>(EMPTY_LEVELS);
  const [phase, setPhase] = useState<Phase>("input");
  const [items, setItems] = useState<Item[]>([]);
  const [today, setToday] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<DoneState | null>(null);

  async function process() {
    setPhase("processing");
    setError(null);
    try {
      const res = await fetch("/api/process", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dump: serializeLevels(levels) }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Process failed (${res.status})`);
      }
      const body = (await res.json()) as { today: string; items: Item[] };
      setToday(body.today);
      setItems(body.items);
      setPhase("preview");
    } catch (err) {
      setError((err as Error).message);
      setPhase("input");
    }
  }

  function discard() {
    setItems([]);
    setError(null);
    setPhase("input");
  }

  function updateItem(index: number, patch: Partial<Item>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  async function write(fromIndex = 0) {
    setPhase("writing");
    const slice = items.slice(fromIndex);
    try {
      const res = await fetch("/api/write", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items: slice }),
      });
      const body = (await res.json()) as DoneState;
      const writtenAdjusted = { written: fromIndex + body.written, failures: body.failures };
      setDone(writtenAdjusted);
      setPhase("done");
    } catch (err) {
      setError((err as Error).message);
      setPhase("preview");
    }
  }

  function reset() {
    setLevels(EMPTY_LEVELS);
    setItems([]);
    setDone(null);
    setError(null);
    setPhase("input");
  }

  const busy = phase === "processing" || phase === "writing";

  return (
    <>
      <TopProgressBar active={busy} />
      <DashboardStrip />

      {(phase === "input" || phase === "processing") && (
        <DumpForm
          levels={levels}
          onChange={setLevels}
          onSubmit={process}
          loading={phase === "processing"}
          error={error}
        />
      )}

      {(phase === "preview" || phase === "writing") && (
        <>
          <PreviewTable today={today} items={items} onItemChange={updateItem} />
          <WriteBar
            count={items.length}
            onWrite={() => write(0)}
            onDiscard={discard}
            writing={phase === "writing"}
          />
        </>
      )}

      {phase === "done" && (
        <div className="mx-auto max-w-3xl px-6 py-12">
          <div className="rounded-warm border border-warm-border bg-warm-surface px-6 py-5 shadow-warm">
            <div className="font-medium text-warm-fg">
              Wrote {done!.written} of {items.length} items.
            </div>
            {done!.failures.length === 0 && (
              <div className="mt-1 text-sm text-warm-muted">All clean.</div>
            )}
            <button
              type="button"
              onClick={reset}
              className="mt-4 rounded-md bg-warm-sage px-4 py-2 text-sm font-medium text-white shadow-warm"
            >
              New dump
            </button>
          </div>
          {done!.failures.length > 0 && (
            <PartialFailureCallout
              failures={done!.failures}
              onRetry={(fromIndex) => write(fromIndex)}
              onDiscard={reset}
            />
          )}
        </div>
      )}
    </>
  );
}
