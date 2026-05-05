"use client";

import * as Select from "@radix-ui/react-select";
import { useState } from "react";
import type { Item, ItemFlags } from "@/lib/types";
import {
  CAPTURE_STATUS_VALUES,
  DOMAIN_VALUES,
  EFFORT_VALUES,
  PRIORITY_VALUES,
  TYPE_VALUES,
} from "@/lib/types";

type EditableField = "title" | "type" | "domain" | "priority" | "effort" | "dueDate" | "status";

type Props = {
  item: Item;
  field: EditableField;
  onChange: (next: Partial<Item>) => void;
};

const SELECT_OPTIONS: Record<EditableField, readonly string[] | null> = {
  title: null,
  type: TYPE_VALUES,
  domain: DOMAIN_VALUES,
  priority: PRIORITY_VALUES,
  effort: EFFORT_VALUES,
  dueDate: null,
  status: CAPTURE_STATUS_VALUES,
};

function clearFlag(flags: ItemFlags, field: EditableField): ItemFlags {
  const next = { ...flags };
  delete (next as Record<string, true | undefined>)[field];
  return next;
}

function displayValue(item: Item, field: EditableField): string {
  if (field === "dueDate") return item.dueDate ?? "—";
  return String(item[field]);
}

export function EditableCell({ item, field, onChange }: Props) {
  const [editing, setEditing] = useState(false);
  const isFlagged = item.flags[field] === true;
  const options = SELECT_OPTIONS[field];

  const cellClass = isFlagged
    ? "cursor-pointer text-warm-amber underline decoration-warm-amber decoration-dashed underline-offset-2"
    : "cursor-pointer text-warm-fg hover:bg-warm-chip";

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={`${cellClass} -mx-1 rounded px-1 py-0.5 text-left`}
      >
        {displayValue(item, field)}
      </button>
    );
  }

  const commit = (next: Partial<Item>) => {
    onChange({ ...next, flags: clearFlag(item.flags, field) });
    setEditing(false);
  };

  if (field === "title") {
    return (
      <input
        autoFocus
        type="text"
        defaultValue={item.title}
        onBlur={(e) => commit({ title: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") setEditing(false);
        }}
        className="-mx-1 w-full rounded border border-warm-sage bg-white px-1 py-0.5 text-warm-fg focus:outline-none"
      />
    );
  }

  if (field === "dueDate") {
    return (
      <input
        autoFocus
        type="date"
        defaultValue={item.dueDate ?? ""}
        onBlur={(e) => commit({ dueDate: e.target.value || null })}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") setEditing(false);
        }}
        className="-mx-1 rounded border border-warm-sage bg-white px-1 py-0.5 text-warm-fg focus:outline-none"
      />
    );
  }

  if (options) {
    return (
      <Select.Root
        defaultValue={String(item[field])}
        onValueChange={(value) => commit({ [field]: value } as Partial<Item>)}
        open
        onOpenChange={(open) => { if (!open) setEditing(false); }}
      >
        <Select.Trigger className="-mx-1 rounded border border-warm-sage bg-white px-1 py-0.5 text-warm-fg focus:outline-none">
          <Select.Value />
        </Select.Trigger>
        <Select.Portal>
          <Select.Content className="z-50 rounded-warm border border-warm-border bg-warm-surface shadow-lg">
            <Select.Viewport className="p-1">
              {options.map((opt) => (
                <Select.Item
                  key={opt}
                  value={opt}
                  className="cursor-pointer rounded px-3 py-1.5 text-sm text-warm-fg outline-none data-[highlighted]:bg-warm-chip"
                >
                  <Select.ItemText>{opt}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    );
  }

  return null;
}
