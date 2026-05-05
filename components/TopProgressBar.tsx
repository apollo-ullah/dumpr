"use client";

type Props = { active: boolean };

export function TopProgressBar({ active }: Props) {
  if (!active) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 h-[3px] overflow-hidden bg-warm-border">
      <div className="h-full w-1/3 animate-progress bg-warm-sage" />
    </div>
  );
}
