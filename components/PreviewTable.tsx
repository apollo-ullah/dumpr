import type { Item } from "@/lib/types";

type Props = {
  today: string;
  items: Item[];
  onItemChange: (index: number, next: Partial<Item>) => void;
};

export function PreviewTable(_props: Props) {
  return null;
}
