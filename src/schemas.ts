import { z } from "zod";

export const SummarySchema = z.object({
    bullets: z.array(z.string()).length(3),
    keywords: z.array(z.string()).length(3),
});

export type Summary = z.infer<typeof SummarySchema>;
