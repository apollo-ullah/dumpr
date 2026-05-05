import type { Item } from "@/lib/types";

type Props = {
  item: Item;
  field: keyof Omit<Item, "id" | "flags">;
  onChange: (next: Partial<Item>) => void;
};

export function EditableCell(_props: Props) {
  return null;
}
