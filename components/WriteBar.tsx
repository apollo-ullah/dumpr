"use client";

type Props = {
  count: number;
  onWrite: () => void;
  onDiscard: () => void;
  writing: boolean;
};

export function WriteBar({ count, onWrite, onDiscard, writing }: Props) {
  return (
    <div className="sticky bottom-0 mt-6 border-t border-warm-border bg-warm-bg/90 px-6 py-4 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-end gap-3">
        <button
          type="button"
          onClick={onDiscard}
          disabled={writing}
          className="rounded-md border border-warm-border bg-transparent px-4 py-2 text-sm text-warm-fg/70 transition hover:bg-warm-chip disabled:cursor-not-allowed disabled:opacity-50"
        >
          Discard
        </button>
        <button
          type="button"
          onClick={onWrite}
          disabled={writing}
          className="rounded-md bg-warm-sage px-5 py-2 text-sm font-medium text-white shadow-warm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {writing ? "Writing…" : `Write ${count} to Inbox`}
        </button>
      </div>
    </div>
  );
}
