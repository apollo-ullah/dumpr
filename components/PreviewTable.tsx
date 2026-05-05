"use client";

import type { Item } from "@/lib/types";
import { EditableCell } from "./EditableCell";

type Props = {
  today: string;
  items: Item[];
  onItemChange: (index: number, next: Partial<Item>) => void;
};

const COLUMNS: Array<{
  key: "title" | "type" | "domain" | "priority" | "effort" | "dueDate" | "status";
  label: string;
}> = [
  { key: "title", label: "Title" },
  { key: "type", label: "Type" },
  { key: "domain", label: "Domain" },
  { key: "priority", label: "Priority" },
  { key: "effort", label: "Effort" },
  { key: "dueDate", label: "Due" },
  { key: "status", label: "Status" },
];

export function PreviewTable({ today, items, onItemChange }: Props) {
  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-3 font-mono text-xs uppercase tracking-wider text-warm-muted">
        Today: {today}
      </div>

      <div className="overflow-hidden rounded-warm border border-warm-border bg-warm-surface shadow-warm">
        <table className="w-full text-left text-sm">
          <thead className="bg-warm-chip text-xs uppercase tracking-wider text-warm-muted">
            <tr>
              <th className="w-10 px-4 py-3 text-center">#</th>
              {COLUMNS.map((col) => (
                <th key={col.key} className="px-4 py-3">{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={item.id} className="border-t border-warm-border">
                <td className="px-4 py-3 text-center font-mono text-xs text-warm-muted">
                  {idx + 1}
                </td>
                {COLUMNS.map((col) => (
                  <td key={col.key} className="px-4 py-3 align-top">
                    <EditableCell
                      item={item}
                      field={col.key}
                      onChange={(next) => onItemChange(idx, next)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
