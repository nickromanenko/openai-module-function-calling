import { z } from "zod";

export const OrderSchema = z.object({
    id: z.string(),
    status: z.enum(["processing", "shipped", "delivered", "canceled"]),
    etaDays: z.number().int().nonnegative().optional(),
    trackingNumber: z.string().optional(),
});

export const SupportResponseSchema = z.object({
    answer: z.string(),
    order: OrderSchema.nullable(),
    nextSteps: z.array(z.string()).max(5),
    needsMoreInfo: z.boolean(),
    clarifyingQuestion: z.string().nullable(),
});

export type SupportResponse = z.infer<typeof SupportResponseSchema>;
