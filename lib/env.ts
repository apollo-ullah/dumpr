import { z } from "zod";

const EnvSchema = z.object({
  NOTION_TOKEN: z.string().min(1, "NOTION_TOKEN is required"),
  NOTION_DATA_SOURCE_ID: z.string().min(1, "NOTION_DATA_SOURCE_ID is required"),
});

export const env = EnvSchema.parse({
  NOTION_TOKEN: process.env.NOTION_TOKEN,
  NOTION_DATA_SOURCE_ID: process.env.NOTION_DATA_SOURCE_ID,
});
