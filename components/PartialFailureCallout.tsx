import type { WriteFailure } from "@/lib/types";

type Props = {
  failures: WriteFailure[];
  onRetry: (fromIndex: number) => void;
  onDiscard: () => void;
};

export function PartialFailureCallout(_props: Props) {
  return null;
}
