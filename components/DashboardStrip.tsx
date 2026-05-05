"use client";

import { useEffect, useState } from "react";

type Stats = {
  dueThisWeek: number;
  p1: number;
  p2: number;
  p3: number;
  p4: number;
  starving: number;
};

type StatProps = {
  label: string;
  value: number | string;
  accent?: "warn" | "good" | "muted";
};

function Stat({ label, value, accent }: StatProps) {
  const valueColor =
    accent === "warn"
      ? "text-warm-amber"
      : accent === "good"
        ? "text-warm-sage"
        : accent === "muted"
          ? "text-warm-muted"
          : "text-warm-fg";

  return (
    <div className="rounded-warm border border-warm-border bg-warm-surface px-3 py-2 shadow-warm">
      <div className="font-mono text-[10px] uppercase tracking-wide text-warm-muted">
        {label}
      </div>
      <div className={`mt-0.5 font-serif text-2xl font-semibold leading-tight ${valueColor}`}>
        {value}
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="rounded-warm border border-warm-border bg-warm-surface px-3 py-2 shadow-warm">
      <div className="h-2.5 w-16 rounded bg-warm-chip" />
      <div className="mt-1.5 h-7 w-10 rounded bg-warm-chip" />
    </div>
  );
}

export function DashboardStrip() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/stats")
      .then(async (r) => {
        if (!r.ok) throw new Error(`stats ${r.status}`);
        return (await r.json()) as Stats;
      })
      .then((s) => {
        if (!cancelled) setStats(s);
      })
      .catch(() => {
        if (!cancelled) setError("couldn't load stats");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="border-b border-warm-border bg-warm-bg">
      <div className="mx-auto max-w-3xl px-6 py-4">
        {error ? (
          <div className="font-mono text-xs text-warm-muted">{error}</div>
        ) : stats === null ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
            <Stat label="Due this week" value={stats.dueThisWeek} />
            <Stat label="P1" value={stats.p1} accent={stats.p1 > 0 ? "warn" : undefined} />
            <Stat label="P2" value={stats.p2} />
            <Stat label="P3" value={stats.p3} />
            <Stat label="P4" value={stats.p4} accent="muted" />
            <Stat
              label="Starving"
              value={stats.starving}
              accent={stats.starving > 0 ? "warn" : "muted"}
            />
          </div>
        )}
      </div>
    </div>
  );
}
