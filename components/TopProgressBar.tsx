"use client";

import { useEffect, useState } from "react";

type Props = { active: boolean };

export function TopProgressBar({ active }: Props) {
  const [progress, setProgress] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [fading, setFading] = useState(false);

  // active → true: mount, reset, animate the fill curve
  useEffect(() => {
    if (!active) return;
    setMounted(true);
    setFading(false);
    setProgress(0);
    const start = Date.now();
    const id = setInterval(() => {
      const elapsed = Date.now() - start;
      // Asymptotic: 90 * (1 - e^(-t/5000)) — fast initial growth, caps near 90%
      setProgress(90 * (1 - Math.exp(-elapsed / 5000)));
    }, 50);
    return () => clearInterval(id);
  }, [active]);

  // active → false (while mounted): snap to 100, hold, fade, unmount
  useEffect(() => {
    if (active || !mounted) return;
    setProgress(100);
    const fade = setTimeout(() => setFading(true), 220);
    const unmount = setTimeout(() => setMounted(false), 600);
    return () => {
      clearTimeout(fade);
      clearTimeout(unmount);
    };
  }, [active, mounted]);

  if (!mounted) return null;

  return (
    <div
      className={`pointer-events-none fixed inset-x-0 top-0 z-50 h-[3px] overflow-hidden bg-warm-border transition-opacity duration-300 ${
        fading ? "opacity-0" : "opacity-100"
      }`}
    >
      <div
        className="h-full bg-warm-sage transition-[width] duration-200 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
