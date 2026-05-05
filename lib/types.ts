import { z } from "zod";

export const DOMAIN_VALUES = [
  "Personal Project", "Work", "Clubs", "Community", "Coursework",
  "Family", "Health", "Deen", "Admin", "Money", "Content",
  "Career", "Growth", "Personal",
] as const;

export const PRIORITY_VALUES = [
  "P1 – Critical", "P2 – Important", "P3 – Normal", "P4 – Low",
] as const;

export const TYPE_VALUES = ["Task", "Project"] as const;
export const EFFORT_VALUES = ["Low", "Medium", "High"] as const;

export const CAPTURE_STATUS_VALUES = ["Planned", "Backlog"] as const;

export const ItemFlagsSchema = z.object({
  title: z.literal(true).optional(),
  type: z.literal(true).optional(),
  domain: z.literal(true).optional(),
  priority: z.literal(true).optional(),
  effort: z.literal(true).optional(),
  dueDate: z.literal(true).optional(),
  status: z.literal(true).optional(),
}).strict();

export const ItemSchema = z.object({
  title: z.string().min(1),
  type: z.enum(TYPE_VALUES),
  domain: z.enum(DOMAIN_VALUES),
  priority: z.enum(PRIORITY_VALUES),
  effort: z.enum(EFFORT_VALUES),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  status: z.enum(CAPTURE_STATUS_VALUES),
  flags: ItemFlagsSchema.default({}),
}).strict();

export const ItemsResponseSchema = z.object({ items: z.array(ItemSchema) }).strict();

export type Item = z.infer<typeof ItemSchema> & { id: string };
export type ItemFlags = z.infer<typeof ItemFlagsSchema>;

export type WriteFailure = { index: number; item: Item; error: string };
export type WriteResult = { written: number; failures: WriteFailure[] };
